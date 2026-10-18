import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AgentActionStatus, Prisma } from '@prisma/client';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { PrismaService } from '../prisma/prisma.service';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';
import {
  proposeMinStockChange,
  type MinStockProposalPayload,
  type PurchaseOrderProposalPayload,
} from './agent-action-proposals';

interface Operator {
  id: number;
  email: string;
}

const actionSelect = {
  id: true,
  type: true,
  status: true,
  payload: true,
  rationale: true,
  source: true,
  result: true,
  error: true,
  createdAt: true,
  decidedAt: true,
  requestedBy: { select: { id: true, email: true } },
  decidedBy: { select: { id: true, email: true } },
} satisfies Prisma.AgentActionSelect;

@Injectable()
export class AgentActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly auditTrailService: AuditTrailService,
  ) {}

  list(status?: AgentActionStatus) {
    return this.prisma.agentAction.findMany({
      where: status ? { status } : undefined,
      select: actionSelect,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Staff propose a reviewed minimum; the owner still approves it. */
  proposeMinStock(
    input: { productId?: number; newMinStock?: number },
    operator: Operator,
  ) {
    const productId = Number(input.productId);
    const newMinStock = Number(input.newMinStock);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new BadRequestException('productId must be a positive integer');
    }
    return proposeMinStockChange(this.prisma, {
      productId,
      newMinStock,
      rationale: `Minimum stock review recommends ${newMinStock} from forecast demand`,
      source: 'min-stock-review',
      requestedById: operator.id,
    });
  }

  async approve(id: number, operator: Operator) {
    const action = await this.claim(id, 'approved', operator);

    try {
      const result =
        action.type === 'generate_purchase_orders'
          ? await this.generatePurchaseOrders(
              action.payload as unknown as PurchaseOrderProposalPayload,
              operator,
            )
          : await this.setMinStock(
              action.id,
              action.payload as unknown as MinStockProposalPayload,
              operator,
            );
      await this.prisma.agentAction.update({
        where: { id },
        data: { result: result as Prisma.InputJsonValue },
      });
    } catch (error) {
      await this.prisma.agentAction.update({
        where: { id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Action failed',
        },
      });
    }

    await this.audit(id, 'approved', operator);
    return this.prisma.agentAction.findUniqueOrThrow({
      where: { id },
      select: actionSelect,
    });
  }

  async reject(id: number, operator: Operator, reason?: string | null) {
    await this.claim(id, 'rejected', operator, reason?.trim() || null);
    await this.audit(id, 'rejected', operator);
    return this.prisma.agentAction.findUniqueOrThrow({
      where: { id },
      select: actionSelect,
    });
  }

  /** Moves a pending action to its decision exactly once, even under races. */
  private async claim(
    id: number,
    status: 'approved' | 'rejected',
    operator: Operator,
    rejectReason: string | null = null,
  ) {
    const claimed = await this.prisma.agentAction.updateMany({
      where: { id, status: 'pending' },
      data: {
        status,
        decidedById: operator.id,
        decidedAt: new Date(),
        ...(rejectReason ? { error: `Rejected: ${rejectReason}` } : {}),
      },
    });
    const action = await this.prisma.agentAction.findUnique({
      where: { id },
      select: { id: true, type: true, payload: true, status: true },
    });
    if (!action) throw new NotFoundException(`Agent action ${id} not found`);
    if (claimed.count !== 1) {
      throw new ConflictException(`Agent action ${id} is already ${action.status}`);
    }
    return action;
  }

  private async generatePurchaseOrders(
    payload: PurchaseOrderProposalPayload,
    operator: Operator,
  ) {
    const batch = await this.purchaseOrdersService.generateFromReorderSuggestions(
      payload.language,
      operator,
    );
    return {
      businessDate: batch.businessDate,
      createdCount: batch.createdCount,
      updatedCount: batch.updatedCount,
      orders: batch.orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        supplier: order.supplier?.name ?? null,
        itemCount: order.items.length,
        estimatedTotal: order.estimatedTotal.toString(),
      })),
    };
  }

  private async setMinStock(
    actionId: number,
    payload: MinStockProposalPayload,
    operator: Operator,
  ) {
    // Applies only if nobody changed the minimum since the agent proposed it.
    const updated = await this.prisma.product.updateMany({
      where: { id: payload.productId, minStock: payload.currentMinStock },
      data: { minStock: payload.newMinStock },
    });
    if (updated.count !== 1) {
      throw new BadRequestException(
        `${payload.productName} minimum stock changed after this proposal; review it again`,
      );
    }
    await this.auditTrailService.create({
      table: 'products',
      recordId: payload.productId,
      field: 'minStock',
      oldValue: String(payload.currentMinStock),
      newValue: String(payload.newMinStock),
      userId: operator.id,
      userEmail: operator.email,
    });
    return {
      productId: payload.productId,
      productName: payload.productName,
      minStock: payload.newMinStock,
      agentActionId: actionId,
    };
  }

  private async audit(id: number, decision: string, operator: Operator) {
    const action = await this.prisma.agentAction.findUniqueOrThrow({
      where: { id },
      select: { type: true, status: true, source: true },
    });
    await this.auditTrailService.create({
      table: 'agent_actions',
      recordId: id,
      field: `[${decision}]`,
      oldValue: 'pending',
      newValue: JSON.stringify(action),
      userId: operator.id,
      userEmail: operator.email,
    });
  }
}

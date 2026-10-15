import { BadRequestException } from '@nestjs/common';
import { AgentActionType, Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

export type AgentActionSource =
  | 'openai-agent'
  | 'local-agent'
  | 'mcp'
  // A staff member proposing a change from the minimum stock review.
  | 'min-stock-review';

export interface PurchaseOrderProposalPayload {
  language: 'en' | 'fr' | 'zh';
  businessDate: string;
  itemCount: number;
  supplierCount: number;
  estimatedTotal: string;
}

export interface MinStockProposalPayload {
  productId: number;
  productName: string;
  currentMinStock: number;
  newMinStock: number;
}

export interface AgentActionProposal {
  id: number;
  type: AgentActionType;
  status: 'pending';
  payload: PurchaseOrderProposalPayload | MinStockProposalPayload;
  rationale: string;
  // false when an identical pending proposal already existed.
  created: boolean;
  message: string;
}

const MAX_MIN_STOCK = 100_000;

async function createOrReuse(
  prisma: PrismaService,
  input: {
    type: AgentActionType;
    dedupeKey: string;
    payload: PurchaseOrderProposalPayload | MinStockProposalPayload;
    rationale: string;
    source: AgentActionSource;
    requestedById: number | null;
  },
): Promise<AgentActionProposal> {
  const message =
    'Proposal recorded. Nothing has changed yet: the store owner must approve it under Pending actions.';
  const existing = await prisma.agentAction.findFirst({
    where: { dedupeKey: input.dedupeKey, status: 'pending' },
    select: { id: true },
  });
  if (existing) {
    await prisma.agentAction.update({
      where: { id: existing.id },
      data: {
        payload: input.payload as unknown as Prisma.InputJsonValue,
        rationale: input.rationale,
      },
    });
    return {
      id: existing.id,
      type: input.type,
      status: 'pending',
      payload: input.payload,
      rationale: input.rationale,
      created: false,
      message,
    };
  }

  const action = await prisma.agentAction.create({
    data: {
      type: input.type,
      dedupeKey: input.dedupeKey,
      payload: input.payload as unknown as Prisma.InputJsonValue,
      rationale: input.rationale,
      source: input.source,
      requestedById: input.requestedById,
    },
    select: { id: true },
  });
  return {
    id: action.id,
    type: input.type,
    status: 'pending',
    payload: input.payload,
    rationale: input.rationale,
    created: true,
    message,
  };
}

export function proposePurchaseOrders(
  prisma: PrismaService,
  input: {
    preview: Omit<PurchaseOrderProposalPayload, 'language'>;
    language: PurchaseOrderProposalPayload['language'];
    rationale: string;
    source: AgentActionSource;
    requestedById: number | null;
  },
) {
  return createOrReuse(prisma, {
    type: 'generate_purchase_orders',
    dedupeKey: `generate_purchase_orders:${input.preview.businessDate}`,
    payload: { language: input.language, ...input.preview },
    rationale: input.rationale,
    source: input.source,
    requestedById: input.requestedById,
  });
}

export async function proposeMinStockChange(
  prisma: PrismaService,
  input: {
    productId: number;
    newMinStock: number;
    rationale: string;
    source: AgentActionSource;
    requestedById: number | null;
  },
) {
  if (
    !Number.isInteger(input.newMinStock) ||
    input.newMinStock < 0 ||
    input.newMinStock > MAX_MIN_STOCK
  ) {
    throw new BadRequestException(
      `newMinStock must be an integer between 0 and ${MAX_MIN_STOCK}`,
    );
  }
  const product = await prisma.product.findFirst({
    where: { id: input.productId, isActive: true },
    select: { id: true, name: true, minStock: true },
  });
  if (!product) {
    throw new BadRequestException(`Active product ${input.productId} not found`);
  }
  if (product.minStock === input.newMinStock) {
    throw new BadRequestException(
      `${product.name} already has a minimum stock of ${product.minStock}`,
    );
  }

  return createOrReuse(prisma, {
    type: 'set_min_stock',
    dedupeKey: `set_min_stock:${product.id}`,
    payload: {
      productId: product.id,
      productName: product.name,
      currentMinStock: product.minStock,
      newMinStock: input.newMinStock,
    },
    rationale: input.rationale,
    source: input.source,
    requestedById: input.requestedById,
  });
}

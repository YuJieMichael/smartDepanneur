import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { audit, lockKey } from '../store-operations/common';
import { Prisma } from '@prisma/client';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import {
  InsightsService,
  type InsightLanguage,
} from '../insights/insights.service';
import { PrismaService } from '../prisma/prisma.service';

interface Operator {
  id: number;
  email: string;
}

interface PurchaseOrderGroup {
  supplierId: number | null;
  supplierName: string | null;
  orderNumber: string;
  items: Array<{
    productId: number;
    productName: string;
    sku: string | null;
    unit: string;
    quantity: number;
    unitCost: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
  }>;
  estimatedTotal: Prisma.Decimal;
}

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly insightsService: InsightsService,
    private readonly auditTrailService: AuditTrailService,
  ) {}

  async generateFromReorderSuggestions(
    language: InsightLanguage,
    operator: Operator,
  ) {
    const reorder = await this.insightsService.getReorderSuggestions(language);
    const businessDate = this.getTorontoBusinessDate();

    if (reorder.suggestions.length === 0) {
      return {
        businessDate,
        createdCount: 0,
        updatedCount: 0,
        orders: [],
      };
    }

    const groups = this.groupSuggestions(reorder.suggestions, businessDate);
    return this.prisma.$transaction(
      async (tx) => {
        const orders = [];
        let createdCount = 0;
        let updatedCount = 0;
        for (const group of groups) {
          await lockKey(tx, 'purchase-draft:' + group.orderNumber);
          const existing = await tx.purchaseOrder.findFirst({
            where: {
              businessDate,
              supplierId: group.supplierId,
              status: 'draft',
            },
            orderBy: { id: 'desc' },
          });
          if (existing)
            await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${existing.id} FOR UPDATE`;
          const current = existing
            ? await tx.purchaseOrder.findUnique({ where: { id: existing.id } })
            : null;
          const editable = current?.status === 'draft';
          const data = {
            estimatedTotal: group.estimatedTotal,
            supplierId: group.supplierId,
            items: { create: group.items },
          };
          const order = editable
            ? await tx.purchaseOrder.update({
                where: { id: current.id },
                data: {
                  ...data,
                  items: { deleteMany: {}, create: group.items },
                },
                include: { supplier: true, items: true },
              })
            : await tx.purchaseOrder.create({
                data: {
                  ...data,
                  orderNumber:
                    group.orderNumber +
                    '-' +
                    randomUUID().slice(0, 8).toUpperCase(),
                  businessDate,
                  status: 'draft',
                  createdById: operator.id,
                },
                include: { supplier: true, items: true },
              });
          if (editable) updatedCount++;
          else createdCount++;
          await audit(
            tx,
            operator,
            'purchase_orders',
            order.id,
            editable ? 'draft_updated' : 'draft_created',
            { orderNumber: order.orderNumber },
          );
          orders.push(order);
        }
        return { businessDate, createdCount, updatedCount, orders };
      },
      { timeout: 30000 },
    );
  }

  private groupSuggestions(
    suggestions: Awaited<
      ReturnType<InsightsService['getReorderSuggestions']>
    >['suggestions'],
    businessDate: string,
  ): PurchaseOrderGroup[] {
    const compactDate = businessDate.replaceAll('-', '');
    const groups = new Map<string, PurchaseOrderGroup>();

    for (const suggestion of suggestions) {
      const supplierKey = suggestion.supplier
        ? String(suggestion.supplier.id)
        : 'UNASSIGNED';
      const orderNumber = `PO-${compactDate}-${supplierKey}`;
      const existing = groups.get(supplierKey);
      const item = {
        productId: suggestion.productId,
        productName: suggestion.productName,
        sku: suggestion.sku,
        unit: suggestion.unit,
        quantity: suggestion.suggestedReorderQty,
        unitCost: new Prisma.Decimal(suggestion.unitCost),
        lineTotal: new Prisma.Decimal(suggestion.estimatedCost),
      };

      if (existing) {
        existing.items.push(item);
        existing.estimatedTotal = existing.estimatedTotal.add(item.lineTotal);
        continue;
      }

      groups.set(supplierKey, {
        supplierId: suggestion.supplier?.id ?? null,
        supplierName: suggestion.supplier?.name ?? null,
        orderNumber,
        items: [item],
        estimatedTotal: item.lineTotal,
      });
    }

    return [...groups.values()].sort((a, b) =>
      (a.supplierName ?? '').localeCompare(b.supplierName ?? ''),
    );
  }

  private getTorontoBusinessDate(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    );

    return `${values.year}-${values.month}-${values.day}`;
  }
}

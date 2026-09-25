import { Injectable } from '@nestjs/common';
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
    const existingOrders = await this.prisma.purchaseOrder.findMany({
      where: { orderNumber: { in: groups.map((group) => group.orderNumber) } },
      select: { orderNumber: true },
    });
    const existingOrderNumbers = new Set(
      existingOrders.map((order) => order.orderNumber),
    );

    const orders = await this.prisma.$transaction(async (tx) => {
      const savedOrders = [];

      for (const group of groups) {
        const order = await tx.purchaseOrder.upsert({
          where: { orderNumber: group.orderNumber },
          create: {
            orderNumber: group.orderNumber,
            businessDate,
            status: 'draft',
            estimatedTotal: group.estimatedTotal,
            supplierId: group.supplierId,
            createdById: operator.id,
            items: { create: group.items },
          },
          update: {
            businessDate,
            status: 'draft',
            estimatedTotal: group.estimatedTotal,
            supplierId: group.supplierId,
            createdById: operator.id,
            items: {
              deleteMany: {},
              create: group.items,
            },
          },
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                contactName: true,
                phone: true,
                email: true,
              },
            },
            items: {
              orderBy: { productName: 'asc' },
            },
          },
        });

        savedOrders.push(order);
      }

      return savedOrders;
    });

    await Promise.all(
      orders.map((order) =>
        this.auditTrailService.create({
          table: 'purchase_orders',
          recordId: order.id,
          field: existingOrderNumbers.has(order.orderNumber)
            ? '[draft-updated]'
            : '[draft-generated]',
          oldValue: null,
          newValue: JSON.stringify({
            orderNumber: order.orderNumber,
            itemCount: order.items.length,
            estimatedTotal: order.estimatedTotal.toString(),
          }),
          userId: operator.id,
          userEmail: operator.email,
        }),
      ),
    );

    return {
      businessDate,
      createdCount: orders.filter(
        (order) => !existingOrderNumbers.has(order.orderNumber),
      ).length,
      updatedCount: orders.filter((order) =>
        existingOrderNumbers.has(order.orderNumber),
      ).length,
      orders,
    };
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

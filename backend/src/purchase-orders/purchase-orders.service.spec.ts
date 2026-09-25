import { Prisma } from '@prisma/client';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { InsightsService } from '../insights/insights.service';
import { PrismaService } from '../prisma/prisma.service';
import { PurchaseOrdersService } from './purchase-orders.service';

describe('PurchaseOrdersService', () => {
  const operator = { id: 7, email: 'owner@smartdepanneur.local' };

  afterEach(() => {
    jest.useRealTimers();
  });

  it('groups suggestions by supplier and updates the same daily drafts', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-23T16:00:00.000Z'));
    const suggestions = [
      {
        productId: 1,
        productName: 'Cola',
        sku: 'COLA',
        unit: 'can',
        currentStock: 0,
        minStock: 12,
        soldLast7Days: 7,
        suggestedReorderQty: 26,
        unitCost: new Prisma.Decimal('0.75'),
        estimatedCost: new Prisma.Decimal('19.50'),
        urgency: 'critical' as const,
        reason: 'Out of stock',
        supplier: {
          id: 1,
          name: 'Beverage Supply',
          phone: null,
          email: null,
        },
        category: { id: 1, name: 'Drinks' },
      },
      {
        productId: 2,
        productName: 'Milk',
        sku: 'MILK',
        unit: 'carton',
        currentStock: 2,
        minStock: 6,
        soldLast7Days: 4,
        suggestedReorderQty: 12,
        unitCost: new Prisma.Decimal('2.25'),
        estimatedCost: new Prisma.Decimal('27.00'),
        urgency: 'high' as const,
        reason: 'Low stock',
        supplier: {
          id: 2,
          name: 'Dairy Supply',
          phone: null,
          email: null,
        },
        category: { id: 2, name: 'Dairy' },
      },
    ];
    const insights = {
      getReorderSuggestions: jest.fn().mockResolvedValue({
        suggestions,
        summary: 'Two products need restocking.',
      }),
    } as unknown as InsightsService;
    const upsert = jest.fn(
      (args: {
        where: { orderNumber: string };
        create: {
          supplierId: number | null;
          items: { create: Array<Record<string, unknown>> };
          [key: string]: unknown;
        };
      }) =>
        Promise.resolve({
          id: args.where.orderNumber.endsWith('-1') ? 101 : 102,
          ...args.create,
          supplier:
            args.create.supplierId === 1
              ? { id: 1, name: 'Beverage Supply' }
              : { id: 2, name: 'Dairy Supply' },
          items: args.create.items.create.map((item, index) => ({
            id: index + 1,
            ...item,
          })),
        }),
    );
    const tx = { purchaseOrder: { upsert } };
    const prisma = {
      purchaseOrder: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ orderNumber: 'PO-20260723-1' }]),
      },
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    } as unknown as PrismaService;
    const audit = {
      create: jest.fn().mockResolvedValue({ id: 1 }),
    } as unknown as AuditTrailService;
    const service = new PurchaseOrdersService(prisma, insights, audit);

    const result = await service.generateFromReorderSuggestions('zh', operator);

    expect(result).toMatchObject({
      businessDate: '2026-07-23',
      createdCount: 1,
      updatedCount: 1,
    });
    expect(result.orders).toHaveLength(2);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderNumber: 'PO-20260723-1' },
        update: expect.objectContaining({
          estimatedTotal: new Prisma.Decimal('19.50'),
          items: expect.objectContaining({ deleteMany: {} }),
        }),
      }),
    );
    expect(audit.create).toHaveBeenCalledTimes(2);
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recordId: 101,
        field: '[draft-updated]',
        userId: operator.id,
      }),
    );
  });

  it('does not create empty purchase orders when stock is healthy', async () => {
    const insights = {
      getReorderSuggestions: jest.fn().mockResolvedValue({
        suggestions: [],
        summary: 'No reorders needed.',
      }),
    } as unknown as InsightsService;
    const prisma = {
      purchaseOrder: { findMany: jest.fn() },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const audit = { create: jest.fn() } as unknown as AuditTrailService;
    const service = new PurchaseOrdersService(prisma, insights, audit);

    const result = await service.generateFromReorderSuggestions('en', operator);

    expect(result.orders).toEqual([]);
    expect(prisma.purchaseOrder.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.create).not.toHaveBeenCalled();
  });
});

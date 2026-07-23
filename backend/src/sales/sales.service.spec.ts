import { BadRequestException } from '@nestjs/common';
import { PaymentMethod, Prisma } from '@prisma/client';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { PrismaService } from '../prisma/prisma.service';
import { SalesService } from './sales.service';

describe('SalesService', () => {
  const operator = { id: 7, email: 'cashier@smartdepanneur.local' };

  function createFixture(stockUpdateCount = 1) {
    const product = {
      id: 1,
      name: 'Milk 2%',
      sellingPrice: new Prisma.Decimal('4.50'),
      costPrice: new Prisma.Decimal('3.00'),
      currentStock: 10,
    };
    const createdSale = {
      id: 99,
      saleNumber: 'SALE-TEST',
      subtotal: new Prisma.Decimal('9.00'),
      tax: new Prisma.Decimal('1.35'),
      total: new Prisma.Decimal('10.35'),
      profitEstimate: new Prisma.Decimal('3.00'),
      paymentMethod: PaymentMethod.debit,
      cashier: operator,
      items: [],
    };
    const tx = {
      product: {
        updateMany: jest.fn().mockResolvedValue({ count: stockUpdateCount }),
      },
      sale: {
        create: jest.fn().mockResolvedValue(createdSale),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
      },
    };
    const prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([product]),
      },
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    } as unknown as PrismaService;
    const audit = {
      create: jest.fn().mockResolvedValue({ id: 1 }),
    } as unknown as AuditTrailService;

    return {
      service: new SalesService(prisma, audit),
      tx,
      audit,
    };
  }

  it('atomically deducts stock and records the sale movement', async () => {
    const { service, tx, audit } = createFixture();

    const result = await service.createSale(
      {
        paymentMethod: 'debit',
        items: [{ productId: 1, quantity: 2 }],
      },
      operator,
    );

    expect(result.id).toBe(99);
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: {
        id: 1,
        isActive: true,
        currentStock: { gte: 2 },
      },
      data: { currentStock: { decrement: 2 } },
    });
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          product: { connect: { id: 1 } },
          quantity: -2,
          referenceType: 'sale',
        }),
      }),
    );
    expect(audit.create).toHaveBeenCalledTimes(1);
  });

  it('rejects checkout when the atomic stock update cannot reserve inventory', async () => {
    const { service, tx, audit } = createFixture(0);

    await expect(
      service.createSale(
        {
          items: [{ productId: 1, quantity: 20 }],
        },
        operator,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.sale.create).not.toHaveBeenCalled();
    expect(audit.create).not.toHaveBeenCalled();
  });

  it('voids a sale, restores stock, and records a return movement', async () => {
    const sale = {
      id: 99,
      saleNumber: 'SALE-TEST',
      cashierId: operator.id,
      isVoided: false,
      cashier: operator,
      voidedBy: null,
      items: [
        {
          id: 1,
          saleId: 99,
          productId: 1,
          quantity: 2,
          unitPrice: new Prisma.Decimal('4.50'),
          unitCost: new Prisma.Decimal('3.00'),
          lineTotal: new Prisma.Decimal('9.00'),
          product: {
            id: 1,
            name: 'Milk 2%',
            sku: 'MILK-2',
            barcode: null,
          },
        },
      ],
    };
    const tx = {
      sale: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...sale,
          isVoided: true,
          voidReason: 'Wrong quantity',
          voidedBy: operator,
        }),
      },
      product: {
        update: jest.fn().mockResolvedValue({ id: 1 }),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({ id: 2 }),
      },
    };
    const prisma = {
      sale: {
        findUnique: jest.fn().mockResolvedValue(sale),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          roles: [{ name: 'Cashier', permissions: [{ name: 'sales-edit' }] }],
        }),
      },
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    } as unknown as PrismaService;
    const audit = {
      create: jest.fn().mockResolvedValue({ id: 2 }),
    } as unknown as AuditTrailService;
    const service = new SalesService(prisma, audit);

    const result = await service.voidSale(sale.id, 'Wrong quantity', operator);

    expect(result.isVoided).toBe(true);
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { currentStock: { increment: 2 } },
    });
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'return_item',
          quantity: 2,
          referenceType: 'sale_void',
          referenceId: sale.id,
        }),
      }),
    );
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recordId: sale.id,
        field: 'isVoided',
      }),
    );
  });

  it('does not restore stock twice when a sale is already voided', async () => {
    const prisma = {
      sale: {
        findUnique: jest.fn().mockResolvedValue({
          id: 99,
          saleNumber: 'SALE-TEST',
          cashierId: operator.id,
          isVoided: true,
          cashier: operator,
          voidedBy: operator,
          items: [],
        }),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const audit = {
      create: jest.fn(),
    } as unknown as AuditTrailService;
    const service = new SalesService(prisma, audit);

    await expect(service.voidSale(99, 'Again', operator)).rejects.toThrow(
      'already voided',
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.create).not.toHaveBeenCalled();
  });
});

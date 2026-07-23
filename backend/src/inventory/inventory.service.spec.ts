import { BadRequestException } from '@nestjs/common';
import { InventoryMovementType } from '@prisma/client';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  const operator = { id: 4, email: 'inventory@smartdepanneur.local' };

  function createFixture(updateCount = 1) {
    const movement = {
      id: 20,
      type: InventoryMovementType.waste,
      quantity: -3,
      product: {
        id: 1,
        name: 'Milk 2%',
        sku: 'MILK-2',
        barcode: null,
        currentStock: 2,
      },
      user: operator,
    };
    const tx = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          name: 'Milk 2%',
          currentStock: 5,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: updateCount }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 1,
          name: 'Milk 2%',
          currentStock: 2,
        }),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue(movement),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    } as unknown as PrismaService;
    const audit = {
      create: jest.fn().mockResolvedValue({ id: 1 }),
    } as unknown as AuditTrailService;

    return {
      service: new InventoryService(prisma, audit),
      tx,
      audit,
    };
  }

  it('uses a conditional decrement for waste movements', async () => {
    const { service, tx, audit } = createFixture();

    await service.wasteStock(
      { productId: 1, quantity: 3, reason: 'Expired' },
      operator,
    );

    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: 1, currentStock: { gte: 3 } },
      data: { currentStock: { decrement: 3 } },
    });
    expect(audit.create).toHaveBeenCalledTimes(2);
  });

  it('prevents a concurrent movement from creating negative stock', async () => {
    const { service, tx, audit } = createFixture(0);

    await expect(
      service.wasteStock(
        { productId: 1, quantity: 6, reason: 'Damaged' },
        operator,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    expect(audit.create).not.toHaveBeenCalled();
  });
});

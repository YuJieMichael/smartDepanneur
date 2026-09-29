import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InventoryMovementType, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  amount,
  audit,
  calendarDate,
  integer,
  Operator,
  storeDate,
} from './common';

export async function lockProduct(tx: Prisma.TransactionClient, id: number) {
  integer(id);
  await tx.$queryRaw`SELECT id FROM products WHERE id = ${id} FOR UPDATE`;
  const product = await tx.product.findUnique({ where: { id } });
  if (!product) throw new NotFoundException('Product not found');
  const sum = await tx.stockBatch.aggregate({
    where: { productId: id },
    _sum: { quantityRemaining: true },
  });
  if ((sum._sum.quantityRemaining ?? 0) !== product.currentStock)
    throw new ConflictException(
      'Batch stock does not match product stock. Reconcile inventory first.',
    );
  return product;
}

export async function syncProduct(
  tx: Prisma.TransactionClient,
  productId: number,
) {
  const sum = await tx.stockBatch.aggregate({
    where: { productId },
    _sum: { quantityRemaining: true },
  });
  const earliest = await tx.stockBatch.findFirst({
    where: {
      productId,
      quantityRemaining: { gt: 0 },
      expirationDate: { not: null },
    },
    orderBy: { expirationDate: 'asc' },
  });
  await tx.product.update({
    where: { id: productId },
    data: {
      currentStock: sum._sum.quantityRemaining ?? 0,
      expirationDate: earliest?.expirationDate ?? null,
    },
  });
}

export async function receiveStock(
  tx: Prisma.TransactionClient,
  input: {
    productId: number;
    quantity: number;
    unitCost?: string | number | Prisma.Decimal | null;
    lotCode?: string | null;
    expirationDate?: string | null;
    reason?: string | null;
    referenceType?: string | null;
    referenceId?: number | null;
    type?: InventoryMovementType;
  },
  operator: Operator,
) {
  const product = await lockProduct(tx, input.productId);
  const quantity = integer(input.quantity);
  const expiry = input.expirationDate
    ? calendarDate(input.expirationDate.slice(0, 10))
    : null;
  if (product.expirationTracked && !expiry)
    throw new BadRequestException(
      'An expiration date is required for this product batch',
    );
  const cost =
    input.unitCost == null ? product.costPrice : amount(String(input.unitCost));
  const batch = await tx.stockBatch.create({
    data: {
      productId: product.id,
      quantityReceived: quantity,
      quantityRemaining: quantity,
      unitCost: cost,
      lotCode:
        input.lotCode?.trim().slice(0, 100) ||
        `LOT-${randomUUID().slice(0, 8)}`,
      expirationDate: expiry,
    },
  });
  const movement = await tx.inventoryMovement.create({
    data: {
      productId: product.id,
      batchId: batch.id,
      userId: operator.id,
      quantity,
      unitCost: cost,
      type: input.type ?? 'purchase',
      reason: input.reason,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
    },
  });
  await syncProduct(tx, product.id);
  await audit(tx, operator, 'stock_batches', batch.id, 'received', {
    quantity,
    lotCode: batch.lotCode,
    expirationDate: expiry,
  });
  return { batch, movement };
}

export async function consumeStock(
  tx: Prisma.TransactionClient,
  input: {
    productId: number;
    quantity: number;
    type: InventoryMovementType;
    batchId?: number;
    reason?: string | null;
    referenceType?: string | null;
    referenceId?: number | null;
  },
  operator: Operator,
) {
  const product = await lockProduct(tx, input.productId);
  const quantity = integer(input.quantity);
  if (input.type === 'sale' && !product.isActive)
    throw new BadRequestException('Product is inactive');
  const batches = await tx.stockBatch.findMany({
    where: {
      productId: product.id,
      quantityRemaining: { gt: 0 },
      ...(input.batchId ? { id: integer(input.batchId) } : {}),
      ...(input.type === 'sale'
        ? {
            OR: [
              { expirationDate: { gte: calendarDate(storeDate()) } },
              ...(!product.expirationTracked ? [{ expirationDate: null }] : []),
            ],
          }
        : {}),
    },
    orderBy: [
      { expirationDate: { sort: 'asc', nulls: 'last' } },
      { receivedAt: 'asc' },
      { id: 'asc' },
    ],
  });
  if (batches.reduce((sum, b) => sum + b.quantityRemaining, 0) < quantity)
    throw new BadRequestException(
      'Insufficient eligible batch stock (expired or undated tracked batches cannot be sold)',
    );
  let remaining = quantity;
  const allocations: {
    batchId: number;
    quantity: number;
    unitCost: Prisma.Decimal;
  }[] = [];
  const movements: number[] = [];
  for (const batch of batches) {
    if (remaining === 0) break;
    const used = Math.min(remaining, batch.quantityRemaining);
    await tx.stockBatch.update({
      where: { id: batch.id },
      data: { quantityRemaining: { decrement: used } },
    });
    allocations.push({
      batchId: batch.id,
      quantity: used,
      unitCost: batch.unitCost,
    });
    const m = await tx.inventoryMovement.create({
      data: {
        productId: product.id,
        batchId: batch.id,
        userId: operator.id,
        quantity: -used,
        type: input.type,
        unitCost: batch.unitCost,
        reason: input.reason,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
      },
    });
    movements.push(m.id);
    remaining -= used;
  }
  await syncProduct(tx, product.id);
  return {
    allocations,
    movements,
    costTotal: allocations.reduce(
      (sum, b) => sum.plus(b.unitCost.times(b.quantity)),
      new Prisma.Decimal(0),
    ),
  };
}

export async function restoreSaleItem(
  tx: Prisma.TransactionClient,
  saleItemId: number,
  operator: Operator,
  saleId: number,
) {
  const item = await tx.saleItem.findUniqueOrThrow({
    where: { id: saleItemId },
    include: { allocations: true },
  });
  await lockProduct(tx, item.productId);
  if (!item.allocations.length)
    throw new BadRequestException(
      'Historical sale has no batch allocation; use a separately recorded stock adjustment',
    );
  for (const allocation of item.allocations) {
    await tx.stockBatch.update({
      where: { id: allocation.batchId },
      data: { quantityRemaining: { increment: allocation.quantity } },
    });
    await tx.inventoryMovement.create({
      data: {
        productId: item.productId,
        batchId: allocation.batchId,
        userId: operator.id,
        quantity: allocation.quantity,
        unitCost: allocation.unitCost,
        type: 'return_item',
        referenceType: 'sale_void',
        referenceId: saleId,
      },
    });
  }
  await syncProduct(tx, item.productId);
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  amount,
  audit,
  calendarDate,
  hash,
  integer,
  lockKey,
  Operator,
  requestKey,
  storeDate,
} from './common';
import { lockProduct, receiveStock, syncProduct } from './stock';

const orderInclude = {
  supplier: true,
  items: { include: { product: { select: { expirationTracked: true } } } },
  receipts: {
    include: {
      receivedBy: { select: { email: true } },
      lines: { include: { batch: true } },
    },
  },
} satisfies Prisma.PurchaseOrderInclude;
export interface ReceiptInput {
  requestId: string;
  reference?: string;
  items: {
    orderItemId: number;
    quantity: number;
    lotCode?: string;
    expirationDate?: string;
    unitCost?: string;
  }[];
}
export interface CloseInput {
  countedCash: string;
  countedDebit: string;
  countedCredit: string;
  countedOther: string;
  notes?: string;
}

@Injectable()
export class StoreOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  orders() {
    return this.prisma.purchaseOrder.findMany({
      include: orderInclude,
      orderBy: { id: 'desc' },
      take: 100,
    });
  }

  async orderStatus(
    id: number,
    status: 'sent' | 'cancelled',
    reference: string,
    operator: Operator,
  ) {
    integer(id);
    if (!['sent', 'cancelled'].includes(status))
      throw new BadRequestException('Invalid purchase-order transition');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${id} FOR UPDATE`;
      const order = await tx.purchaseOrder.findUniqueOrThrow({
        where: { id },
        include: { items: true },
      });
      if (status === 'sent' && order.status !== 'draft')
        throw new ConflictException('Only a draft can be marked sent');
      if (status === 'sent' && (!order.supplierId || !reference?.trim()))
        throw new BadRequestException(
          'Supplier and sending reference are required',
        );
      if (
        status === 'cancelled' &&
        (!['draft', 'sent'].includes(order.status) ||
          order.items.some((i) => i.receivedQuantity))
      )
        throw new ConflictException('Received orders cannot be cancelled');
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status,
          ...(status === 'sent'
            ? {
                sentAt: new Date(),
                sentReference: reference.trim().slice(0, 500),
              }
            : {}),
        },
        include: orderInclude,
      });
      await audit(tx, operator, 'purchase_orders', id, 'status', {
        from: order.status,
        to: status,
        reference,
      });
      return updated;
    });
  }

  async receive(id: number, input: ReceiptInput, operator: Operator) {
    integer(id);
    const key = requestKey(input.requestId);
    const fingerprint = hash({ id, input, userId: operator.id });
    if (
      !Array.isArray(input.items) ||
      !input.items.length ||
      input.items.length > 500
    )
      throw new BadRequestException('Provide 1–500 receipt lines');
    return this.prisma.$transaction(
      async (tx) => {
        await lockKey(tx, `receipt:${key}`);
        const previous = await tx.purchaseReceipt.findUnique({
          where: { requestId: key },
        });
        if (previous) {
          if (previous.requestHash !== fingerprint)
            throw new ConflictException(
              'Request ID already used for different receipt data',
            );
          return tx.purchaseOrder.findUniqueOrThrow({
            where: { id },
            include: orderInclude,
          });
        }
        await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${id} FOR UPDATE`;
        const order = await tx.purchaseOrder.findUniqueOrThrow({
          where: { id },
          include: { items: true },
        });
        if (!['sent', 'partially_received'].includes(order.status))
          throw new ConflictException(
            'Only sent or partially received orders accept receipts',
          );
        const totals = new Map<number, number>();
        for (const row of input.items)
          totals.set(
            integer(row.orderItemId),
            (totals.get(row.orderItemId) ?? 0) + integer(row.quantity),
          );
        for (const [itemId, quantity] of totals) {
          const line = order.items.find((i) => i.id === itemId);
          if (!line || line.receivedQuantity + quantity > line.quantity)
            throw new BadRequestException(
              'Receipt exceeds the outstanding order quantity',
            );
        }
        const receipt = await tx.purchaseReceipt.create({
          data: {
            orderId: id,
            requestId: key,
            requestHash: fingerprint,
            receivedById: operator.id,
            reference: input.reference?.trim().slice(0, 500),
          },
        });
        const lines = input.items
          .map((row) => ({
            ...row,
            item: order.items.find((i) => i.id === row.orderItemId)!,
          }))
          .sort((a, b) => a.item.productId - b.item.productId);
        for (const row of lines) {
          const { batch } = await receiveStock(
            tx,
            {
              productId: row.item.productId,
              quantity: row.quantity,
              lotCode: row.lotCode,
              expirationDate: row.expirationDate,
              unitCost: row.unitCost ?? row.item.unitCost,
              referenceType: 'purchase_receipt',
              referenceId: receipt.id,
              reason: `Receive ${order.orderNumber}`,
            },
            operator,
          );
          await tx.purchaseReceiptLine.create({
            data: {
              receiptId: receipt.id,
              orderItemId: row.item.id,
              batchId: batch.id,
              quantity: row.quantity,
            },
          });
        }
        for (const [itemId, quantity] of totals)
          await tx.purchaseOrderItem.update({
            where: { id: itemId },
            data: { receivedQuantity: { increment: quantity } },
          });
        const complete = order.items.every(
          (i) => i.receivedQuantity + (totals.get(i.id) ?? 0) === i.quantity,
        );
        await tx.purchaseOrder.update({
          where: { id },
          data: { status: complete ? 'received' : 'partially_received' },
        });
        await audit(tx, operator, 'purchase_orders', id, 'receipt', {
          receiptId: receipt.id,
          items: input.items,
        });
        return tx.purchaseOrder.findUniqueOrThrow({
          where: { id },
          include: orderInclude,
        });
      },
      { timeout: 30000 },
    );
  }

  batches(productId?: number) {
    if (productId !== undefined) integer(productId);
    return this.prisma.stockBatch.findMany({
      where: {
        ...(productId ? { productId } : {}),
        quantityRemaining: { gt: 0 },
      },
      include: {
        product: {
          select: { id: true, name: true, sku: true, expirationTracked: true },
        },
      },
      orderBy: [
        { expirationDate: { sort: 'asc', nulls: 'last' } },
        { id: 'asc' },
      ],
      take: 1000,
    });
  }

  async updateBatch(
    id: number,
    input: { lotCode: string; expirationDate?: string; reason: string },
    operator: Operator,
  ) {
    integer(id);
    if (!input.reason?.trim() || !input.lotCode?.trim())
      throw new BadRequestException(
        'Lot code and correction reason are required',
      );
    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.stockBatch.findUniqueOrThrow({ where: { id } });
      const product = await lockProduct(tx, batch.productId);
      const expiry = input.expirationDate
        ? calendarDate(input.expirationDate)
        : null;
      if (product.expirationTracked && !expiry)
        throw new BadRequestException('Expiration date required');
      const updated = await tx.stockBatch.update({
        where: { id },
        data: {
          lotCode: input.lotCode.trim().slice(0, 100),
          expirationDate: expiry,
        },
      });
      await syncProduct(tx, batch.productId);
      await audit(tx, operator, 'stock_batches', id, 'metadata', {
        before: {
          lotCode: batch.lotCode,
          expirationDate: batch.expirationDate,
        },
        after: input,
      });
      return updated;
    });
  }

  async isOwner(userId: number, tx: Prisma.TransactionClient = this.prisma) {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { roles: { select: { name: true } } },
    });
    return user.roles.some((r) => ['Admin', 'Store Owner'].includes(r.name));
  }

  async shifts(operator: Operator) {
    const owner = await this.isOwner(operator.id);
    const rows = await this.prisma.registerShift.findMany({
      where: owner ? {} : { cashierId: operator.id },
      include: {
        cashier: { select: { email: true } },
        cashMovements: true,
        sales: true,
      },
      orderBy: { id: 'desc' },
      take: 100,
    });
    return rows.map((s) => ({
      ...s,
      sales: undefined,
      reconciliation: s.reconciliation ?? this.reconcile(s),
    }));
  }

  async openShift(
    input: { openingCash: string; drawer: string },
    operator: Operator,
  ) {
    const openingCash = amount(input.openingCash);
    const drawer = input.drawer?.trim().toUpperCase();
    if (!drawer || drawer.length > 80)
      throw new BadRequestException('Drawer name is required');
    return this.prisma.$transaction(async (tx) => {
      await lockKey(tx, `cashier:${operator.id}`);
      await lockKey(tx, `drawer:${drawer}`);
      if (
        await tx.registerShift.findFirst({
          where: {
            closedAt: null,
            OR: [{ cashierId: operator.id }, { drawer }],
          },
        })
      )
        throw new ConflictException(
          'Cashier or drawer already has an open shift',
        );
      const shift = await tx.registerShift.create({
        data: { cashierId: operator.id, drawer, openingCash },
      });
      await audit(tx, operator, 'register_shifts', shift.id, 'opened', {
        openingCash,
        drawer,
      });
      return shift;
    });
  }

  async cashMovement(
    id: number,
    input: { amount: string; reason: string; requestId: string },
    operator: Operator,
  ) {
    const value = amount(input.amount, true);
    const key = requestKey(input.requestId);
    if (
      value.isZero() ||
      !input.reason?.trim() ||
      input.reason.trim().length > 500
    )
      throw new BadRequestException('A nonzero amount and reason are required');
    return this.prisma.$transaction(async (tx) => {
      await lockKey(tx, `cash-movement:${key}`);
      const previous = await tx.shiftCashMovement.findUnique({
        where: { requestId: key },
        include: { shift: true },
      });
      if (previous) {
        if (
          previous.shiftId !== id ||
          previous.shift.cashierId !== operator.id ||
          !previous.amount.equals(value) ||
          previous.reason !== input.reason.trim()
        )
          throw new ConflictException('Request ID already used');
        return previous;
      }
      await this.lockOwnOpenShift(tx, id, operator);
      const shift = await tx.registerShift.findUniqueOrThrow({
        where: { id },
        include: { sales: true, cashMovements: true },
      });
      if (
        new Prisma.Decimal(this.reconcile(shift).expected.cash)
          .plus(value)
          .isNegative()
      )
        throw new BadRequestException(
          'Cash withdrawal exceeds the expected drawer balance',
        );
      const row = await tx.shiftCashMovement.create({
        data: {
          shiftId: id,
          amount: value,
          reason: input.reason.trim().slice(0, 500),
          requestId: key,
        },
      });
      await audit(tx, operator, 'register_shifts', id, 'cash_movement', {
        amount: value,
        reason: row.reason,
      });
      return row;
    });
  }

  async closeShift(id: number, input: CloseInput, operator: Operator) {
    const counts = {
      cash: amount(input.countedCash),
      debit: amount(input.countedDebit),
      credit: amount(input.countedCredit),
      other: amount(input.countedOther),
    };
    return this.prisma.$transaction(async (tx) => {
      await this.lockOwnOpenShift(tx, id, operator);
      const shift = await tx.registerShift.findUniqueOrThrow({
        where: { id },
        include: { sales: true, cashMovements: true },
      });
      const summary = this.reconcile(shift);
      const reconciliation = {
        ...summary,
        counted: Object.fromEntries(
          Object.entries(counts).map(([key, value]) => [key, value.toFixed(2)]),
        ),
        variance: Object.fromEntries(
          Object.entries(counts).map(([key, value]) => [
            key,
            value
              .minus(summary.expected[key as keyof typeof summary.expected])
              .toFixed(2),
          ]),
        ),
      };
      if (
        Object.values(reconciliation.variance).some((v) => v !== '0.00') &&
        !input.notes?.trim()
      )
        throw new BadRequestException(
          'Explain the reconciliation difference before closing',
        );
      const closed = await tx.registerShift.update({
        where: { id },
        data: {
          closedAt: new Date(),
          countedCash: counts.cash,
          countedDebit: counts.debit,
          countedCredit: counts.credit,
          countedOther: counts.other,
          reconciliation,
          notes: input.notes?.trim().slice(0, 2000),
        },
      });
      await audit(
        tx,
        operator,
        'register_shifts',
        id,
        'closed',
        reconciliation,
      );
      return closed;
    });
  }

  private async lockOwnOpenShift(
    tx: Prisma.TransactionClient,
    id: number,
    operator: Operator,
  ) {
    integer(id);
    await tx.$queryRaw`SELECT id FROM register_shifts WHERE id = ${id} FOR UPDATE`;
    const shift = await tx.registerShift.findUniqueOrThrow({ where: { id } });
    if (shift.cashierId !== operator.id)
      throw new ForbiddenException(
        'Only this shift’s cashier can record counts or cash movements',
      );
    if (shift.closedAt) throw new ConflictException('Shift is already closed');
    return shift;
  }

  private reconcile(shift: {
    openingCash: Prisma.Decimal;
    sales: {
      isVoided: boolean;
      total: Prisma.Decimal;
      paymentMethod: string;
    }[];
    cashMovements: { amount: Prisma.Decimal }[];
  }) {
    const payments = {
      cash: new Prisma.Decimal(0),
      debit: new Prisma.Decimal(0),
      credit: new Prisma.Decimal(0),
      other: new Prisma.Decimal(0),
    };
    for (const sale of shift.sales)
      if (!sale.isVoided)
        payments[sale.paymentMethod as keyof typeof payments] = payments[
          sale.paymentMethod as keyof typeof payments
        ].plus(sale.total);
    const cashChange = shift.cashMovements.reduce(
      (sum, m) => sum.plus(m.amount),
      new Prisma.Decimal(0),
    );
    return {
      businessDate: storeDate(),
      saleCount: shift.sales.filter((s) => !s.isVoided).length,
      voidCount: shift.sales.filter((s) => s.isVoided).length,
      openingCash: shift.openingCash.toFixed(2),
      cashMovementTotal: cashChange.toFixed(2),
      payments: Object.fromEntries(
        Object.entries(payments).map(([k, v]) => [k, v.toFixed(2)]),
      ),
      expected: {
        cash: shift.openingCash.plus(payments.cash).plus(cashChange).toFixed(2),
        debit: payments.debit.toFixed(2),
        credit: payments.credit.toFixed(2),
        other: payments.other.toFixed(2),
      },
    };
  }
}

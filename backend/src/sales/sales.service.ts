import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PaymentMethod, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  amount,
  audit,
  dateRange,
  hash,
  integer,
  lockKey,
  requestKey,
  storeDate,
} from '../store-operations/common';
import {
  consumeStock,
  lockProduct,
  restoreSaleItem,
} from '../store-operations/stock';
import { CreateSaleDto, SaleItemInput } from './dto/create-sale.dto';
import { QuerySalesDto } from './dto/query-sales.dto';
import {
  VOID_REASON_CODES,
  VoidReasonCode,
  VoidSaleDto,
} from './dto/void-sale.dto';

const DEFAULT_TAX_RATE = 0.14975; // QC TPS + TVQ
const CASHIER_VOID_WINDOW_MS = 10 * 60 * 1000;
const LARGE_VOID_THRESHOLD = new Prisma.Decimal(100);

const saleInclude = {
  shift: { select: { closedAt: true } },
  cashier: { select: { id: true, email: true } },
  voidedBy: { select: { id: true, email: true } },
  voidApprovedBy: { select: { id: true, email: true } },
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
        },
      },
    },
  },
} satisfies Prisma.SaleInclude;

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditTrailService: AuditTrailService,
  ) {}

  async getSales(query: QuerySalesDto) {
    const {
      sortField = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      pageSize = 20,
    } = query;

    const where = this.buildWhere(query);
    const [total, list] = await this.prisma.$transaction([
      this.prisma.sale.count({ where }),
      this.prisma.sale.findMany({
        where,
        include: saleInclude,
        orderBy: { [sortField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { total, list, page, pageSize };
  }

  async findById(id: number) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: saleInclude,
    });

    if (!sale) {
      throw new NotFoundException(`Sale ${id} not found`);
    }

    return sale;
  }

  async getRecentSales(
    operator: { id: number; email: string },
    requestedLimit = 10,
  ) {
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 50)
      : 10;
    const isOwner = await this.isStoreOwner(operator.id);
    const sales = await this.prisma.sale.findMany({
      where: isOwner ? undefined : { cashierId: operator.id },
      include: saleInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const now = new Date();

    return sales.map((sale) => ({
      ...sale,
      voidPolicy: this.getVoidPolicy(sale, operator.id, isOwner, now),
    }));
  }

  async getDailySummary(date?: string) {
    const { start, end, date: businessDate } = dateRange(date);

    const [sales, topProducts] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where: {
          isVoided: false,
          createdAt: { gte: start, lt: end },
        },
        select: {
          subtotal: true,
          tax: true,
          total: true,
          profitEstimate: true,
          paymentMethod: true,
        },
      }),
      this.prisma.saleItem.groupBy({
        by: ['productId'],
        where: {
          sale: {
            isVoided: false,
            createdAt: { gte: start, lt: end },
          },
        },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ]);

    const totalRevenue = sales.reduce(
      (sum, s) => sum.plus(s.total),
      new Prisma.Decimal(0),
    );
    const totalProfit = sales.reduce(
      (sum, s) => sum.plus(s.profitEstimate ?? 0),
      new Prisma.Decimal(0),
    );
    const saleCount = sales.length;

    const productIds = topProducts.map((row) => row.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p.name]));

    const topSellers = topProducts.map((row) => ({
      productId: row.productId,
      productName: productMap.get(row.productId) ?? 'Unknown',
      quantitySold: row._sum?.quantity ?? 0,
      revenue: row._sum?.lineTotal ?? new Prisma.Decimal(0),
    }));

    return {
      date: businessDate,
      timeZone: 'America/Toronto',
      saleCount,
      totalRevenue,
      totalProfit,
      topSellers,
    };
  }

  async createSale(
    data: CreateSaleDto,
    operator: { id: number; email: string },
  ) {
    if (
      !Array.isArray(data.items) ||
      !data.items.length ||
      data.items.length > 200
    )
      throw new BadRequestException('Provide 1–200 sale lines');
    const key = requestKey(data.requestId);
    const fingerprint = hash({ data, userId: operator.id });
    const taxRate = this.normalizeTaxRate(data.taxRate ?? DEFAULT_TAX_RATE);
    const paymentMethod = this.normalizePaymentMethod(data.paymentMethod);
    return this.prisma.$transaction(
      async (tx) => {
        await lockKey(tx, 'sale:' + key);
        const previous = await tx.sale.findUnique({
          where: { requestId: key },
          include: saleInclude,
        });
        if (previous) {
          if (previous.requestHash !== fingerprint)
            throw new ConflictException(
              'Request ID already used for different sale data',
            );
          return previous;
        }
        const shiftId = integer(data.shiftId);
        await tx.$queryRaw`SELECT id FROM register_shifts WHERE id = ${shiftId} FOR UPDATE`;
        const shift = await tx.registerShift.findUniqueOrThrow({
          where: { id: shiftId },
        });
        if (shift.cashierId !== operator.id || shift.closedAt)
          throw new BadRequestException(
            'Open your own register shift before recording sales',
          );
        for (const id of [
          ...new Set(data.items.map((i) => integer(i.productId))),
        ].sort((a, b) => a - b))
          await lockProduct(tx, id);
        const resolvedItems = await this.resolveItems(data.items, tx);
        const saleNumber = this.generateSaleNumber();
        const subtotal = resolvedItems.reduce(
          (sum, i) => sum.plus(i.lineTotal),
          new Prisma.Decimal(0),
        );
        const tax = subtotal.times(taxRate).toDecimalPlaces(2);
        const sale = await tx.sale.create({
          data: {
            saleNumber,
            requestId: key,
            requestHash: fingerprint,
            shiftId,
            cashierId: operator.id,
            subtotal,
            tax,
            total: subtotal.plus(tax),
            paymentMethod,
          },
        });
        let profit = new Prisma.Decimal(0);
        for (const item of resolvedItems) {
          const stock = await consumeStock(
            tx,
            {
              productId: item.productId,
              quantity: item.quantity,
              type: 'sale',
              referenceType: 'sale',
              referenceId: sale.id,
              reason: saleNumber,
            },
            operator,
          );
          profit = profit.plus(item.lineTotal.minus(stock.costTotal));
          await tx.saleItem.create({
            data: {
              saleId: sale.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unitCost: stock.costTotal.div(item.quantity).toDecimalPlaces(2),
              costTotal: stock.costTotal,
              lineTotal: item.lineTotal,
              categoryIdSnapshot: item.categoryId,
              categoryNameSnapshot: item.categoryName,
              allocations: { create: stock.allocations },
            },
          });
        }
        await tx.sale.update({
          where: { id: sale.id },
          data: { profitEstimate: profit },
        });
        await audit(tx, operator, 'sales', sale.id, '[created]', {
          saleNumber,
          shiftId,
        });
        return tx.sale.findUniqueOrThrow({
          where: { id: sale.id },
          include: saleInclude,
        });
      },
      { timeout: 30000 },
    );
  }

  async voidSale(
    id: number,
    data: VoidSaleDto,
    operator: { id: number; email: string },
  ) {
    const reason = this.normalizeVoidReason(data.reason);
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: saleInclude,
    });

    if (!sale) {
      throw new NotFoundException(`Sale ${id} not found`);
    }
    if (sale.isVoided) {
      throw new ConflictException(`Sale ${sale.saleNumber} is already voided`);
    }

    const isOwner = await this.isStoreOwner(operator.id);
    if (sale.cashierId !== operator.id && !isOwner) {
      throw new ForbiddenException('You can only void your own sales');
    }

    const voidedAt = new Date();
    if (
      !isOwner &&
      voidedAt.getTime() - sale.createdAt.getTime() > CASHIER_VOID_WINDOW_MS
    ) {
      throw new ForbiddenException(
        'Cashiers can only void their own sales within 10 minutes',
      );
    }

    const approvedBy = isOwner
      ? null
      : await this.verifyLargeVoidApproval(sale.total, data);
    const voidedSale = await this.prisma.$transaction(async (tx) => {
      if (!sale.shiftId)
        throw new BadRequestException(
          'Historical unassigned sales cannot be voided through shift checkout',
        );
      await tx.$queryRaw`SELECT id FROM register_shifts WHERE id = ${sale.shiftId} FOR UPDATE`;
      const shift = await tx.registerShift.findUniqueOrThrow({
        where: { id: sale.shiftId },
      });
      if (shift.closedAt || storeDate(sale.createdAt) !== storeDate())
        throw new ConflictException(
          'Closed-shift or prior-day sales require a separate return, not a void',
        );
      for (const productId of [
        ...new Set(sale.items.map((i) => i.productId)),
      ].sort((a, b) => a - b))
        await lockProduct(tx, productId);
      const updateResult = await tx.sale.updateMany({
        where: { id, isVoided: false },
        data: {
          isVoided: true,
          voidedAt,
          voidReason: reason,
          voidedById: operator.id,
          voidApprovedById: approvedBy?.id ?? null,
        },
      });

      if (updateResult.count !== 1) {
        throw new ConflictException(
          `Sale ${sale.saleNumber} is already voided`,
        );
      }

      for (const item of sale.items)
        await restoreSaleItem(tx, item.id, operator, sale.id);
      await audit(tx, operator, 'sales', sale.id, 'isVoided', {
        reason,
        approvedBy: approvedBy?.email,
      });

      return tx.sale.findUniqueOrThrow({
        where: { id },
        include: saleInclude,
      });
    });

    return voidedSale;
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  private async resolveItems(
    items: SaleItemInput[],
    tx: Prisma.TransactionClient,
  ) {
    const productIds = [...new Set(items.map((i) => i.productId))];
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: {
        id: true,
        name: true,
        categoryId: true,
        category: { select: { name: true } },
        sellingPrice: true,
        costPrice: true,
        currentStock: true,
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    return items.map((item) => {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new BadRequestException(
          `quantity must be a positive integer for product ${item.productId}`,
        );
      }

      const product = productMap.get(item.productId);
      if (!product) {
        throw new NotFoundException(
          `Product ${item.productId} not found or inactive`,
        );
      }

      const unitPrice =
        item.unitPrice != null ? amount(item.unitPrice) : product.sellingPrice;

      if (unitPrice.isNegative()) {
        throw new BadRequestException(
          `unitPrice must be zero or greater for product ${item.productId}`,
        );
      }

      const unitCost = product.costPrice;
      const lineTotal = unitPrice.times(item.quantity).toDecimalPlaces(2);
      const lineProfit = unitPrice
        .minus(unitCost)
        .times(item.quantity)
        .toDecimalPlaces(2);

      return {
        productId: item.productId,
        productName: product.name,
        categoryId: product.categoryId,
        categoryName: product.category?.name ?? 'Uncategorized',
        quantity: item.quantity,
        unitPrice,
        unitCost,
        lineTotal,
        lineProfit,
      };
    });
  }

  private buildWhere(query: QuerySalesDto): Prisma.SaleWhereInput {
    const and: Prisma.SaleWhereInput[] = [];

    if (query.filterPaymentMethods) {
      const methods = query.filterPaymentMethods
        .split(',')
        .map((v) => v.trim())
        .filter((v): v is PaymentMethod =>
          Object.values(PaymentMethod).includes(v as PaymentMethod),
        );
      if (methods.length) {
        and.push({ paymentMethod: { in: methods } });
      }
    }

    if (query.filterCreatedDates) {
      const dates = query.filterCreatedDates
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      if (dates.length) {
        and.push({
          OR: dates.map((date) => {
            const { start, end } = dateRange(date);
            return { createdAt: { gte: start, lt: end } };
          }),
        });
      }
    }

    return and.length ? { AND: and } : {};
  }

  private async isStoreOwner(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        roles: {
          select: {
            name: true,
          },
        },
      },
    });

    return Boolean(
      user?.roles.some(
        (role) => role.name === 'Admin' || role.name === 'Store Owner',
      ),
    );
  }

  private getVoidPolicy(
    sale: {
      isVoided: boolean;
      cashierId: number | null;
      createdAt: Date;
      total: Prisma.Decimal;
      shift?: { closedAt: Date | null } | null;
    },
    operatorId: number,
    isOwner: boolean,
    now: Date,
  ) {
    const windowEndsAt = new Date(
      sale.createdAt.getTime() + CASHIER_VOID_WINDOW_MS,
    );
    let restriction:
      'already_voided' | 'not_own_sale' | 'window_expired' | null = null;

    if (sale.isVoided) {
      restriction = 'already_voided';
    } else if (!isOwner && sale.cashierId !== operatorId) {
      restriction = 'not_own_sale';
    } else if (
      sale.shift?.closedAt ||
      !sale.shift ||
      storeDate(sale.createdAt) !== storeDate(now) ||
      (!isOwner && now > windowEndsAt)
    ) {
      restriction = 'window_expired';
    }

    return {
      canVoid: restriction === null,
      restriction,
      requiresOwnerApproval:
        !isOwner &&
        restriction === null &&
        new Prisma.Decimal(sale.total).greaterThanOrEqualTo(
          LARGE_VOID_THRESHOLD,
        ),
      windowEndsAt: isOwner ? null : windowEndsAt.toISOString(),
      largeVoidThreshold: LARGE_VOID_THRESHOLD.toFixed(2),
    };
  }

  private normalizeVoidReason(reason: VoidReasonCode | undefined) {
    if (!reason || !VOID_REASON_CODES.includes(reason)) {
      throw new BadRequestException('A void reason must be selected');
    }
    return reason;
  }

  private async verifyLargeVoidApproval(
    total: Prisma.Decimal,
    data: VoidSaleDto,
  ) {
    if (new Prisma.Decimal(total).lessThan(LARGE_VOID_THRESHOLD)) {
      return null;
    }
    const ownerEmail = data.ownerEmail?.trim().toLowerCase();
    if (!ownerEmail || !data.ownerPassword) {
      throw new ForbiddenException(
        `Owner confirmation is required for voids of $${LARGE_VOID_THRESHOLD.toFixed(2)} or more`,
      );
    }

    const owner = await this.prisma.user.findUnique({
      where: { email: ownerEmail },
      select: {
        id: true,
        email: true,
        password: true,
        roles: { select: { name: true } },
      },
    });
    const hasOwnerRole = owner?.roles.some(
      (role) => role.name === 'Store Owner' || role.name === 'Admin',
    );
    const passwordMatches =
      owner && hasOwnerRole
        ? await bcrypt.compare(data.ownerPassword, owner.password)
        : false;

    if (!owner || !hasOwnerRole || !passwordMatches) {
      throw new UnauthorizedException('Owner confirmation failed');
    }

    return { id: owner.id, email: owner.email };
  }

  private normalizeTaxRate(rate: number) {
    if (
      typeof rate !== 'number' ||
      !Number.isFinite(rate) ||
      rate < 0 ||
      rate > 1
    ) {
      throw new BadRequestException('taxRate must be a number between 0 and 1');
    }
    return new Prisma.Decimal(rate);
  }

  private normalizePaymentMethod(method?: string): PaymentMethod {
    if (!method) return PaymentMethod.cash;
    if (Object.values(PaymentMethod).includes(method as PaymentMethod)) {
      return method as PaymentMethod;
    }
    throw new BadRequestException(`Invalid payment method: ${method}`);
  }

  private generateSaleNumber(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const uniquePart = randomUUID().slice(0, 8).toUpperCase();
    return `SALE-${datePart}-${uniquePart}`;
  }
}

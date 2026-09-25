import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InventoryMovementType, PaymentMethod, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { PrismaService } from '../prisma/prisma.service';
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
    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(targetDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 86400000);

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
      date: start.toISOString().split('T')[0],
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
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('Sale must have at least one item');
    }

    const taxRate = this.normalizeTaxRate(data.taxRate ?? DEFAULT_TAX_RATE);
    const paymentMethod = this.normalizePaymentMethod(data.paymentMethod);
    const saleNumber = this.generateSaleNumber();

    // Validate and resolve all products before opening the transaction
    const resolvedItems = await this.resolveItems(data.items);

    const sale = await this.prisma.$transaction(async (tx) => {
      // The conditional update is atomic, so concurrent checkouts cannot drive
      // stock below zero even when they target the same product.
      for (const item of resolvedItems) {
        const result = await tx.product.updateMany({
          where: {
            id: item.productId,
            isActive: true,
            currentStock: { gte: item.quantity },
          },
          data: { currentStock: { decrement: item.quantity } },
        });

        if (result.count !== 1) {
          throw new BadRequestException(
            `Insufficient stock for ${item.productName}`,
          );
        }
      }

      // Compute totals
      const subtotal = resolvedItems.reduce(
        (sum, item) => sum.plus(item.lineTotal),
        new Prisma.Decimal(0),
      );
      const tax = subtotal.times(taxRate).toDecimalPlaces(2);
      const total = subtotal.plus(tax);
      const profitEstimate = resolvedItems.reduce(
        (sum, item) => sum.plus(item.lineProfit),
        new Prisma.Decimal(0),
      );

      // Create sale and items
      const created = await tx.sale.create({
        data: {
          saleNumber,
          subtotal,
          tax,
          total,
          profitEstimate,
          paymentMethod,
          cashier: { connect: { id: operator.id } },
          items: {
            create: resolvedItems.map((item) => ({
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unitCost: item.unitCost,
              lineTotal: item.lineTotal,
              product: { connect: { id: item.productId } },
            })),
          },
        },
        include: saleInclude,
      });

      // Create inventory movements for each item
      for (const item of resolvedItems) {
        await tx.inventoryMovement.create({
          data: {
            type: InventoryMovementType.sale,
            quantity: -item.quantity,
            unitCost: item.unitCost,
            reason: `Sale ${saleNumber}`,
            referenceType: 'sale',
            referenceId: created.id,
            product: { connect: { id: item.productId } },
            user: { connect: { id: operator.id } },
          },
        });
      }

      return created;
    });

    // Audit log outside the transaction
    await this.auditTrailService.create({
      table: 'sales',
      recordId: sale.id,
      field: '[created]',
      oldValue: null,
      newValue: `${saleNumber} - $${sale.total}`,
      userId: operator.id,
      userEmail: operator.email,
    });

    return sale;
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

      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { increment: item.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            type: InventoryMovementType.return_item,
            quantity: item.quantity,
            unitCost: item.unitCost,
            reason: `Voided sale ${sale.saleNumber}: ${reason}`,
            referenceType: 'sale_void',
            referenceId: sale.id,
            product: { connect: { id: item.productId } },
            user: { connect: { id: operator.id } },
          },
        });
      }

      return tx.sale.findUniqueOrThrow({
        where: { id },
        include: saleInclude,
      });
    });

    await this.auditTrailService.create({
      table: 'sales',
      recordId: sale.id,
      field: 'isVoided',
      oldValue: 'false',
      newValue: approvedBy
        ? `true - ${reason} - approved by ${approvedBy.email}`
        : `true - ${reason}`,
      userId: operator.id,
      userEmail: operator.email,
    });

    return voidedSale;
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  private async resolveItems(items: SaleItemInput[]) {
    const productIds = [...new Set(items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: {
        id: true,
        name: true,
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
        item.unitPrice != null
          ? new Prisma.Decimal(item.unitPrice)
          : product.sellingPrice;

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
            const start = new Date(`${date}T00:00:00.000Z`);
            const end = new Date(start.getTime() + 86400000);
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
    },
    operatorId: number,
    isOwner: boolean,
    now: Date,
  ) {
    const windowEndsAt = new Date(
      sale.createdAt.getTime() + CASHIER_VOID_WINDOW_MS,
    );
    let restriction:
      | 'already_voided'
      | 'not_own_sale'
      | 'window_expired'
      | null = null;

    if (sale.isVoided) {
      restriction = 'already_voided';
    } else if (!isOwner && sale.cashierId !== operatorId) {
      restriction = 'not_own_sale';
    } else if (!isOwner && now > windowEndsAt) {
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
    if (typeof rate !== 'number' || rate < 0 || rate > 1) {
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

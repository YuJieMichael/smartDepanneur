import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryMovementType, PaymentMethod, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto, SaleItemInput } from './dto/create-sale.dto';
import { QuerySalesDto } from './dto/query-sales.dto';

const DEFAULT_TAX_RATE = 0.14975; // QC TPS + TVQ

const saleInclude = {
  cashier: { select: { id: true, email: true } },
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

  async getDailySummary(date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(targetDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 86400000);

    const [sales, topProducts] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where: { createdAt: { gte: start, lt: end } },
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
        where: { sale: { createdAt: { gte: start, lt: end } } },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ]);

    const totalRevenue = sales.reduce((sum, s) => sum.plus(s.total), new Prisma.Decimal(0));
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

  async createSale(data: CreateSaleDto, operator: { id: number; email: string }) {
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
        throw new BadRequestException(`quantity must be a positive integer for product ${item.productId}`);
      }

      const product = productMap.get(item.productId);
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found or inactive`);
      }

      const unitPrice =
        item.unitPrice != null
          ? new Prisma.Decimal(item.unitPrice)
          : product.sellingPrice;

      if (unitPrice.isNegative()) {
        throw new BadRequestException(`unitPrice must be zero or greater for product ${item.productId}`);
      }

      const unitCost = product.costPrice;
      const lineTotal = unitPrice.times(item.quantity).toDecimalPlaces(2);
      const lineProfit = unitPrice.minus(unitCost).times(item.quantity).toDecimalPlaces(2);

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
      const dates = query.filterCreatedDates.split(',').map((v) => v.trim()).filter(Boolean);
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

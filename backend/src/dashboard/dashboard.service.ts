import { BadRequestException, Injectable } from '@nestjs/common';
import { calendarDate, dateRange, storeDate } from '../store-operations/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const STORE_TIME_ZONE = 'America/Toronto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const { start: todayStart, end: todayEnd } = this.getStoreDateRange();

    const expiryStart = calendarDate(storeDate());
    const batchExpiry = {
      quantityRemaining: { gt: 0 },
      product: { isActive: true },
      expirationDate: {
        gte: expiryStart,
        lte: new Date(expiryStart.getTime() + 7 * 86400000),
      },
    };
    const [
      totalProducts,
      activeProducts,
      lowStockProducts,
      expiringProducts,
      todaySales,
      todayVoidedSales,
      topSellersRaw,
      expiringList,
    ] = await this.prisma.$transaction([
      this.prisma.product.count(),
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.product.count({
        where: {
          isActive: true,
          currentStock: { lte: this.prisma.product.fields.minStock },
        },
      }),
      this.prisma.stockBatch.count({ where: batchExpiry }),
      this.prisma.sale.findMany({
        where: {
          isVoided: false,
          createdAt: { gte: todayStart, lt: todayEnd },
        },
        select: { total: true, profitEstimate: true },
      }),
      this.prisma.sale.findMany({
        where: {
          isVoided: true,
          voidedAt: { gte: todayStart, lt: todayEnd },
        },
        select: { total: true },
      }),
      this.prisma.saleItem.groupBy({
        by: ['productId'],
        where: { sale: { isVoided: false } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      this.prisma.stockBatch.findMany({
        where: batchExpiry,
        include: {
          product: {
            select: {
              name: true,
              supplier: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { expirationDate: 'asc' },
        take: 10,
      }),
    ]);

    const todayRevenue = todaySales.reduce(
      (sum, s) => sum.plus(s.total),
      new Prisma.Decimal(0),
    );
    const todayProfit = todaySales.reduce(
      (sum, s) => sum.plus(s.profitEstimate ?? 0),
      new Prisma.Decimal(0),
    );
    const todaySaleCount = todaySales.length;
    const todayVoidAmount = todayVoidedSales.reduce(
      (sum, sale) => sum.plus(sale.total),
      new Prisma.Decimal(0),
    );

    const topProductIds = topSellersRaw.map((r) => r.productId);
    const topProducts = await this.prisma.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true, currentStock: true },
    });
    const productMap = new Map(topProducts.map((p) => [p.id, p]));
    const topSellers = topSellersRaw.map((r) => ({
      productId: r.productId,
      productName: productMap.get(r.productId)?.name ?? 'Unknown',
      currentStock: productMap.get(r.productId)?.currentStock ?? 0,
      totalSold: r._sum?.quantity ?? 0,
    }));

    const lowStockList = await this.prisma.product.findMany({
      where: {
        isActive: true,
        currentStock: { lte: this.prisma.product.fields.minStock },
      },
      select: {
        id: true,
        name: true,
        currentStock: true,
        minStock: true,
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { currentStock: 'asc' },
      take: 10,
    });

    return {
      products: {
        total: totalProducts,
        active: activeProducts,
        lowStock: lowStockProducts,
        expiringSoon: expiringProducts,
      },
      today: {
        saleCount: todaySaleCount,
        revenue: todayRevenue,
        profit: todayProfit,
        voidCount: todayVoidedSales.length,
        voidAmount: todayVoidAmount,
      },
      topSellers,
      lowStockList,
      expiringList: expiringList.map((batch) => ({
        id: batch.id,
        productId: batch.productId,
        name: `${batch.product.name} · ${batch.lotCode}`,
        currentStock: batch.quantityRemaining,
        expirationDate: batch.expirationDate,
        supplier: batch.product.supplier,
      })),
    };
  }

  async getDailyCloseout(dateInput?: string) {
    const { date, start, end } = this.getStoreDateRange(dateInput);
    const sales = await this.prisma.sale.findMany({
      where: {
        isVoided: false,
        createdAt: { gte: start, lt: end },
      },
      select: {
        subtotal: true,
        tax: true,
        total: true,
        profitEstimate: true,
        items: {
          select: {
            quantity: true,
            lineTotal: true,
            unitCost: true,
            costTotal: true,
            categoryIdSnapshot: true,
            categoryNameSnapshot: true,
            product: {
              select: {
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    const zero = new Prisma.Decimal(0);
    const subtotal = sales.reduce((sum, sale) => sum.plus(sale.subtotal), zero);
    const tax = sales.reduce((sum, sale) => sum.plus(sale.tax), zero);
    const revenue = sales.reduce((sum, sale) => sum.plus(sale.total), zero);
    const grossProfit = sales.reduce(
      (sum, sale) => sum.plus(sale.profitEstimate ?? 0),
      zero,
    );
    const categories = new Map<
      string,
      {
        categoryId: number | null;
        categoryName: string;
        quantity: number;
        revenue: Prisma.Decimal;
        grossProfit: Prisma.Decimal;
      }
    >();

    for (const sale of sales) {
      for (const item of sale.items) {
        const category = {
          id: item.categoryIdSnapshot,
          name: item.categoryNameSnapshot,
        };
        const key =
          category.id !== null ? String(category.id) : 'uncategorized';
        const current = categories.get(key) ?? {
          categoryId: category?.id ?? null,
          categoryName: category?.name ?? 'Uncategorized',
          quantity: 0,
          revenue: new Prisma.Decimal(0),
          grossProfit: new Prisma.Decimal(0),
        };
        const itemCost =
          item.costTotal ??
          new Prisma.Decimal(item.unitCost ?? 0).times(item.quantity);

        current.quantity += item.quantity;
        current.revenue = current.revenue.plus(item.lineTotal);
        current.grossProfit = current.grossProfit.plus(
          item.lineTotal.minus(itemCost),
        );
        categories.set(key, current);
      }
    }

    const categoryRows = [...categories.values()]
      .sort((a, b) => b.revenue.comparedTo(a.revenue))
      .map((row) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        quantity: row.quantity,
        revenue: row.revenue.toFixed(2),
        grossProfit: row.grossProfit.toFixed(2),
        grossMargin: row.revenue.isZero()
          ? '0.00'
          : row.grossProfit.dividedBy(row.revenue).times(100).toFixed(2),
      }));

    return {
      date,
      timeZone: STORE_TIME_ZONE,
      generatedAt: new Date().toISOString(),
      saleCount: sales.length,
      totals: {
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        revenue: revenue.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        grossMargin: subtotal.isZero()
          ? '0.00'
          : grossProfit.dividedBy(subtotal).times(100).toFixed(2),
      },
      categories: categoryRows,
    };
  }

  async getSalesTrend(days = 7) {
    if (!Number.isInteger(days) || days < 2 || days > 31) {
      throw new BadRequestException('days must be an integer between 2 and 31');
    }

    const { date: today, end } = this.getStoreDateRange();
    const [year, month, day] = today.split('-').map(Number);
    const dates = Array.from({ length: days }, (_, index) => {
      const offset = index - (days - 1);
      return new Date(Date.UTC(year, month - 1, day + offset))
        .toISOString()
        .slice(0, 10);
    });
    const start = this.storeMidnightToUtc(dates[0]);
    const sales = await this.prisma.sale.findMany({
      where: {
        isVoided: false,
        createdAt: { gte: start, lt: end },
      },
      select: {
        createdAt: true,
        total: true,
        profitEstimate: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const buckets = new Map(
      dates.map((date) => [
        date,
        {
          date,
          saleCount: 0,
          revenue: new Prisma.Decimal(0),
          profit: new Prisma.Decimal(0),
        },
      ]),
    );

    for (const sale of sales) {
      const saleDate = this.formatStoreDate(sale.createdAt);
      const bucket = buckets.get(saleDate);
      if (!bucket) continue;

      bucket.saleCount += 1;
      bucket.revenue = bucket.revenue.plus(sale.total);
      bucket.profit = bucket.profit.plus(sale.profitEstimate ?? 0);
    }

    const points = dates.map((date) => {
      const bucket = buckets.get(date)!;
      return {
        date,
        saleCount: bucket.saleCount,
        revenue: bucket.revenue.toFixed(2),
        profit: bucket.profit.toFixed(2),
      };
    });
    const latest = points.at(-1)!;
    const previous = points.at(-2)!;

    return {
      timeZone: STORE_TIME_ZONE,
      days,
      points,
      comparison: {
        saleCountDelta: latest.saleCount - previous.saleCount,
        revenueChangePercent: this.calculatePercentChange(
          latest.revenue,
          previous.revenue,
        ),
        profitChangePercent: this.calculatePercentChange(
          latest.profit,
          previous.profit,
        ),
      },
    };
  }

  private getStoreDateRange(dateInput?: string) {
    return dateRange(dateInput);
  }
  private storeMidnightToUtc(date: string) {
    return dateRange(date).start;
  }
  private formatStoreDate(value: Date) {
    return storeDate(value);
  }

  private calculatePercentChange(currentValue: string, previousValue: string) {
    const current = new Prisma.Decimal(currentValue);
    const previous = new Prisma.Decimal(previousValue);

    if (previous.isZero()) {
      return current.isZero() ? '0.00' : null;
    }

    return current
      .minus(previous)
      .dividedBy(previous.abs())
      .times(100)
      .toFixed(2);
  }
}

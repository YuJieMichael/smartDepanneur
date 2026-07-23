import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const STORE_TIME_ZONE = 'America/Toronto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const { start: todayStart, end: todayEnd } = this.getStoreDateRange();

    const [
      totalProducts,
      activeProducts,
      lowStockProducts,
      expiringProducts,
      todaySales,
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
      this.prisma.product.count({
        where: {
          isActive: true,
          expirationTracked: true,
          expirationDate: {
            gte: todayStart,
            lte: new Date(todayStart.getTime() + 7 * 86400000),
          },
        },
      }),
      this.prisma.sale.findMany({
        where: { createdAt: { gte: todayStart, lt: todayEnd } },
        select: { total: true, profitEstimate: true },
      }),
      this.prisma.saleItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      this.prisma.product.findMany({
        where: {
          isActive: true,
          expirationTracked: true,
          expirationDate: {
            gte: todayStart,
            lte: new Date(todayStart.getTime() + 7 * 86400000),
          },
        },
        select: {
          id: true,
          name: true,
          currentStock: true,
          expirationDate: true,
          supplier: { select: { id: true, name: true } },
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
      },
      topSellers,
      lowStockList,
      expiringList,
    };
  }

  async getDailyCloseout(dateInput?: string) {
    const { date, start, end } = this.getStoreDateRange(dateInput);
    const sales = await this.prisma.sale.findMany({
      where: { createdAt: { gte: start, lt: end } },
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
        const category = item.product.category;
        const key = category ? String(category.id) : 'uncategorized';
        const current = categories.get(key) ?? {
          categoryId: category?.id ?? null,
          categoryName: category?.name ?? 'Uncategorized',
          quantity: 0,
          revenue: new Prisma.Decimal(0),
          grossProfit: new Prisma.Decimal(0),
        };
        const itemCost = new Prisma.Decimal(item.unitCost ?? 0).times(
          item.quantity,
        );

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

  private getStoreDateRange(dateInput?: string) {
    const date =
      dateInput ??
      new Intl.DateTimeFormat('en-CA', {
        timeZone: STORE_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date must use YYYY-MM-DD format');
    }

    const [year, month, day] = date.split('-').map(Number);
    const calendarDate = new Date(Date.UTC(year, month - 1, day));
    if (
      calendarDate.getUTCFullYear() !== year ||
      calendarDate.getUTCMonth() !== month - 1 ||
      calendarDate.getUTCDate() !== day
    ) {
      throw new BadRequestException('date is not a valid calendar date');
    }

    const nextCalendarDate = new Date(calendarDate.getTime() + 86400000);
    const nextDate = nextCalendarDate.toISOString().slice(0, 10);

    return {
      date,
      start: this.storeMidnightToUtc(date),
      end: this.storeMidnightToUtc(nextDate),
    };
  }

  private storeMidnightToUtc(date: string) {
    const [year, month, day] = date.split('-').map(Number);
    const utcGuess = new Date(Date.UTC(year, month - 1, day));
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: STORE_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const parts = Object.fromEntries(
      formatter
        .formatToParts(utcGuess)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)]),
    );
    const representedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const offset = representedAsUtc - utcGuess.getTime();

    return new Date(utcGuess.getTime() - offset);
  }
}

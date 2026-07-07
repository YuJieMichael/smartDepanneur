import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 86400000);

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
}

import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  it('creates a daily closeout grouped by category in the store time zone', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        subtotal: new Prisma.Decimal('15.00'),
        tax: new Prisma.Decimal('2.00'),
        total: new Prisma.Decimal('17.00'),
        profitEstimate: new Prisma.Decimal('7.00'),
        items: [
          {
            quantity: 2,
            lineTotal: new Prisma.Decimal('10.00'),
            unitCost: new Prisma.Decimal('3.00'),
            product: { category: { id: 1, name: 'Drinks' } },
          },
          {
            quantity: 1,
            lineTotal: new Prisma.Decimal('5.00'),
            unitCost: new Prisma.Decimal('2.00'),
            product: { category: { id: 2, name: 'Snacks' } },
          },
        ],
      },
      {
        subtotal: new Prisma.Decimal('5.00'),
        tax: new Prisma.Decimal('1.00'),
        total: new Prisma.Decimal('6.00'),
        profitEstimate: new Prisma.Decimal('2.00'),
        items: [
          {
            quantity: 1,
            lineTotal: new Prisma.Decimal('5.00'),
            unitCost: new Prisma.Decimal('3.00'),
            product: { category: { id: 1, name: 'Drinks' } },
          },
        ],
      },
    ]);
    const prisma = {
      sale: { findMany },
    } as unknown as PrismaService;
    const service = new DashboardService(prisma);

    const report = await service.getDailyCloseout('2026-07-23');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isVoided: false,
          createdAt: {
            gte: new Date('2026-07-23T04:00:00.000Z'),
            lt: new Date('2026-07-24T04:00:00.000Z'),
          },
        },
      }),
    );
    expect(report).toMatchObject({
      date: '2026-07-23',
      timeZone: 'America/Toronto',
      saleCount: 2,
      totals: {
        subtotal: '20.00',
        tax: '3.00',
        revenue: '23.00',
        grossProfit: '9.00',
        grossMargin: '45.00',
      },
      categories: [
        {
          categoryId: 1,
          categoryName: 'Drinks',
          quantity: 3,
          revenue: '15.00',
          grossProfit: '6.00',
          grossMargin: '40.00',
        },
        {
          categoryId: 2,
          categoryName: 'Snacks',
          quantity: 1,
          revenue: '5.00',
          grossProfit: '3.00',
          grossMargin: '60.00',
        },
      ],
    });
  });

  it('rejects an invalid report date', async () => {
    const service = new DashboardService({} as PrismaService);

    await expect(service.getDailyCloseout('2026-02-30')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('builds a store-local sales trend and compares it with yesterday', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-23T16:00:00.000Z'));
    try {
      const findMany = jest.fn().mockResolvedValue([
        {
          createdAt: new Date('2026-07-22T15:00:00.000Z'),
          total: new Prisma.Decimal('10.00'),
          profitEstimate: new Prisma.Decimal('4.00'),
        },
        {
          createdAt: new Date('2026-07-23T15:00:00.000Z'),
          total: new Prisma.Decimal('15.00'),
          profitEstimate: new Prisma.Decimal('6.00'),
        },
      ]);
      const prisma = {
        sale: { findMany },
      } as unknown as PrismaService;
      const service = new DashboardService(prisma);

      const report = await service.getSalesTrend(2);

      expect(findMany).toHaveBeenCalledWith({
        where: {
          isVoided: false,
          createdAt: {
            gte: new Date('2026-07-22T04:00:00.000Z'),
            lt: new Date('2026-07-24T04:00:00.000Z'),
          },
        },
        select: {
          createdAt: true,
          total: true,
          profitEstimate: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      expect(report).toMatchObject({
        timeZone: 'America/Toronto',
        days: 2,
        points: [
          {
            date: '2026-07-22',
            saleCount: 1,
            revenue: '10.00',
            profit: '4.00',
          },
          {
            date: '2026-07-23',
            saleCount: 1,
            revenue: '15.00',
            profit: '6.00',
          },
        ],
        comparison: {
          saleCountDelta: 0,
          revenueChangePercent: '50.00',
          profitChangePercent: '50.00',
        },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects an invalid sales trend range', async () => {
    const service = new DashboardService({} as PrismaService);

    await expect(service.getSalesTrend(1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

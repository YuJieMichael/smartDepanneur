import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InsightsService } from './insights.service';

describe('InsightsService', () => {
  it('uses sales velocity to calculate a fourteen-day reorder quantity', async () => {
    const prisma = {
      product: {
        fields: { minStock: 'minStock' },
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            name: 'Milk 2%',
            sku: 'MILK-2',
            barcode: null,
            unit: 'bottle',
            currentStock: 2,
            minStock: 5,
            costPrice: new Prisma.Decimal('3.00'),
            sellingPrice: new Prisma.Decimal('4.50'),
            supplier: { id: 1, name: 'Dairy Supplier' },
            category: { id: 1, name: 'Dairy' },
          },
        ]),
      },
      saleItem: {
        groupBy: jest.fn().mockResolvedValue([
          {
            productId: 1,
            _sum: { quantity: 7 },
          },
        ]),
      },
    } as unknown as PrismaService;
    const service = new InsightsService(prisma);

    const result = await service.getReorderSuggestions();

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({
      productName: 'Milk 2%',
      soldLast7Days: 7,
      suggestedReorderQty: 17,
      urgency: 'high',
    });
    expect(String(result.suggestions[0].estimatedCost)).toBe('51');
  });

  it('uses and records the deterministic fallback without an API key', async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const createLog = jest.fn().mockResolvedValue({ id: 1 });
    const prisma = {
      product: {
        fields: { minStock: 'minStock' },
        count: jest.fn().mockResolvedValue(10),
      },
      sale: {
        count: jest.fn().mockResolvedValue(2),
      },
      aiInsightLog: {
        create: createLog,
      },
      $transaction: jest.fn().mockResolvedValue([10, 2, 3]),
    } as unknown as PrismaService;
    const service = new InsightsService(prisma);

    try {
      const result = await service.ask('Give me a store summary', {
        id: 1,
        email: 'owner@smartdepanneur.local',
      });

      expect(result).toMatchObject({
        provider: 'local-fallback',
        fallbackReason: 'OPENAI_API_KEY is not configured',
      });
      expect(createLog).toHaveBeenCalledWith({
        data: expect.objectContaining({
          prompt: 'Give me a store summary',
        }),
      });
    } finally {
      if (previousKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = previousKey;
      }
    }
  });

  it('rejects an empty owner question', async () => {
    const service = new InsightsService({} as PrismaService);

    await expect(
      service.ask('   ', {
        id: 1,
        email: 'owner@smartdepanneur.local',
      }),
    ).rejects.toThrow('question is required');
  });
});

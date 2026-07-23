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
      const result = await service.ask(
        'Give me a store summary',
        'en',
        {
          id: 1,
          email: 'owner@smartdepanneur.local',
        },
      );

      expect(result).toMatchObject({
        language: 'en',
        provider: 'local-agent',
        toolsUsed: ['get_store_summary'],
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
      service.ask(
        '   ',
        'en',
        {
          id: 1,
          email: 'owner@smartdepanneur.local',
        },
      ),
    ).rejects.toThrow('question is required');
  });

  it('lets the OpenAI agent choose a store tool before answering in the selected language', async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    const previousFetch = global.fetch;
    process.env.OPENAI_API_KEY = 'test-key';
    const fetchMock: jest.MockedFunction<typeof fetch> = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          output: [
            {
              type: 'function_call',
              call_id: 'call_store_summary',
              name: 'get_store_summary',
              arguments: '{}',
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          output_text:
            'Résumé du magasin : 10 produits actifs et 2 ventes aujourd’hui.',
        }),
      } as Response);
    global.fetch = fetchMock;
    const prisma = {
      product: {
        fields: { minStock: 'minStock' },
        count: jest.fn().mockResolvedValue(10),
      },
      sale: {
        count: jest.fn().mockResolvedValue(2),
      },
      aiInsightLog: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
      },
      $transaction: jest.fn().mockResolvedValue([10, 2, 3]),
    } as unknown as PrismaService;
    const service = new InsightsService(prisma);

    try {
      const result = await service.ask(
        'Give me a store summary',
        'fr',
        {
          id: 1,
          email: 'owner@smartdepanneur.local',
        },
      );

      expect(result).toMatchObject({
        language: 'fr',
        provider: 'openai-agent',
        toolsUsed: ['get_store_summary'],
        fallbackReason: null,
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const firstBody = fetchMock.mock.calls[0]?.[1]?.body;
      const secondBody = fetchMock.mock.calls[1]?.[1]?.body;
      if (typeof firstBody !== 'string' || typeof secondBody !== 'string') {
        throw new Error('Expected JSON request bodies');
      }
      expect(firstBody).toContain('Quebec-friendly French');
      expect(firstBody).toContain('get_store_summary');
      expect(secondBody).toContain('function_call_output');
    } finally {
      global.fetch = previousFetch;
      if (previousKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = previousKey;
      }
    }
  });

  it.each([
    ['en', 'Store summary:'],
    ['fr', 'Résumé du magasin :'],
    ['zh', '门店概况：'],
  ] as const)(
    'answers only in the selected %s language',
    async (language, expectedPrefix) => {
      const previousKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      const prisma = {
        product: {
          fields: { minStock: 'minStock' },
          count: jest.fn().mockResolvedValue(10),
        },
        sale: {
          count: jest.fn().mockResolvedValue(2),
        },
        aiInsightLog: {
          create: jest.fn().mockResolvedValue({ id: 1 }),
        },
        $transaction: jest.fn().mockResolvedValue([10, 2, 3]),
      } as unknown as PrismaService;
      const service = new InsightsService(prisma);

      try {
        const result = await service.ask(
          'Give me a store summary',
          language,
          {
            id: 1,
            email: 'owner@smartdepanneur.local',
          },
        );

        expect(result.answer.startsWith(expectedPrefix)).toBe(true);
        expect(result.language).toBe(language);
      } finally {
        if (previousKey === undefined) {
          delete process.env.OPENAI_API_KEY;
        } else {
          process.env.OPENAI_API_KEY = previousKey;
        }
      }
    },
  );

  it('rejects an unsupported answer language', async () => {
    const service = new InsightsService({} as PrismaService);

    await expect(
      service.ask(
        'Give me a store summary',
        'es' as 'en',
        {
          id: 1,
          email: 'owner@smartdepanneur.local',
        },
      ),
    ).rejects.toThrow('language must be one of: en, fr, zh');
  });
});

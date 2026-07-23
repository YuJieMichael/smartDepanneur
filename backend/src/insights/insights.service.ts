import { BadRequestException, Injectable } from '@nestjs/common';
import { InsightType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const REORDER_DAYS_WINDOW = 7;
const SLOW_MOVER_DAYS_WINDOW = 30;
const TOP_SELLER_LIMIT = 10;
const SLOW_MOVER_LIMIT = 10;

export type InsightLanguage = 'en' | 'fr' | 'zh';
type InsightProvider = 'openai-agent' | 'local-agent';
type InsightAgentTool =
  | 'get_reorder_suggestions'
  | 'get_top_sellers'
  | 'get_slow_movers'
  | 'get_store_summary';

interface InsightAnswer {
  result: string;
  type: InsightType;
  provider: InsightProvider;
  toolsUsed: InsightAgentTool[];
}

interface OpenAiContent {
  text?: unknown;
}

interface OpenAiOutputItem {
  type?: unknown;
  call_id?: unknown;
  name?: unknown;
  arguments?: unknown;
  content?: unknown;
}

interface OpenAiResponsePayload {
  id?: unknown;
  output_text?: unknown;
  output?: unknown;
}

interface OpenAiFunctionCall {
  type: 'function_call';
  call_id: string;
  name: InsightAgentTool;
  arguments: string;
}

const AGENT_TOOLS: InsightAgentTool[] = [
  'get_reorder_suggestions',
  'get_top_sellers',
  'get_slow_movers',
  'get_store_summary',
];

const RESPONSE_TOOL_DEFINITIONS = [
  {
    type: 'function',
    name: 'get_reorder_suggestions',
    description:
      'Return products at or below minimum stock, recent sales velocity, recommended order quantities, suppliers, urgency, and estimated cost.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'get_top_sellers',
    description:
      'Return the best-selling products ranked by units sold, with revenue and current stock.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'get_slow_movers',
    description:
      'Return active products with stock but no sales in the last 30 days, including stock value and expiration information.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'get_store_summary',
    description:
      'Return today sale count, active product count, and low-stock product count.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
] as const;

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReorderSuggestions(language: InsightLanguage = 'en') {
    const normalizedLanguage = this.normalizeLanguage(language);
    const since = new Date(Date.now() - REORDER_DAYS_WINDOW * 86400000);

    const lowStockProducts = await this.prisma.product.findMany({
      where: {
        isActive: true,
        currentStock: { lte: this.prisma.product.fields.minStock },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        unit: true,
        currentStock: true,
        minStock: true,
        costPrice: true,
        sellingPrice: true,
        supplier: { select: { id: true, name: true, phone: true, email: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { currentStock: 'asc' },
    });

    if (lowStockProducts.length === 0) {
      return {
        suggestions: [],
        summary:
          normalizedLanguage === 'zh'
            ? '所有商品都高于最低库存线，暂时无需补货。'
            : normalizedLanguage === 'fr'
              ? 'Tous les produits sont au-dessus du stock minimum. Aucun réapprovisionnement nécessaire.'
              : 'All products are above their minimum stock threshold. No reorders needed.',
      };
    }

    const productIds = lowStockProducts.map((product) => product.id);
    const salesData = await this.prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        sale: { createdAt: { gte: since } },
      },
      _sum: { quantity: true },
    });
    const velocityMap = new Map(salesData.map((row) => [row.productId, row._sum?.quantity ?? 0]));

    const suggestions = lowStockProducts.map((product) => {
      const soldLast7Days = velocityMap.get(product.id) ?? 0;
      const dailyVelocity = soldLast7Days / REORDER_DAYS_WINDOW;
      const suggestedReorderQty = Math.max(
        1,
        Math.ceil(dailyVelocity * 14 + product.minStock - product.currentStock),
      );

      const urgency: 'critical' | 'high' | 'medium' =
        product.currentStock === 0 ? 'critical' : soldLast7Days > 0 ? 'high' : 'medium';

      const reason =
        normalizedLanguage === 'zh'
          ? product.currentStock === 0
            ? `${product.name} 已缺货。`
            : soldLast7Days > 0
              ? `${product.name} 过去 7 天卖出 ${soldLast7Days} 件，且库存低于最低线。`
              : `${product.name} 低于最低库存线（${product.currentStock}/${product.minStock}）。`
          : normalizedLanguage === 'fr'
            ? product.currentStock === 0
              ? `${product.name} est en rupture de stock.`
              : soldLast7Days > 0
                ? `${product.name} a vendu ${soldLast7Days} unité(s) en 7 jours et se trouve sous le stock minimum.`
                : `${product.name} est sous le stock minimum (${product.currentStock}/${product.minStock}).`
            : product.currentStock === 0
              ? `${product.name} is out of stock.`
              : soldLast7Days > 0
                ? `${product.name} sold ${soldLast7Days} units in the last 7 days and is below minimum stock.`
                : `${product.name} is below minimum stock threshold (${product.currentStock}/${product.minStock}).`;

      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unit: product.unit,
        currentStock: product.currentStock,
        minStock: product.minStock,
        soldLast7Days,
        suggestedReorderQty,
        estimatedCost: new Prisma.Decimal(product.costPrice).times(suggestedReorderQty),
        urgency,
        reason,
        supplier: product.supplier,
        category: product.category,
      };
    });

    const criticalCount = suggestions.filter((item) => item.urgency === 'critical').length;
    const highCount = suggestions.filter((item) => item.urgency === 'high').length;
    const summary =
      normalizedLanguage === 'zh'
        ? `${suggestions.length} 个商品需要补货。` +
          (criticalCount > 0 ? `${criticalCount} 个已经缺货。` : '') +
          (highCount > 0 ? `${highCount} 个近期有销量且库存偏低。` : '') +
          '建议在下一个繁忙时段前完成补货。'
        : normalizedLanguage === 'fr'
          ? `${suggestions.length} produit(s) doivent être réapprovisionnés. ` +
            (criticalCount > 0
              ? `${criticalCount} ${criticalCount === 1 ? 'est' : 'sont'} en rupture de stock. `
              : '') +
            (highCount > 0
              ? `${highCount} ${highCount === 1 ? 'se vend récemment et a' : 'se vendent récemment et ont'} un stock faible. `
              : '') +
            'Réapprovisionnez avant la prochaine période achalandée.'
          : `${suggestions.length} product(s) need restocking. ` +
            (criticalCount > 0
              ? `${criticalCount} ${criticalCount === 1 ? 'is' : 'are'} out of stock. `
              : '') +
            (highCount > 0
              ? `${highCount} ${highCount === 1 ? 'has' : 'have'} recent sales and ${highCount === 1 ? 'is' : 'are'} running low. `
              : '') +
            'Reorder before the next busy period.';

    return { suggestions, summary };
  }

  async getTopSellers() {
    const topRaw = await this.prisma.saleItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: TOP_SELLER_LIMIT,
    });

    if (topRaw.length === 0) {
      return { topSellers: [], message: 'No sales recorded yet.' };
    }

    const productIds = topRaw.map((row) => row.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        sellingPrice: true,
        category: { select: { id: true, name: true } },
      },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));

    const topSellers = topRaw.map((row) => {
      const product = productMap.get(row.productId);
      return {
        productId: row.productId,
        productName: product?.name ?? 'Unknown',
        sku: product?.sku ?? null,
        currentStock: product?.currentStock ?? 0,
        category: product?.category ?? null,
        totalSold: row._sum?.quantity ?? 0,
        totalRevenue: row._sum?.lineTotal ?? new Prisma.Decimal(0),
      };
    });

    return { topSellers };
  }

  async getSlowMovers() {
    const since = new Date(Date.now() - SLOW_MOVER_DAYS_WINDOW * 86400000);

    const soldProductIds = await this.prisma.saleItem
      .findMany({
        where: { sale: { createdAt: { gte: since } } },
        select: { productId: true },
        distinct: ['productId'],
      })
      .then((rows) => rows.map((row) => row.productId));

    const slowMovers = await this.prisma.product.findMany({
      where: {
        isActive: true,
        currentStock: { gt: 0 },
        id: { notIn: soldProductIds.length > 0 ? soldProductIds : [0] },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minStock: true,
        sellingPrice: true,
        costPrice: true,
        expirationDate: true,
        supplier: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { currentStock: 'desc' },
      take: SLOW_MOVER_LIMIT,
    });

    return {
      slowMovers: slowMovers.map((product) => ({
        ...product,
        stockValue: new Prisma.Decimal(product.costPrice).times(product.currentStock),
      })),
      message:
        slowMovers.length === 0
          ? 'All active products have had recent sales.'
          : `${slowMovers.length} product(s) had no sales in the last ${SLOW_MOVER_DAYS_WINDOW} days.`,
    };
  }

  async ask(
    question: string,
    language: InsightLanguage,
    operator: { id: number; email: string },
  ) {
    const normalizedQuestion = this.normalizeQuestion(question);
    const normalizedLanguage = this.normalizeLanguage(language);
    const fallback = await this.getLocalAgentAnswer(
      normalizedQuestion,
      normalizedLanguage,
    );
    let answer = fallback;
    let fallbackReason: string | null = process.env.OPENAI_API_KEY
      ? null
      : 'OPENAI_API_KEY is not configured';

    if (process.env.OPENAI_API_KEY) {
      try {
        answer = await this.getOpenAiAgentAnswer(
          normalizedQuestion,
          normalizedLanguage,
        );
      } catch (error) {
        fallbackReason =
          error instanceof Error ? error.message : 'Unknown OpenAI error';
      }
    }

    await this.prisma.aiInsightLog.create({
      data: {
        type: answer.type,
        prompt: normalizedQuestion,
        result: JSON.stringify({
          provider: answer.provider,
          type: answer.type,
          answer: answer.result,
          language: normalizedLanguage,
          toolsUsed: answer.toolsUsed,
          model:
            answer.provider === 'openai-agent'
              ? process.env.OPENAI_MODEL || 'gpt-4o-mini'
              : null,
          fallbackReason,
        }),
        createdBy: { connect: { id: operator.id } },
      },
    });

    return {
      question: normalizedQuestion,
      language: normalizedLanguage,
      answer: answer.result,
      type: answer.type,
      provider: answer.provider,
      toolsUsed: answer.toolsUsed,
      fallbackReason,
    };
  }

  private async getOpenAiAgentAnswer(
    question: string,
    language: InsightLanguage,
  ): Promise<InsightAnswer> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const languageName = {
      en: 'English',
      fr: 'Quebec-friendly French',
      zh: 'clear Simplified Chinese',
    }[language];
    const instructions =
      'You are the SmartDepanneur Store Operations Agent for a Quebec convenience store owner. ' +
      'Call one or more provided read-only business tools before answering. Use only returned tool data; never invent products, sales, or stock. ' +
      `Answer only in ${languageName}, regardless of the language used in the question. ` +
      'Lead with the decision, then give concise reasons and next actions.';
    const agentSignal = AbortSignal.timeout(12_000);
    const initialInput = [
      {
        role: 'user',
        content: question,
      },
    ];
    const firstPayload = await this.createOpenAiResponse(
      apiKey,
      {
        model,
        instructions,
        input: initialInput,
        tools: RESPONSE_TOOL_DEFINITIONS,
        tool_choice: 'required',
      },
      agentSignal,
    );
    const toolCalls = this.extractOpenAiFunctionCalls(firstPayload);
    if (toolCalls.length === 0) {
      throw new Error('OpenAI agent did not call a store tool');
    }

    const toolOutputs = await Promise.all(
      toolCalls.map(async (toolCall) => ({
        type: 'function_call_output',
        call_id: toolCall.call_id,
        output: JSON.stringify(await this.executeAgentTool(toolCall.name)),
      })),
    );
    const firstOutput: unknown[] =
      this.isRecord(firstPayload) && Array.isArray(firstPayload.output)
        ? (firstPayload.output as unknown[])
        : [];
    const finalPayload = await this.createOpenAiResponse(
      apiKey,
      {
        model,
        instructions,
        input: [...initialInput, ...firstOutput, ...toolOutputs],
        tools: RESPONSE_TOOL_DEFINITIONS,
        tool_choice: 'none',
      },
      agentSignal,
    );
    const result = this.extractOpenAiText(finalPayload);
    if (!result) {
      throw new Error('OpenAI agent response did not contain text');
    }

    return {
      result,
      type: this.insightTypeForTool(toolCalls[0].name),
      provider: 'openai-agent',
      toolsUsed: [...new Set(toolCalls.map((toolCall) => toolCall.name))],
    };
  }

  private async createOpenAiResponse(
    apiKey: string,
    body: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<unknown> {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with ${response.status}`);
    }

    return response.json();
  }

  private extractOpenAiFunctionCalls(payload: unknown): OpenAiFunctionCall[] {
    if (!this.isRecord(payload) || !Array.isArray(payload.output)) return [];

    return payload.output.flatMap((item: unknown) => {
      if (
        !this.isRecord(item) ||
        item.type !== 'function_call' ||
        typeof item.call_id !== 'string' ||
        typeof item.name !== 'string' ||
        !AGENT_TOOLS.includes(item.name as InsightAgentTool) ||
        typeof item.arguments !== 'string'
      ) {
        return [];
      }

      try {
        const parsedArguments: unknown = JSON.parse(item.arguments);
        if (!this.isRecord(parsedArguments)) return [];
      } catch {
        return [];
      }

      return [
        {
          type: 'function_call' as const,
          call_id: item.call_id,
          name: item.name as InsightAgentTool,
          arguments: item.arguments,
        },
      ];
    });
  }

  private extractOpenAiText(payload: unknown): string {
    if (!this.isRecord(payload)) return '';

    const typedPayload = payload as OpenAiResponsePayload;
    if (typeof typedPayload.output_text === 'string') {
      return typedPayload.output_text.trim();
    }

    const chunks: string[] = [];
    const output = Array.isArray(typedPayload.output)
      ? (typedPayload.output as OpenAiOutputItem[])
      : [];
    for (const item of output) {
      const contentItems = Array.isArray(item.content)
        ? (item.content as OpenAiContent[])
        : [];
      for (const content of contentItems) {
        if (typeof content.text === 'string') {
          chunks.push(content.text);
        }
      }
    }

    return chunks.join('\n').trim();
  }

  private async getStoreSummaryData() {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const [productCount, todaySales, lowCount] = await this.prisma.$transaction([
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.sale.count({
        where: { createdAt: { gte: todayStart, lt: todayEnd } },
      }),
      this.prisma.product.count({
        where: {
          isActive: true,
          currentStock: { lte: this.prisma.product.fields.minStock },
        },
      }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      activeProductCount: productCount,
      todaySaleCount: todaySales,
      lowStockProductCount: lowCount,
    };
  }

  private async executeAgentTool(tool: InsightAgentTool): Promise<unknown> {
    switch (tool) {
      case 'get_reorder_suggestions':
        return this.getReorderSuggestions();
      case 'get_top_sellers':
        return this.getTopSellers();
      case 'get_slow_movers':
        return this.getSlowMovers();
      case 'get_store_summary':
        return this.getStoreSummaryData();
    }
  }

  private insightTypeForTool(tool: InsightAgentTool): InsightType {
    const types: Record<InsightAgentTool, InsightType> = {
      get_reorder_suggestions: InsightType.reorder,
      get_top_sellers: InsightType.top_sellers,
      get_slow_movers: InsightType.slow_movers,
      get_store_summary: InsightType.sales_summary,
    };
    return types[tool];
  }

  private selectLocalAgentTool(question: string): InsightAgentTool {
    const normalizedQuestion = question.toLowerCase();
    const asksForReorder =
      normalizedQuestion.includes('restock') ||
      normalizedQuestion.includes('reorder') ||
      normalizedQuestion.includes('low stock') ||
      normalizedQuestion.includes('réapprovision') ||
      normalizedQuestion.includes('reapprovision') ||
      normalizedQuestion.includes('stock faible') ||
      normalizedQuestion.includes('commander') ||
      question.includes('补货') ||
      question.includes('进货') ||
      question.includes('库存');
    const asksForSlowMovers =
      normalizedQuestion.includes('slow') ||
      normalizedQuestion.includes('not selling') ||
      normalizedQuestion.includes('dead') ||
      normalizedQuestion.includes('se vendent mal') ||
      normalizedQuestion.includes('vente lente') ||
      normalizedQuestion.includes('stagn') ||
      question.includes('滞销') ||
      question.includes('卖不动') ||
      question.includes('不好卖');
    const asksForTopSellers =
      normalizedQuestion.includes('top') ||
      normalizedQuestion.includes('best') ||
      normalizedQuestion.includes('popular') ||
      normalizedQuestion.includes('meilleures ventes') ||
      normalizedQuestion.includes('se vendent le mieux') ||
      question.includes('热销') ||
      question.includes('卖得最好') ||
      question.includes('销量');

    if (asksForReorder) return 'get_reorder_suggestions';
    if (asksForSlowMovers) return 'get_slow_movers';
    if (asksForTopSellers) return 'get_top_sellers';
    return 'get_store_summary';
  }

  private async getLocalAgentAnswer(
    question: string,
    language: InsightLanguage,
  ): Promise<InsightAnswer> {
    const tool = this.selectLocalAgentTool(question);

    if (tool === 'get_reorder_suggestions') {
      const { suggestions, summary } = await this.getReorderSuggestions();
      if (suggestions.length === 0) {
        return {
          type: InsightType.reorder,
          provider: 'local-agent',
          toolsUsed: [tool],
          result:
            language === 'zh'
              ? '所有商品都高于最低库存线，目前不需要补货。'
              : language === 'fr'
                ? 'Tous les produits sont au-dessus de leur seuil minimal. Aucun réapprovisionnement n’est nécessaire.'
                : summary,
        };
      }

      const lines = suggestions.slice(0, 5).map((suggestion) =>
        language === 'zh'
          ? `- ${suggestion.productName}: 当前库存 ${suggestion.currentStock}/${suggestion.minStock}, 建议补 ${suggestion.suggestedReorderQty} ${suggestion.unit}${
              suggestion.soldLast7Days > 0 ? `，过去 7 天卖出 ${suggestion.soldLast7Days} 件` : ''
            }`
          : language === 'fr'
            ? `- ${suggestion.productName} : stock ${suggestion.currentStock}/${suggestion.minStock}, commander ${suggestion.suggestedReorderQty} ${suggestion.unit}${
                suggestion.soldLast7Days > 0 ? ` (${suggestion.soldLast7Days} vendus en 7 jours)` : ''
              }`
            : `- ${suggestion.productName}: stock ${suggestion.currentStock}/${suggestion.minStock}, suggest ordering ${suggestion.suggestedReorderQty} ${suggestion.unit}${
                suggestion.soldLast7Days > 0 ? ` (sold ${suggestion.soldLast7Days} in last 7 days)` : ''
              }`,
      );

      return {
        type: InsightType.reorder,
        provider: 'local-agent',
        toolsUsed: [tool],
        result:
          language === 'zh'
            ? `有 ${suggestions.length} 个商品需要补货。\n\n优先补货清单：\n${lines.join('\n')}`
            : language === 'fr'
              ? `${suggestions.length} produit(s) doivent être réapprovisionnés.\n\nPriorités :\n${lines.join('\n')}`
              : `${summary}\n\nTop reorder priorities:\n${lines.join('\n')}`,
      };
    }

    if (tool === 'get_top_sellers') {
      const { topSellers } = await this.getTopSellers();
      if (topSellers.length === 0) {
        return {
          type: InsightType.top_sellers,
          provider: 'local-agent',
          toolsUsed: [tool],
          result:
            language === 'zh'
              ? '目前还没有销售记录。'
              : language === 'fr'
                ? 'Aucune vente n’a encore été enregistrée.'
                : 'No sales have been recorded yet.',
        };
      }

      const lines = topSellers.slice(0, 5).map((seller, index) =>
        language === 'zh'
          ? `${index + 1}. ${seller.productName} - 已售 ${seller.totalSold} 件，收入 $${parseFloat(String(seller.totalRevenue)).toFixed(2)}`
          : language === 'fr'
            ? `${index + 1}. ${seller.productName} — ${seller.totalSold} unité(s) vendue(s), ${parseFloat(String(seller.totalRevenue)).toFixed(2)} $ de revenus`
            : `${index + 1}. ${seller.productName} - ${seller.totalSold} units sold, $${parseFloat(String(seller.totalRevenue)).toFixed(2)} revenue`,
      );

      return {
        type: InsightType.top_sellers,
        provider: 'local-agent',
        toolsUsed: [tool],
        result:
          language === 'zh'
            ? `热销商品：\n${lines.join('\n')}`
            : language === 'fr'
              ? `Meilleures ventes :\n${lines.join('\n')}`
              : `Top selling products:\n${lines.join('\n')}`,
      };
    }

    if (tool === 'get_slow_movers') {
      const { slowMovers, message } = await this.getSlowMovers();
      if (slowMovers.length === 0) {
        return {
          type: InsightType.slow_movers,
          provider: 'local-agent',
          toolsUsed: [tool],
          result:
            language === 'zh'
              ? '所有在售商品最近都有销售记录。'
              : language === 'fr'
                ? 'Tous les produits actifs ont eu des ventes récemment.'
                : message,
        };
      }

      const lines = slowMovers.slice(0, 5).map((product) =>
        language === 'zh'
          ? `- ${product.name}: 当前库存 ${product.currentStock} 件，过去 30 天没有销售`
          : language === 'fr'
            ? `- ${product.name} : ${product.currentStock} en stock, aucune vente depuis 30 jours`
            : `- ${product.name}: ${product.currentStock} units in stock, no sales in 30 days`,
      );

      return {
        type: InsightType.slow_movers,
        provider: 'local-agent',
        toolsUsed: [tool],
        result:
          language === 'zh'
            ? `有 ${slowMovers.length} 个商品过去 30 天没有销售。\n\n${lines.join('\n')}`
            : language === 'fr'
              ? `${slowMovers.length} produit(s) n’ont eu aucune vente depuis 30 jours.\n\n${lines.join('\n')}`
              : `${message}\n\n${lines.join('\n')}`,
      };
    }

    const summary = await this.getStoreSummaryData();

    return {
      type: InsightType.sales_summary,
      provider: 'local-agent',
      toolsUsed: [tool],
      result:
        language === 'zh'
          ? `门店概况：当前有 ${summary.activeProductCount} 个在售商品，今天 ${summary.todaySaleCount} 笔销售，${summary.lowStockProductCount} 个商品低于或等于最低库存线。`
          : language === 'fr'
            ? `Résumé du magasin : ${summary.activeProductCount} produit(s) actif(s), ${summary.todaySaleCount} vente(s) aujourd’hui et ${summary.lowStockProductCount} produit(s) au seuil de stock minimal ou en dessous.`
            : `Store summary: ${summary.activeProductCount} active product(s), ${summary.todaySaleCount} sale(s) today, ${summary.lowStockProductCount} product(s) at or below minimum stock level.`,
    };
  }

  private normalizeQuestion(value: string) {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException('question is required');
    }
    if (normalized.length > 500) {
      throw new BadRequestException(
        'question must contain 500 characters or fewer',
      );
    }
    return normalized;
  }

  private normalizeLanguage(value: InsightLanguage): InsightLanguage {
    if (!['en', 'fr', 'zh'].includes(value)) {
      throw new BadRequestException('language must be one of: en, fr, zh');
    }
    return value;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}

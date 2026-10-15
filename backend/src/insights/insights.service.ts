import { BadRequestException, Injectable } from '@nestjs/common';
import { InsightType, Prisma } from '@prisma/client';
import {
  AgentActionProposal,
  AgentActionSource,
  proposeMinStockChange,
  proposePurchaseOrders,
} from '../agent-actions/agent-action-proposals';
import { PrismaService } from '../prisma/prisma.service';
import {
  FORECAST_HISTORY_DAYS,
  forecastFromSales,
  SaleQuantity,
  storeDateKey,
} from './forecast';
import {
  findStoreAgentTool,
  InsightAgentTool,
  selectLocalAgentTool,
  STORE_AGENT_TOOL_NAMES,
  toOpenAiToolDefinitions,
} from './store-agent-tools';

export {
  STORE_AGENT_TOOLS,
  type InsightAgentTool,
} from './store-agent-tools';

const REORDER_DAYS_WINDOW = 7;
const REORDER_HORIZON_DAYS = 14;
const SLOW_MOVER_DAYS_WINDOW = 30;
const TOP_SELLER_LIMIT = 10;
const SLOW_MOVER_LIMIT = 10;
const EXPIRY_WINDOW_DAYS = 14;
// No per-supplier lead time is stored yet, so reviews assume two days.
const SUPPLIER_LEAD_TIME_DAYS = 2;
const MIN_STOCK_REVIEW_LIMIT = 20;
const DAY_MS = 86_400_000;

export type InsightLanguage = 'en' | 'fr' | 'zh';
type InsightProvider = 'openai-agent' | 'local-agent';

export interface AgentToolContext {
  source: AgentActionSource;
  requestedBy: { id: number; email: string } | null;
  language?: InsightLanguage;
  // Proposals recorded while answering, returned so the UI can show them.
  proposals?: AgentActionProposal[];
}

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

const RESPONSE_TOOL_DEFINITIONS = toOpenAiToolDefinitions();

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
    const history = await this.loadSalesHistory(productIds);
    const now = new Date();

    const suggestions = lowStockProducts.map((product) => {
      const soldLast7Days = velocityMap.get(product.id) ?? 0;
      // Weekday-aware demand for the next 14 days; falls back to the 7-day
      // average for products with under two weeks of sales history.
      const forecast = forecastFromSales(
        history.get(product.id) ?? [],
        now,
        REORDER_HORIZON_DAYS,
      );
      const suggestedReorderQty = Math.max(
        1,
        Math.ceil(forecast.total + product.minStock - product.currentStock),
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
        forecastNext14Days: Math.round(forecast.total * 10) / 10,
        forecastMethod: forecast.method,
        suggestedReorderQty,
        unitCost: new Prisma.Decimal(product.costPrice),
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

  /**
   * Perishables that are forecast not to sell out before they expire, with a
   * markdown that grows as the date gets closer.
   */
  async getExpiryRisks(language: InsightLanguage = 'en') {
    const normalizedLanguage = this.normalizeLanguage(language);
    const now = new Date();
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        currentStock: { gt: 0 },
        expirationDate: { lte: new Date(now.getTime() + EXPIRY_WINDOW_DAYS * DAY_MS) },
      },
      select: {
        id: true,
        name: true,
        unit: true,
        currentStock: true,
        costPrice: true,
        sellingPrice: true,
        expirationDate: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: { expirationDate: 'asc' },
    });

    const history = await this.loadSalesHistory(products.map((product) => product.id));
    const today = storeDateKey(now);
    const risks = products.flatMap((product) => {
      if (!product.expirationDate) return [];
      const expiryKey = storeDateKey(product.expirationDate);
      const daysLeft = Math.round(
        (Date.parse(`${expiryKey}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / DAY_MS,
      );
      const forecast = forecastFromSales(
        history.get(product.id) ?? [],
        now,
        EXPIRY_WINDOW_DAYS,
      );
      // Units expected to sell on the days still left before expiry (the
      // expiry day itself is not counted).
      const expectedSales =
        daysLeft <= 0
          ? 0
          : forecast.daily.slice(0, daysLeft).reduce((sum, value) => sum + value, 0);
      const atRiskUnits = Math.max(0, product.currentStock - Math.floor(expectedSales));
      if (atRiskUnits === 0) return [];

      const expired = daysLeft < 0;
      const discountPct = expired
        ? null
        : daysLeft <= 1
          ? 50
          : daysLeft <= 3
            ? 30
            : daysLeft <= 7
              ? 20
              : 10;
      const sellingPrice = new Prisma.Decimal(product.sellingPrice);
      const costPrice = new Prisma.Decimal(product.costPrice);
      const suggestedPrice =
        discountPct === null
          ? null
          : sellingPrice.times(100 - discountPct).dividedBy(100).toDecimalPlaces(2);

      return [
        {
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          category: product.category,
          expirationDate: expiryKey,
          daysLeft,
          currentStock: product.currentStock,
          expectedSalesBeforeExpiry: Math.round(expectedSales * 10) / 10,
          atRiskUnits,
          atRiskCost: costPrice.times(atRiskUnits),
          action: expired ? ('remove' as const) : ('markdown' as const),
          suggestedDiscountPct: discountPct,
          sellingPrice,
          suggestedPrice,
          belowCost: suggestedPrice !== null && suggestedPrice.lessThan(costPrice),
        },
      ];
    });

    risks.sort((a, b) => b.atRiskCost.comparedTo(a.atRiskCost));
    const totalAtRiskCost = risks.reduce(
      (sum, risk) => sum.plus(risk.atRiskCost),
      new Prisma.Decimal(0),
    );
    const total = totalAtRiskCost.toFixed(2);
    const summary =
      risks.length === 0
        ? normalizedLanguage === 'zh'
          ? '没有临期商品会在过期前卖不完。'
          : normalizedLanguage === 'fr'
            ? 'Aucun produit périssable ne risque d’expirer avant d’être vendu.'
            : 'No perishable product is at risk of expiring before it sells.'
        : normalizedLanguage === 'zh'
          ? `${risks.length} 个商品可能在过期前卖不完，按成本计约 $${total}。`
          : normalizedLanguage === 'fr'
            ? `${risks.length} produit(s) risquent d’expirer avant d’être vendus, environ ${total} $ au coût.`
            : `${risks.length} product(s) may expire before they sell, about $${total} at cost.`;

    return { windowDays: EXPIRY_WINDOW_DAYS, totalAtRiskCost, risks, summary };
  }

  /**
   * Flags minimum stock levels that no longer match demand. The minimum is the
   * reorder trigger, so it should cover demand over the supplier lead time
   * plus a buffer of half the busiest forecast day.
   */
  async getMinStockReview(language: InsightLanguage = 'en') {
    const normalizedLanguage = this.normalizeLanguage(language);
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, unit: true, minStock: true, currentStock: true },
    });
    const history = await this.loadSalesHistory(products.map((product) => product.id));
    const now = new Date();

    const reviews = products.flatMap((product) => {
      const forecast = forecastFromSales(
        history.get(product.id) ?? [],
        now,
        REORDER_HORIZON_DAYS,
      );
      // Not enough history to judge the minimum.
      if (forecast.method !== 'weekday-seasonal') return [];
      const recommendedMinStock = Math.ceil(
        forecast.averageDaily * SUPPLIER_LEAD_TIME_DAYS + 0.5 * forecast.peakDaily,
      );
      const difference = recommendedMinStock - product.minStock;
      if (Math.abs(difference) < Math.max(2, Math.ceil(recommendedMinStock * 0.25))) {
        return [];
      }
      return [
        {
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          currentStock: product.currentStock,
          currentMinStock: product.minStock,
          recommendedMinStock,
          direction: difference > 0 ? ('raise' as const) : ('lower' as const),
          averageDailyForecast: Math.round(forecast.averageDaily * 10) / 10,
          peakDailyForecast: Math.round(forecast.peakDaily * 10) / 10,
        },
      ];
    });

    reviews.sort(
      (a, b) =>
        Math.abs(b.recommendedMinStock - b.currentMinStock) -
        Math.abs(a.recommendedMinStock - a.currentMinStock),
    );
    const limited = reviews.slice(0, MIN_STOCK_REVIEW_LIMIT);
    const raise = limited.filter((review) => review.direction === 'raise').length;
    const lower = limited.length - raise;
    const summary =
      limited.length === 0
        ? normalizedLanguage === 'zh'
          ? '最低库存设置与预测需求基本一致。'
          : normalizedLanguage === 'fr'
            ? 'Les stocks minimums correspondent à la demande prévue.'
            : 'Minimum stock levels match forecast demand.'
        : normalizedLanguage === 'zh'
          ? `${limited.length} 个商品的最低库存需要调整：${raise} 个偏低，${lower} 个偏高。`
          : normalizedLanguage === 'fr'
            ? `${limited.length} stock(s) minimum à ajuster : ${raise} trop bas, ${lower} trop élevé(s).`
            : `${limited.length} minimum stock level(s) need adjusting: ${raise} too low, ${lower} too high.`;

    return {
      leadTimeDays: SUPPLIER_LEAD_TIME_DAYS,
      reviews: limited,
      summary,
    };
  }

  private async loadSalesHistory(
    productIds: number[],
  ): Promise<Map<number, SaleQuantity[]>> {
    const history = new Map<number, SaleQuantity[]>();
    if (productIds.length === 0) return history;

    const rows = await this.prisma.saleItem.findMany({
      where: {
        productId: { in: productIds },
        sale: {
          createdAt: { gte: new Date(Date.now() - (FORECAST_HISTORY_DAYS + 1) * DAY_MS) },
        },
      },
      select: {
        productId: true,
        quantity: true,
        sale: { select: { createdAt: true } },
      },
    });
    for (const row of rows) {
      const sales = history.get(row.productId) ?? [];
      sales.push({ quantity: row.quantity, createdAt: row.sale.createdAt });
      history.set(row.productId, sales);
    }
    return history;
  }

  async ask(
    question: string,
    language: InsightLanguage,
    operator: { id: number; email: string },
  ) {
    const normalizedQuestion = this.normalizeQuestion(question);
    const normalizedLanguage = this.normalizeLanguage(language);
    const context: AgentToolContext = {
      source: 'openai-agent',
      requestedBy: operator,
      language: normalizedLanguage,
      proposals: [],
    };
    let answer: InsightAnswer | null = null;
    let fallbackReason: string | null = process.env.OPENAI_API_KEY
      ? null
      : 'OPENAI_API_KEY is not configured';

    if (process.env.OPENAI_API_KEY) {
      try {
        answer = await this.getOpenAiAgentAnswer(
          normalizedQuestion,
          normalizedLanguage,
          context,
        );
      } catch (error) {
        fallbackReason =
          error instanceof Error ? error.message : 'Unknown OpenAI error';
      }
    }

    // The local agent runs only when the OpenAI agent is unavailable, so a
    // question never produces proposals from both agents.
    if (!answer) {
      context.source = 'local-agent';
      answer = await this.getLocalAgentAnswer(
        normalizedQuestion,
        normalizedLanguage,
        context,
      );
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
      proposals: context.proposals ?? [],
    };
  }

  private async getOpenAiAgentAnswer(
    question: string,
    language: InsightLanguage,
    context: AgentToolContext,
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
      'Call one or more provided business tools before answering. Use only returned tool data; never invent products, sales, or stock. ' +
      'You cannot change store data. The propose_* tools only record a pending proposal that the owner approves in the app: use them when the owner asks you to prepare or change something, and say plainly that it awaits approval. ' +
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
        output: JSON.stringify(
          await this.executeAgentToolCall(toolCall, context),
        ),
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
        !STORE_AGENT_TOOL_NAMES.includes(item.name as InsightAgentTool) ||
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

  /**
   * Runs one Store Agent tool. Read-only tools return data; proposal tools
   * validate their arguments and record a pending proposal, never a change.
   */
  async executeAgentTool(
    tool: InsightAgentTool,
    args: Record<string, unknown> = {},
    context: AgentToolContext = { source: 'mcp', requestedBy: null },
  ): Promise<unknown> {
    const definition = findStoreAgentTool(tool);
    if (!definition) throw new BadRequestException(`Unknown tool ${tool}`);
    const parsed = definition.input.safeParse(args);
    if (!parsed.success) {
      throw new BadRequestException(
        `Invalid arguments for ${tool}: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.') || 'input'} ${issue.message}`)
          .join('; ')}`,
      );
    }
    const language = context.language ?? 'en';

    switch (tool) {
      case 'get_reorder_suggestions':
        return this.getReorderSuggestions(language);
      case 'get_top_sellers':
        return this.getTopSellers();
      case 'get_slow_movers':
        return this.getSlowMovers();
      case 'get_store_summary':
        return this.getStoreSummaryData();
      case 'get_expiry_risks':
        return this.getExpiryRisks(language);
      case 'get_min_stock_review':
        return this.getMinStockReview(language);
      case 'propose_purchase_orders': {
        const reorder = await this.getReorderSuggestions(language);
        if (reorder.suggestions.length === 0) {
          return { proposed: false, message: 'Nothing needs reordering, so no purchase orders were proposed.' };
        }
        const proposal = await proposePurchaseOrders(this.prisma, {
          language,
          preview: {
            businessDate: storeDateKey(new Date()),
            itemCount: reorder.suggestions.length,
            supplierCount: new Set(
              reorder.suggestions.map((item) => item.supplier?.id ?? 'none'),
            ).size,
            estimatedTotal: reorder.suggestions
              .reduce((sum, item) => sum.plus(item.estimatedCost), new Prisma.Decimal(0))
              .toFixed(2),
          },
          rationale: reorder.summary,
          source: context.source,
          requestedById: context.requestedBy?.id ?? null,
        });
        context.proposals?.push(proposal);
        return { proposed: true, proposal };
      }
      case 'propose_min_stock_change': {
        const input = parsed.data as {
          productId: number;
          newMinStock: number;
          reason: string;
        };
        const proposal = await proposeMinStockChange(this.prisma, {
          productId: input.productId,
          newMinStock: input.newMinStock,
          rationale: input.reason,
          source: context.source,
          requestedById: context.requestedBy?.id ?? null,
        });
        context.proposals?.push(proposal);
        return { proposed: true, proposal };
      }
    }
  }

  /** A model tool call: bad arguments go back to the model as an error. */
  private async executeAgentToolCall(
    toolCall: OpenAiFunctionCall,
    context: AgentToolContext,
  ) {
    try {
      const args = JSON.parse(toolCall.arguments) as Record<string, unknown>;
      return await this.executeAgentTool(toolCall.name, args, context);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Tool failed',
      };
    }
  }

  private insightTypeForTool(tool: InsightAgentTool): InsightType {
    const types: Record<InsightAgentTool, InsightType> = {
      get_reorder_suggestions: InsightType.reorder,
      get_top_sellers: InsightType.top_sellers,
      get_slow_movers: InsightType.slow_movers,
      get_store_summary: InsightType.sales_summary,
      get_expiry_risks: InsightType.expiry_risks,
      get_min_stock_review: InsightType.min_stock_review,
      propose_purchase_orders: InsightType.agent_action,
      propose_min_stock_change: InsightType.agent_action,
    };
    return types[tool];
  }

  private async getLocalAgentAnswer(
    question: string,
    language: InsightLanguage,
    context: AgentToolContext,
  ): Promise<InsightAnswer> {
    const tool = selectLocalAgentTool(question);

    if (tool === 'propose_purchase_orders') {
      const output = (await this.executeAgentTool(tool, {}, context)) as
        | { proposed: false }
        | { proposed: true; proposal: AgentActionProposal };
      if (!output.proposed) {
        return {
          type: InsightType.agent_action,
          provider: 'local-agent',
          toolsUsed: [tool],
          result:
            language === 'zh'
              ? '目前没有需要补货的商品，所以没有生成采购单提案。'
              : language === 'fr'
                ? 'Rien n’est à réapprovisionner, donc aucun bon de commande n’a été proposé.'
                : 'Nothing needs reordering right now, so no purchase orders were proposed.',
        };
      }
      const preview = output.proposal.payload as {
        itemCount: number;
        supplierCount: number;
        estimatedTotal: string;
      };
      return {
        type: InsightType.agent_action,
        provider: 'local-agent',
        toolsUsed: [tool],
        result:
          language === 'zh'
            ? `已准备采购单提案：${preview.itemCount} 个商品，${preview.supplierCount} 个供应商，预计 $${preview.estimatedTotal}。在“待审批操作”中批准之前不会下单。`
            : language === 'fr'
              ? `Proposition de bons de commande prête : ${preview.itemCount} produit(s), ${preview.supplierCount} fournisseur(s), environ ${preview.estimatedTotal} $. Rien n’est commandé avant votre approbation dans « Actions en attente ».`
              : `I prepared a purchase-order proposal: ${preview.itemCount} product(s) from ${preview.supplierCount} supplier(s), about $${preview.estimatedTotal}. Nothing is ordered until you approve it under Pending actions.`,
      };
    }

    if (tool === 'get_expiry_risks') {
      const { risks, summary } = await this.getExpiryRisks(language);
      const lines = risks.slice(0, 5).map((risk) => {
        const price = risk.suggestedPrice?.toFixed(2);
        if (language === 'zh') {
          return risk.action === 'remove'
            ? `- ${risk.productName}：已于 ${risk.expirationDate} 过期，请下架 ${risk.currentStock} 件`
            : `- ${risk.productName}：${risk.expirationDate} 过期，预计有 ${risk.atRiskUnits} 件卖不完，建议打 ${100 - (risk.suggestedDiscountPct ?? 0)} 折价 $${price}`;
        }
        if (language === 'fr') {
          return risk.action === 'remove'
            ? `- ${risk.productName} : expiré le ${risk.expirationDate}, retirer ${risk.currentStock} unité(s)`
            : `- ${risk.productName} : expire le ${risk.expirationDate}, ${risk.atRiskUnits} unité(s) risquent de rester; rabais de ${risk.suggestedDiscountPct} % à ${price} $`;
        }
        return risk.action === 'remove'
          ? `- ${risk.productName}: expired on ${risk.expirationDate}, remove ${risk.currentStock} from the shelf`
          : `- ${risk.productName}: expires ${risk.expirationDate}, ${risk.atRiskUnits} may not sell; mark down ${risk.suggestedDiscountPct}% to $${price}`;
      });
      return {
        type: InsightType.expiry_risks,
        provider: 'local-agent',
        toolsUsed: [tool],
        result: lines.length > 0 ? `${summary}\n\n${lines.join('\n')}` : summary,
      };
    }

    if (tool === 'get_min_stock_review') {
      const { reviews, summary } = await this.getMinStockReview(language);
      const lines = reviews.slice(0, 5).map((review) =>
        language === 'zh'
          ? `- ${review.productName}：最低库存 ${review.currentMinStock} → 建议 ${review.recommendedMinStock}`
          : language === 'fr'
            ? `- ${review.productName} : minimum ${review.currentMinStock} → ${review.recommendedMinStock} suggéré`
            : `- ${review.productName}: minimum ${review.currentMinStock} -> suggested ${review.recommendedMinStock}`,
      );
      return {
        type: InsightType.min_stock_review,
        provider: 'local-agent',
        toolsUsed: [tool],
        result: lines.length > 0 ? `${summary}\n\n${lines.join('\n')}` : summary,
      };
    }

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

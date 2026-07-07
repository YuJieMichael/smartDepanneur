import { Injectable } from '@nestjs/common';
import { InsightType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const REORDER_DAYS_WINDOW = 7;
const SLOW_MOVER_DAYS_WINDOW = 30;
const TOP_SELLER_LIMIT = 10;
const SLOW_MOVER_LIMIT = 10;

type InsightProvider = 'openai' | 'local-fallback';

interface InsightAnswer {
  result: string;
  type: InsightType;
  provider: InsightProvider;
}

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReorderSuggestions() {
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
        summary: 'All products are above their minimum stock threshold. No reorders needed.',
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
    const velocityMap = new Map(
      salesData.map((row) => [row.productId, row._sum?.quantity ?? 0]),
    );

    const suggestions = lowStockProducts.map((product) => {
      const soldLast7Days = velocityMap.get(product.id) ?? 0;
      const dailyVelocity = soldLast7Days / REORDER_DAYS_WINDOW;
      const suggestedReorderQty = Math.max(
        1,
        Math.ceil(dailyVelocity * 14 + product.minStock - product.currentStock),
      );

      const urgency: 'critical' | 'high' | 'medium' =
        product.currentStock === 0
          ? 'critical'
          : soldLast7Days > 0
            ? 'high'
            : 'medium';

      const reason =
        product.currentStock === 0
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
      `${suggestions.length} product(s) need restocking. ` +
      (criticalCount > 0 ? `${criticalCount} are out of stock. ` : '') +
      (highCount > 0 ? `${highCount} have recent sales and are running low. ` : '') +
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

  async ask(question: string, operator: { id: number; email: string }) {
    const fallback = await this.getLocalInsightAnswer(question);
    const answer = await this.getOpenAiInsightAnswer(question, fallback.type).catch(() => fallback);

    await this.prisma.aiInsightLog.create({
      data: {
        type: answer.type,
        prompt: question,
        result: `[${answer.provider}] ${answer.result}`,
        createdBy: { connect: { id: operator.id } },
      },
    });

    return {
      question,
      answer: answer.result,
      type: answer.type,
      provider: answer.provider,
    };
  }

  private async getOpenAiInsightAnswer(question: string, type: InsightType): Promise<InsightAnswer> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return this.getLocalInsightAnswer(question);
    }

    const context = await this.buildAiBusinessContext();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions:
          'You are SmartDepanneur AI, an assistant for a Quebec convenience store owner. ' +
          'Use only the provided store data. Give concise, practical recommendations with product names, reasons, and next actions. ' +
          'If data is insufficient, say what is missing. Do not invent products or sales. ' +
          'Answer in the same language as the owner question. If the owner asks in Chinese, answer in clear Simplified Chinese. If the owner asks in French, answer in clear Quebec-friendly French.',
        input:
          `Store data JSON:\n${JSON.stringify(context, null, 2)}\n\n` +
          `Owner question: ${question}`,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with ${response.status}`);
    }

    const payload = await response.json();
    const result = this.extractOpenAiText(payload);
    if (!result) {
      throw new Error('OpenAI response did not contain text');
    }

    return { result, type, provider: 'openai' };
  }

  private extractOpenAiText(payload: any): string {
    if (typeof payload?.output_text === 'string') {
      return payload.output_text.trim();
    }

    const chunks: string[] = [];
    for (const item of payload?.output ?? []) {
      for (const content of item?.content ?? []) {
        if (typeof content?.text === 'string') {
          chunks.push(content.text);
        }
      }
    }

    return chunks.join('\n').trim();
  }

  private async buildAiBusinessContext() {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const expirationEnd = new Date(todayStart.getTime() + 7 * 86400000);

    const [reorder, topSellers, slowMovers, expiringSoon, todaySales] = await Promise.all([
      this.getReorderSuggestions(),
      this.getTopSellers(),
      this.getSlowMovers(),
      this.prisma.product.findMany({
        where: {
          isActive: true,
          expirationTracked: true,
          expirationDate: { lte: expirationEnd },
        },
        select: {
          name: true,
          currentStock: true,
          expirationDate: true,
          supplier: { select: { name: true } },
          category: { select: { name: true } },
        },
        orderBy: { expirationDate: 'asc' },
        take: 10,
      }),
      this.prisma.sale.findMany({
        where: { createdAt: { gte: todayStart, lt: todayEnd } },
        select: { total: true, profitEstimate: true, paymentMethod: true },
      }),
    ]);

    const todayRevenue = todaySales.reduce(
      (sum, sale) => sum.plus(sale.total),
      new Prisma.Decimal(0),
    );
    const todayProfit = todaySales.reduce(
      (sum, sale) => sum.plus(sale.profitEstimate ?? 0),
      new Prisma.Decimal(0),
    );

    return {
      generatedAt: new Date().toISOString(),
      today: {
        saleCount: todaySales.length,
        revenue: todayRevenue.toString(),
        estimatedProfit: todayProfit.toString(),
      },
      reorder,
      topSellers,
      slowMovers,
      expiringSoon,
    };
  }

  private async getLocalInsightAnswer(question: string): Promise<InsightAnswer> {
    const normalizedQuestion = question.toLowerCase();
    const answerInChinese = this.containsChinese(question);
    let result: string;
    let type: InsightType;

    if (
      normalizedQuestion.includes('restock') ||
      normalizedQuestion.includes('reorder') ||
      normalizedQuestion.includes('low') ||
      normalizedQuestion.includes('order') ||
      normalizedQuestion.includes('补货') ||
      normalizedQuestion.includes('进货') ||
      normalizedQuestion.includes('库存')
    ) {
      type = InsightType.reorder;
      const { suggestions, summary } = await this.getReorderSuggestions();
      if (suggestions.length === 0) {
        result = answerInChinese ? '所有商品都高于最低库存线，目前不需要补货。' : summary;
      } else {
        const lines = suggestions.slice(0, 5).map(
          (suggestion) =>
            answerInChinese
              ? `- ${suggestion.productName}: 当前库存 ${suggestion.currentStock}/${suggestion.minStock}, 建议补 ${suggestion.suggestedReorderQty} ${suggestion.unit}` +
                (suggestion.soldLast7Days > 0 ? `，过去 7 天卖出 ${suggestion.soldLast7Days} 件` : '')
              : `- ${suggestion.productName}: stock ${suggestion.currentStock}/${suggestion.minStock}, ` +
                `suggest ordering ${suggestion.suggestedReorderQty} ${suggestion.unit}` +
                (suggestion.soldLast7Days > 0
                  ? ` (sold ${suggestion.soldLast7Days} in last 7 days)`
                  : ''),
        );
        result = answerInChinese
          ? `有 ${suggestions.length} 个商品需要补货。\n\n优先补货清单：\n${lines.join('\n')}`
          : `${summary}\n\nTop reorder priorities:\n${lines.join('\n')}`;
      }
    } else if (
      normalizedQuestion.includes('top') ||
      normalizedQuestion.includes('best') ||
      normalizedQuestion.includes('popular') ||
      normalizedQuestion.includes('sell') ||
      normalizedQuestion.includes('热销') ||
      normalizedQuestion.includes('卖得好') ||
      normalizedQuestion.includes('销量')
    ) {
      type = InsightType.top_sellers;
      const { topSellers } = await this.getTopSellers();
      if (topSellers.length === 0) {
        result = answerInChinese ? '目前还没有销售记录。' : 'No sales have been recorded yet.';
      } else {
        const lines = topSellers
          .slice(0, 5)
          .map(
            (seller, index) =>
              answerInChinese
                ? `${index + 1}. ${seller.productName} - 已售 ${seller.totalSold} 件，收入 $${parseFloat(String(seller.totalRevenue)).toFixed(2)}`
                : `${index + 1}. ${seller.productName} - ${seller.totalSold} units sold, ` +
                  `$${parseFloat(String(seller.totalRevenue)).toFixed(2)} revenue`,
          );
        result = answerInChinese ? `热销商品：\n${lines.join('\n')}` : `Top selling products:\n${lines.join('\n')}`;
      }
    } else if (
      normalizedQuestion.includes('slow') ||
      normalizedQuestion.includes('not selling') ||
      normalizedQuestion.includes('dead') ||
      normalizedQuestion.includes('滞销') ||
      normalizedQuestion.includes('卖不动') ||
      normalizedQuestion.includes('不好卖')
    ) {
      type = InsightType.slow_movers;
      const { slowMovers, message } = await this.getSlowMovers();
      if (slowMovers.length === 0) {
        result = answerInChinese ? '所有在售商品最近都有销售记录。' : message;
      } else {
        const lines = slowMovers
          .slice(0, 5)
          .map((product) =>
            answerInChinese
              ? `- ${product.name}: 当前库存 ${product.currentStock} 件，过去 30 天没有销售`
              : `- ${product.name}: ${product.currentStock} units in stock, no sales in 30 days`,
          );
        result = answerInChinese
          ? `有 ${slowMovers.length} 个商品过去 30 天没有销售。\n\n${lines.join('\n')}`
          : `${message}\n\n${lines.join('\n')}`;
      }
    } else {
      type = InsightType.sales_summary;
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart.getTime() + 86400000);

      const [productCount, todaySales, lowCount] = await this.prisma.$transaction([
        this.prisma.product.count({ where: { isActive: true } }),
        this.prisma.sale.count({ where: { createdAt: { gte: todayStart, lt: todayEnd } } }),
        this.prisma.product.count({
          where: {
            isActive: true,
            currentStock: { lte: this.prisma.product.fields.minStock },
          },
        }),
      ]);

      result = answerInChinese
        ? `门店概况：当前有 ${productCount} 个在售商品，今天 ${todaySales} 笔销售，${lowCount} 个商品低于或等于最低库存线。`
        : `Store summary: ${productCount} active product(s), ${todaySales} sale(s) today, ` +
          `${lowCount} product(s) at or below minimum stock level.`;
    }

    return { result, type, provider: 'local-fallback' };
  }

  private containsChinese(value: string) {
    return /[\u3400-\u9fff]/.test(value);
  }
}

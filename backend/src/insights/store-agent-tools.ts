import { z } from 'zod';

export type InsightAgentTool =
  | 'get_reorder_suggestions'
  | 'get_top_sellers'
  | 'get_slow_movers'
  | 'get_store_summary'
  | 'get_expiry_risks'
  | 'get_min_stock_review'
  | 'propose_purchase_orders'
  | 'propose_min_stock_change';

export interface StoreAgentToolDefinition {
  name: InsightAgentTool;
  title: string;
  description: string;
  // Read-only tools return data. Proposal tools record a pending change that
  // a person must approve; no tool changes store data by itself.
  readOnly: boolean;
  input: z.ZodObject;
}

const noInput = z.strictObject({});

// Single source of truth for the Store Agent tools. The OpenAI agent loop and
// the MCP server both expose exactly these tools.
export const STORE_AGENT_TOOLS: ReadonlyArray<StoreAgentToolDefinition> = [
  {
    name: 'get_reorder_suggestions',
    title: 'Reorder suggestions',
    description:
      'Return products at or below minimum stock with sales in the last 7 days, the 14-day demand forecast, recommended order quantities, suppliers, urgency, and estimated cost.',
    readOnly: true,
    input: noInput,
  },
  {
    name: 'get_top_sellers',
    title: 'Top sellers',
    description:
      'Return the best-selling products ranked by units sold, with revenue and current stock.',
    readOnly: true,
    input: noInput,
  },
  {
    name: 'get_slow_movers',
    title: 'Slow movers',
    description:
      'Return active products with stock but no sales in the last 30 days, including stock value and expiration information.',
    readOnly: true,
    input: noInput,
  },
  {
    name: 'get_store_summary',
    title: 'Store summary',
    description:
      'Return today sale count, active product count, and low-stock product count.',
    readOnly: true,
    input: noInput,
  },
  {
    name: 'get_expiry_risks',
    title: 'Expiry risks',
    description:
      'Return perishable products expiring within 14 days that are forecast not to sell out before their expiration date, with units and cost at risk and a suggested markdown price.',
    readOnly: true,
    input: noInput,
  },
  {
    name: 'get_min_stock_review',
    title: 'Minimum stock review',
    description:
      'Compare each product minimum stock (its reorder trigger) with forecast demand over the supplier lead time and return products whose minimum is clearly too high or too low, with a recommended value.',
    readOnly: true,
    input: noInput,
  },
  {
    name: 'propose_purchase_orders',
    title: 'Propose purchase orders',
    description:
      'Propose generating supplier-grouped purchase-order drafts from the current reorder suggestions. This only records a pending proposal; nothing is ordered until the store owner approves it in the app.',
    readOnly: false,
    input: noInput,
  },
  {
    name: 'propose_min_stock_change',
    title: 'Propose a minimum stock change',
    description:
      'Propose changing one product minimum stock, usually to the value recommended by get_min_stock_review. This only records a pending proposal; the minimum stock changes only after the store owner approves it.',
    readOnly: false,
    input: z.strictObject({
      productId: z.number().int().positive(),
      newMinStock: z.number().int().min(0).max(100_000),
      reason: z.string().min(1).max(300),
    }),
  },
];

export const STORE_AGENT_TOOL_NAMES = STORE_AGENT_TOOLS.map((tool) => tool.name);

export function findStoreAgentTool(name: string) {
  return STORE_AGENT_TOOLS.find((tool) => tool.name === name);
}

// Range and length keywords are enforced by zod when a tool runs; leaving them
// out of the model-facing schema keeps it within what strict mode accepts.
const MODEL_SCHEMA_OMITTED_KEYS = new Set([
  '$schema',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minLength',
  'maxLength',
]);

function toModelSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toModelSchema);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !MODEL_SCHEMA_OMITTED_KEYS.has(key))
      .map(([key, entry]) => [key, toModelSchema(entry)]),
  );
}

/** OpenAI Responses API function definitions (strict JSON schema). */
export function toOpenAiToolDefinitions() {
  return STORE_AGENT_TOOLS.map((tool) => {
    const parameters = toModelSchema(z.toJSONSchema(tool.input)) as Record<
      string,
      unknown
    >;
    return {
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: { required: [], ...parameters },
      strict: true,
    };
  });
}

// Intent phrases for the deterministic fallback agent, grouped by meaning
// rather than single keywords, and checked in order: an action request
// ("prepare the orders") wins over the question it implies ("what is low"),
// and "lots of stock but not selling" is a slow-mover question even though it
// mentions stock. Tuned against the dev split of eval/store-agent.cases.ts.
export const LOCAL_AGENT_INTENTS: { tool: InsightAgentTool; patterns: RegExp[] }[] = [
  {
    tool: 'propose_purchase_orders',
    patterns: [
      /\b(prepare|draft|create|generate|make|put together|write up|build)\b.{0,30}\b(purchase orders?|orders?|pos)\b/,
      /\bgo ahead and (order|place)/,
      /\b(pr[ée]pare|cr[ée]e|r[ée]dige|g[ée]n[èe]re|monte|fais)\S*.{0,30}\bcommandes?\b/,
      /(生成|准备|做|拟|整理|下).{0,8}(采购单|订单|采购订单)|(采购单|订单).{0,4}(准备|生成|做|拟)|帮我下单|直接下单/,
    ],
  },
  {
    // "What is below minimum stock?" asks what to reorder, not whether the
    // minimums are right.
    tool: 'get_reorder_suggestions',
    patterns: [
      /\b(below|under|beneath|at or below)\b.{0,12}\bmin/,
      /\b(sous|en dessous d[eu]s?)\b.{0,12}\b(seuil|minimum)/,
      /低于最低|低于安全库存|低于补货点/,
    ],
  },
  {
    tool: 'get_min_stock_review',
    patterns: [
      /\bmin(imum)?\b.{0,20}\b(stock|level|threshold|setting)s?\b|safety stock|reorder (point|level|threshold|trigger)s?|\bpar levels?\b/,
      /\bseuils?\b|stocks? minimums?|\bminimums\b|stocks? de s[ée]curit[ée]|niveaux? minimums?/,
      /最低库存|安全库存|补货点|触发点|库存下限|最低线/,
    ],
  },
  {
    tool: 'get_expiry_risks',
    patterns: [
      /expir|best[- ]before|use[- ]by|spoil|go(ing)? bad|goes bad|perishable/,
      /p[ée]rim|p[ée]remption|date limite|passer date|passe date/,
      /过期|临期|保质期|变质|坏掉/,
    ],
  },
  {
    tool: 'get_slow_movers',
    patterns: [
      /\bslow\b|not selling|\bdead\b|collecting dust|never (move|sell)|(don't|doesn't|do not|does not) (move|sell)/,
      /\bno sales?\b|without (a |any )?(single )?sale|haven't sold|not sold/,
      /se vendent? mal|vente lente|stagn|ne se vend(ent)? pas|\bdor(t|ment)\b|ne bougent? pas|aucune vente|invendu/,
      /滞销|卖不动|不好卖|没人买|卖不出|没卖出|没有卖出/,
    ],
  },
  {
    tool: 'get_reorder_suggestions',
    patterns: [
      /restock|re-?order|low stock|running (low|out)|run out|out of stock|sold out/,
      /\b(order|buy) (more|from)\b|need to order|place an? (purchase )?order|purchase order/,
      /r[ée]approvision|stock faible|rupture|commander|racheter|\bmanque/,
      /补货|进货|订货|订什么|缺货|卖完|快没|库存不足|库存低|不够卖/,
    ],
  },
  {
    tool: 'get_top_sellers',
    patterns: [
      /\btop\b|\bbest\b|popular|most (money|revenue|profit)|number one|bestsell/,
      /meilleur(e)?s? (ventes|vendeurs)|se vendent le mieux|plus vendu|rapporte le plus/,
      /热销|卖得最好|卖得好|销量|最赚钱|卖最多/,
    ],
  },
];

export function selectLocalAgentTool(question: string): InsightAgentTool {
  const normalizedQuestion = question.toLowerCase().replace(/[’`]/g, "'");
  for (const intent of LOCAL_AGENT_INTENTS) {
    if (intent.patterns.some((pattern) => pattern.test(normalizedQuestion))) {
      return intent.tool;
    }
  }
  return 'get_store_summary';
}

import type {
  InsightAgentTool,
  InsightLanguage,
} from '../src/insights/insights.service';

export interface StoreAgentEvalCase {
  id: string;
  // dev cases may guide changes to the agent; holdout and blind cases must
  // not. Blind cases were written by a separate model that never saw the
  // agent's code or intent rules.
  split: 'dev' | 'holdout' | 'blind';
  language: InsightLanguage;
  question: string;
  expectedTool: InsightAgentTool;
  // Fixture facts a correct answer has to surface.
  mustMention?: string[];
}

const REORDER = 'get_reorder_suggestions';
const TOP = 'get_top_sellers';
const SLOW = 'get_slow_movers';
const SUMMARY = 'get_store_summary';

// Questions phrased the way depanneur owners and cashiers actually ask, not
// only the keywords the local agent was written around.
export const STORE_AGENT_EVAL_CASES: StoreAgentEvalCase[] = [
  // English, dev
  { id: 'en-01', split: 'dev', language: 'en', question: 'What should I restock today?', expectedTool: REORDER, mustMention: ['Red Bull'] },
  { id: 'en-02', split: 'dev', language: 'en', question: 'What do I need to order from suppliers this week?', expectedTool: REORDER, mustMention: ['Red Bull'] },
  { id: 'en-03', split: 'dev', language: 'en', question: 'Are we running out of anything?', expectedTool: REORDER, mustMention: ['Red Bull'] },
  { id: 'en-04', split: 'dev', language: 'en', question: 'What are my best sellers?', expectedTool: TOP, mustMention: ['Coca-Cola'] },
  { id: 'en-05', split: 'dev', language: 'en', question: 'Which products bring in the most money?', expectedTool: TOP, mustMention: ['Coca-Cola'] },
  { id: 'en-06', split: 'dev', language: 'en', question: 'Which items are not selling?', expectedTool: SLOW, mustMention: ['Scented Candle'] },
  { id: 'en-07', split: 'dev', language: 'en', question: "What's collecting dust on the shelves?", expectedTool: SLOW, mustMention: ['Scented Candle'] },
  { id: 'en-08', split: 'dev', language: 'en', question: 'How is the store doing today?', expectedTool: SUMMARY },
  { id: 'en-09', split: 'dev', language: 'en', question: 'How many sales did we make today?', expectedTool: SUMMARY },
  { id: 'en-10', split: 'dev', language: 'en', question: 'Which products have I had in stock for a month without a single sale?', expectedTool: SLOW, mustMention: ['Scented Candle'] },

  // French, dev
  { id: 'fr-01', split: 'dev', language: 'fr', question: "Qu'est-ce que je dois commander cette semaine?", expectedTool: REORDER, mustMention: ['Red Bull'] },
  { id: 'fr-02', split: 'dev', language: 'fr', question: 'Quels produits sont en rupture de stock?', expectedTool: REORDER, mustMention: ['Red Bull'] },
  { id: 'fr-03', split: 'dev', language: 'fr', question: 'Il me reste combien de lait? Je dois en racheter?', expectedTool: REORDER, mustMention: ['Milk'] },
  { id: 'fr-04', split: 'dev', language: 'fr', question: 'Quels sont mes meilleurs vendeurs?', expectedTool: TOP, mustMention: ['Coca-Cola'] },
  { id: 'fr-05', split: 'dev', language: 'fr', question: 'Quels produits se vendent le mieux?', expectedTool: TOP, mustMention: ['Coca-Cola'] },
  { id: 'fr-06', split: 'dev', language: 'fr', question: 'Quels articles ne se vendent pas?', expectedTool: SLOW, mustMention: ['Scented Candle'] },
  { id: 'fr-07', split: 'dev', language: 'fr', question: "Qu'est-ce qui dort sur les tablettes?", expectedTool: SLOW, mustMention: ['Scented Candle'] },
  { id: 'fr-08', split: 'dev', language: 'fr', question: 'Résumé de la journée', expectedTool: SUMMARY },
  { id: 'fr-09', split: 'dev', language: 'fr', question: "Combien de ventes aujourd'hui?", expectedTool: SUMMARY },
  { id: 'fr-10', split: 'dev', language: 'fr', question: "Quel produit rapporte le plus d'argent?", expectedTool: TOP, mustMention: ['Coca-Cola'] },

  // Chinese, dev
  { id: 'zh-01', split: 'dev', language: 'zh', question: '今天需要补货吗？', expectedTool: REORDER, mustMention: ['Red Bull'] },
  { id: 'zh-02', split: 'dev', language: 'zh', question: '哪些商品快卖完了？', expectedTool: REORDER, mustMention: ['Red Bull'] },
  { id: 'zh-03', split: 'dev', language: 'zh', question: '这周要跟供应商订什么货？', expectedTool: REORDER, mustMention: ['Red Bull'] },
  { id: 'zh-04', split: 'dev', language: 'zh', question: '最近什么卖得最好？', expectedTool: TOP, mustMention: ['Coca-Cola'] },
  { id: 'zh-05', split: 'dev', language: 'zh', question: '哪些商品最赚钱？', expectedTool: TOP, mustMention: ['Coca-Cola'] },
  { id: 'zh-06', split: 'dev', language: 'zh', question: '哪些商品滞销？', expectedTool: SLOW, mustMention: ['Scented Candle'] },
  { id: 'zh-07', split: 'dev', language: 'zh', question: '哪些货放着没人买？', expectedTool: SLOW, mustMention: ['Scented Candle'] },
  { id: 'zh-08', split: 'dev', language: 'zh', question: '库存多但卖不动的有哪些？', expectedTool: SLOW, mustMention: ['Scented Candle'] },
  { id: 'zh-09', split: 'dev', language: 'zh', question: '今天店里情况怎么样？', expectedTool: SUMMARY },
  { id: 'zh-10', split: 'dev', language: 'zh', question: '今天卖了几单？', expectedTool: SUMMARY },

  // Holdout: written with the dev set, never used to tune the agent.
  { id: 'en-h1', split: 'holdout', language: 'en', question: 'Is anything out of stock right now?', expectedTool: REORDER, mustMention: ['Red Bull'] },
  { id: 'en-h2', split: 'holdout', language: 'en', question: 'Do I need to place a purchase order?', expectedTool: REORDER, mustMention: ['Red Bull'] },
  { id: 'en-h3', split: 'holdout', language: 'en', question: "What's our number one product?", expectedTool: TOP, mustMention: ['Coca-Cola'] },
  { id: 'en-h4', split: 'holdout', language: 'en', question: 'Which products just sit there and never move?', expectedTool: SLOW, mustMention: ['Scented Candle'] },
  { id: 'fr-h1', split: 'holdout', language: 'fr', question: 'Est-ce qu’il manque des produits sur les tablettes?', expectedTool: REORDER, mustMention: ['Red Bull'] },
  { id: 'fr-h2', split: 'holdout', language: 'fr', question: 'Quels produits ne bougent pas depuis un mois?', expectedTool: SLOW, mustMention: ['Scented Candle'] },
  { id: 'fr-h3', split: 'holdout', language: 'fr', question: 'Quel est le produit le plus vendu?', expectedTool: TOP, mustMention: ['Coca-Cola'] },
  { id: 'fr-h4', split: 'holdout', language: 'fr', question: 'Comment va le magasin aujourd’hui?', expectedTool: SUMMARY },
  { id: 'zh-h1', split: 'holdout', language: 'zh', question: '有没有缺货的商品？', expectedTool: REORDER, mustMention: ['Red Bull'] },
  { id: 'zh-h2', split: 'holdout', language: 'zh', question: '哪些商品一个月都没卖出去？', expectedTool: SLOW, mustMention: ['Scented Candle'] },
  { id: 'zh-h3', split: 'holdout', language: 'zh', question: '销量第一的是什么？', expectedTool: TOP, mustMention: ['Coca-Cola'] },
  { id: 'zh-h4', split: 'holdout', language: 'zh', question: '给我看看今天的经营概况', expectedTool: SUMMARY },

  // Blind: written independently from a description of the four tools only.
  { id: "en-b01", split: 'blind', language: 'en', question: "What do I need to order from my suppliers this week?", expectedTool: REORDER, mustMention: ['Red Bull'] },
  { id: "en-b02", split: 'blind', language: 'en', question: "anything I should be calling the supplier about? shelves are looking bare", expectedTool: REORDER, mustMention: ['Red Bull'] },
  { id: "en-b03", split: 'blind', language: 'en', question: "which items are about to run out on me", expectedTool: REORDER, mustMention: ['Red Bull'] },
  { id: "en-b04", split: 'blind', language: 'en', question: "What's flying off the shelves lately?", expectedTool: TOP, mustMention: ['Coca-Cola'] },
  { id: "en-b05", split: 'blind', language: 'en', question: "which products make me the most money", expectedTool: TOP, mustMention: ['Coca-Cola'] },
  { id: "en-b06", split: 'blind', language: 'en', question: "give me my top 5 most popular items", expectedTool: TOP, mustMention: ['Coca-Cola'] },
  { id: "en-b07", split: 'blind', language: 'en', question: "What's just sitting there collecting dust? Nobody's bought it in a month", expectedTool: SLOW, mustMention: ['Scented Candle'] },
  { id: "en-b08", split: 'blind', language: 'en', question: "which stuff isn't moving at all", expectedTool: SLOW, mustMention: ['Scented Candle'] },
  { id: "en-b09", split: 'blind', language: 'en', question: "I think I over-ordered some things. what hasn't sold in the past 30 days?", expectedTool: SLOW, mustMention: ['Scented Candle'] },
  { id: "en-b10", split: 'blind', language: 'en', question: "how's the store doing today?", expectedTool: SUMMARY },
  { id: "en-b11", split: 'blind', language: 'en', question: "quick snapshot of today please", expectedTool: SUMMARY },
  { id: "en-b12", split: 'blind', language: 'en', question: "how many sales have we rung up so far and how many products are we carrying?", expectedTool: SUMMARY },
  { id: "fr-b01", split: 'blind', language: 'fr', question: "Qu'est-ce que je dois commander chez mes fournisseurs?", expectedTool: REORDER, mustMention: ['Red Bull'] },
  { id: "fr-b02", split: 'blind', language: 'fr', question: "y a-tu des produits qui sont rendus à sec? faudrait que je rappelle le grossiste", expectedTool: REORDER, mustMention: ['Red Bull'] },
  { id: "fr-b03", split: 'blind', language: 'fr', question: "Quels articles sont presque épuisés, je veux faire une liste d'achats", expectedTool: REORDER, mustMention: ['Red Bull'] },
  { id: "fr-b04", split: 'blind', language: 'fr', question: "C'est quoi qui part le plus vite sur mes tablettes?", expectedTool: TOP, mustMention: ['Coca-Cola'] },
  { id: "fr-b05", split: 'blind', language: 'fr', question: "mes meilleurs vendeurs du moment?", expectedTool: TOP, mustMention: ['Coca-Cola'] },
  { id: "fr-b06", split: 'blind', language: 'fr', question: "Quels produits me rapportent le plus de cash?", expectedTool: TOP, mustMention: ['Coca-Cola'] },
  { id: "fr-b07", split: 'blind', language: 'fr', question: "Qu'est-ce qui dort sur les tablettes depuis un mois?", expectedTool: SLOW, mustMention: ['Scented Candle'] },
  { id: "fr-b08", split: 'blind', language: 'fr', question: "y a des affaires que personne n'achète, je veux savoir lesquelles", expectedTool: SLOW, mustMention: ['Scented Candle'] },
  { id: "fr-b09", split: 'blind', language: 'fr', question: "Quels produits en stock n'ont pas bougé depuis 30 jours?", expectedTool: SLOW, mustMention: ['Scented Candle'] },
  { id: "fr-b10", split: 'blind', language: 'fr', question: "Comment ça va au dépanneur aujourd'hui?", expectedTool: SUMMARY },
  { id: "fr-b11", split: 'blind', language: 'fr', question: "donne-moi un petit portrait de la journée", expectedTool: SUMMARY },
  { id: "fr-b12", split: 'blind', language: 'fr', question: "On a fait combien de ventes à date aujourd'hui?", expectedTool: SUMMARY },
  { id: "zh-b01", split: 'blind', language: 'zh', question: "哪些货快没了，需要进货？", expectedTool: REORDER, mustMention: ['Red Bull'] },
  { id: "zh-b02", split: 'blind', language: 'zh', question: "有什么东西要给供应商打电话补货的吗", expectedTool: REORDER, mustMention: ['Red Bull'] },
  { id: "zh-b03", split: 'blind', language: 'zh', question: "货架上有些东西好像断货了，帮我看看该订哪些", expectedTool: REORDER, mustMention: ['Red Bull'] },
  { id: "zh-b04", split: 'blind', language: 'zh', question: "最近什么卖得最好？", expectedTool: TOP, mustMention: ['Coca-Cola'] },
  { id: "zh-b05", split: 'blind', language: 'zh', question: "哪几样东西最畅销，赚钱最多", expectedTool: TOP, mustMention: ['Coca-Cola'] },
  { id: "zh-b06", split: 'blind', language: 'zh', question: "帮我列一下销量前十的商品", expectedTool: TOP, mustMention: ['Coca-Cola'] },
  { id: "zh-b07", split: 'blind', language: 'zh', question: "有哪些东西放了一个月都没人买？", expectedTool: SLOW, mustMention: ['Scented Candle'] },
  { id: "zh-b08", split: 'blind', language: 'zh', question: "哪些商品是滞销品，压在仓库里卖不动", expectedTool: SLOW, mustMention: ['Scented Candle'] },
  { id: "zh-b09", split: 'blind', language: 'zh', question: "有库存但是30天内一件都没卖出去的有哪些", expectedTool: SLOW, mustMention: ['Scented Candle'] },
  { id: "zh-b10", split: 'blind', language: 'zh', question: "今天店里生意怎么样？", expectedTool: SUMMARY },
  { id: "zh-b11", split: 'blind', language: 'zh', question: "给我看一下今天的整体情况", expectedTool: SUMMARY },
  { id: "zh-b12", split: 'blind', language: 'zh', question: "今天已经卖了多少单，店里一共有多少种商品在卖？", expectedTool: SUMMARY },
];

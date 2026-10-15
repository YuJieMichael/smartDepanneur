import type {
  InsightAgentTool,
  InsightLanguage,
} from '../src/insights/insights.service';

export interface StoreAgentEvalCase {
  id: string;
  // dev cases may guide changes to the agent; holdout and blind cases must
  // not. Blind cases were written by a separate model that never saw the
  // agent's code or intent rules. blind-v2 covers the expiry, minimum-stock
  // and proposal tools; it was also written blind, but the developer read it
  // before writing those rules, so it is a weaker check than blind.
  split: 'dev' | 'holdout' | 'blind' | 'blind-v2';
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
const EXPIRY = 'get_expiry_risks';
const MIN_STOCK = 'get_min_stock_review';
const PROPOSE_PO = 'propose_purchase_orders';

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
  // Expiry, minimum stock and proposals: dev
  { id: 'en-11', split: 'dev', language: 'en', question: 'Which products expire soon?', expectedTool: EXPIRY, mustMention: ['Yogurt'] },
  { id: 'en-12', split: 'dev', language: 'en', question: "What's about to pass its best-before date?", expectedTool: EXPIRY, mustMention: ['Yogurt'] },
  { id: 'en-13', split: 'dev', language: 'en', question: 'Are my minimum stock levels right?', expectedTool: MIN_STOCK, mustMention: ['Coca-Cola'] },
  { id: 'en-14', split: 'dev', language: 'en', question: 'Should I change any reorder points?', expectedTool: MIN_STOCK, mustMention: ['Coca-Cola'] },
  { id: 'en-15', split: 'dev', language: 'en', question: 'Prepare the purchase orders for me', expectedTool: PROPOSE_PO },
  { id: 'en-16', split: 'dev', language: 'en', question: "Draft today's orders for my suppliers", expectedTool: PROPOSE_PO },
  { id: 'en-17', split: 'dev', language: 'en', question: 'Which products are below minimum stock?', expectedTool: REORDER, mustMention: ['Red Bull'] },
  { id: 'fr-11', split: 'dev', language: 'fr', question: 'Quels produits vont expirer bientôt?', expectedTool: EXPIRY, mustMention: ['Yogurt'] },
  { id: 'fr-12', split: 'dev', language: 'fr', question: 'Qu’est-ce qui approche de la date de péremption?', expectedTool: EXPIRY, mustMention: ['Yogurt'] },
  { id: 'fr-13', split: 'dev', language: 'fr', question: 'Mes seuils de stock minimum sont-ils bons?', expectedTool: MIN_STOCK, mustMention: ['Coca-Cola'] },
  { id: 'fr-14', split: 'dev', language: 'fr', question: 'Faut-il ajuster mes stocks de sécurité?', expectedTool: MIN_STOCK, mustMention: ['Coca-Cola'] },
  { id: 'fr-15', split: 'dev', language: 'fr', question: 'Prépare les bons de commande', expectedTool: PROPOSE_PO },
  { id: 'fr-16', split: 'dev', language: 'fr', question: 'Crée les commandes pour mes fournisseurs', expectedTool: PROPOSE_PO },
  { id: 'zh-11', split: 'dev', language: 'zh', question: '哪些商品快过期了？', expectedTool: EXPIRY, mustMention: ['Yogurt'] },
  { id: 'zh-12', split: 'dev', language: 'zh', question: '有没有临期商品需要打折？', expectedTool: EXPIRY, mustMention: ['Yogurt'] },
  { id: 'zh-13', split: 'dev', language: 'zh', question: '最低库存设置合理吗？', expectedTool: MIN_STOCK, mustMention: ['Coca-Cola'] },
  { id: 'zh-14', split: 'dev', language: 'zh', question: '安全库存要不要调整？', expectedTool: MIN_STOCK, mustMention: ['Coca-Cola'] },
  { id: 'zh-15', split: 'dev', language: 'zh', question: '帮我生成采购单', expectedTool: PROPOSE_PO },
  { id: 'zh-16', split: 'dev', language: 'zh', question: '帮我把订单准备好', expectedTool: PROPOSE_PO },

  // Expiry, minimum stock and proposals: holdout
  { id: 'en-h5', split: 'holdout', language: 'en', question: 'Anything I should discount before it spoils?', expectedTool: EXPIRY, mustMention: ['Yogurt'] },
  { id: 'en-h6', split: 'holdout', language: 'en', question: 'Is my safety stock too high anywhere?', expectedTool: MIN_STOCK, mustMention: ['Coca-Cola'] },
  { id: 'en-h7', split: 'holdout', language: 'en', question: 'Create the supplier orders now', expectedTool: PROPOSE_PO },
  { id: 'fr-h5', split: 'holdout', language: 'fr', question: 'Des produits à écouler avant qu’ils périment?', expectedTool: EXPIRY, mustMention: ['Yogurt'] },
  { id: 'fr-h6', split: 'holdout', language: 'fr', question: 'Mes niveaux minimums sont-ils trop bas?', expectedTool: MIN_STOCK, mustMention: ['Coca-Cola'] },
  { id: 'fr-h7', split: 'holdout', language: 'fr', question: 'Rédige les commandes fournisseurs', expectedTool: PROPOSE_PO },
  { id: 'zh-h5', split: 'holdout', language: 'zh', question: '哪些东西要过保质期了？', expectedTool: EXPIRY, mustMention: ['Yogurt'] },
  { id: 'zh-h6', split: 'holdout', language: 'zh', question: '补货点需要调高吗？', expectedTool: MIN_STOCK, mustMention: ['Coca-Cola'] },
  { id: 'zh-h7', split: 'holdout', language: 'zh', question: '直接帮我下采购单', expectedTool: PROPOSE_PO },

  // Blind v2: expiry, minimum stock and proposal tools.
  { id: "en-c01", split: 'blind-v2', language: 'en', question: "What's going to go bad on me this week? Got a lot of milk and bread sitting around.", expectedTool: EXPIRY, mustMention: ['Yogurt'] },
  { id: "en-c02", split: 'blind-v2', language: 'en', question: "any eggs or bananas about to expire that I should mark down?", expectedTool: EXPIRY, mustMention: ['Yogurt'] },
  { id: "en-c03", split: 'blind-v2', language: 'en', question: "Which perishables should I put on sale before they hit their best-before date?", expectedTool: EXPIRY, mustMention: ['Yogurt'] },
  { id: "en-c04", split: 'blind-v2', language: 'en', question: "Are my reorder trigger levels set right? Feels like I'm holding too much safety stock on some stuff.", expectedTool: MIN_STOCK, mustMention: ['Coca-Cola'] },
  { id: "en-c05", split: 'blind-v2', language: 'en', question: "review my minimum stock settings against what's actually forecast to sell", expectedTool: MIN_STOCK, mustMention: ['Coca-Cola'] },
  { id: "en-c06", split: 'blind-v2', language: 'en', question: "Is the min level on my products too low? I keep running out of chips before the truck comes.", expectedTool: MIN_STOCK, mustMention: ['Coca-Cola'] },
  { id: "en-c07", split: 'blind-v2', language: 'en', question: "Go ahead and draft the purchase orders for my suppliers now.", expectedTool: PROPOSE_PO },
  { id: "en-c08", split: 'blind-v2', language: 'en', question: "can you put together the POs for this week's restock, I'll look them over after", expectedTool: PROPOSE_PO },
  { id: "en-c09", split: 'blind-v2', language: 'en', question: "Please prepare orders to send to each vendor based on what we need.", expectedTool: PROPOSE_PO },
  { id: "fr-c01", split: 'blind-v2', language: 'fr', question: "Qu'est-ce qui risque de périmer bientôt? J'ai trop de lait pis de pain.", expectedTool: EXPIRY, mustMention: ['Yogurt'] },
  { id: "fr-c02", split: 'blind-v2', language: 'fr', question: "Des produits frais à liquidider avant la date de péremption, avec un rabais suggéré?", expectedTool: EXPIRY, mustMention: ['Yogurt'] },
  { id: "fr-c03", split: 'blind-v2', language: 'fr', question: "Mes bananes et mes oeufs vont-ils passer date? Je devrais-tu les mettre en spécial?", expectedTool: EXPIRY, mustMention: ['Yogurt'] },
  { id: "fr-c04", split: 'blind-v2', language: 'fr', question: "Est-ce que mes seuils de réapprovisionnement sont trop élevés par rapport à la demande prévue?", expectedTool: MIN_STOCK, mustMention: ['Coca-Cola'] },
  { id: "fr-c05", split: 'blind-v2', language: 'fr', question: "Vérifie mon stock minimum, je pense que mon stock de sécurité est mal ajusté.", expectedTool: MIN_STOCK, mustMention: ['Coca-Cola'] },
  { id: "fr-c06", split: 'blind-v2', language: 'fr', question: "Mes minimums sont-ils trop bas? Je tombe toujours à sec sur les boissons énergisantes.", expectedTool: MIN_STOCK, mustMention: ['Coca-Cola'] },
  { id: "fr-c07", split: 'blind-v2', language: 'fr', question: "Prépare-moi les bons de commande pour mes fournisseurs, là, tout de suite.", expectedTool: PROPOSE_PO },
  { id: "fr-c08", split: 'blind-v2', language: 'fr', question: "Peux-tu me monter les commandes d'achat à envoyer cette semaine? Je les validerai après.", expectedTool: PROPOSE_PO },
  { id: "fr-c09", split: 'blind-v2', language: 'fr', question: "Crée les commandes fournisseurs pour ce qui manque, stp.", expectedTool: PROPOSE_PO },
  { id: "zh-c01", split: 'blind-v2', language: 'zh', question: "这周有哪些牛奶面包快过期了？库存是不是太多卖不完？", expectedTool: EXPIRY, mustMention: ['Yogurt'] },
  { id: "zh-c02", split: 'blind-v2', language: 'zh', question: "鸡蛋和香蕉还能放几天，要不要打折清掉？", expectedTool: EXPIRY, mustMention: ['Yogurt'] },
  { id: "zh-c03", split: 'blind-v2', language: 'zh', question: "帮我看看有没有临期的生鲜该降价处理", expectedTool: EXPIRY, mustMention: ['Yogurt'] },
  { id: "zh-c04", split: 'blind-v2', language: 'zh', question: "我的最低库存线设得合理吗？感觉有些商品安全库存压太多了", expectedTool: MIN_STOCK, mustMention: ['Coca-Cola'] },
  { id: "zh-c05", split: 'blind-v2', language: 'zh', question: "对照预测销量，检查一下各个商品的补货触发点是高了还是低了", expectedTool: MIN_STOCK, mustMention: ['Coca-Cola'] },
  { id: "zh-c06", split: 'blind-v2', language: 'zh', question: "薯片老是断货，是不是最低库存设太低了？", expectedTool: MIN_STOCK, mustMention: ['Coca-Cola'] },
  { id: "zh-c07", split: 'blind-v2', language: 'zh', question: "现在就帮我给供应商生成采购订单草稿", expectedTool: PROPOSE_PO },
  { id: "zh-c08", split: 'blind-v2', language: 'zh', question: "把这周要补的货整理成采购单，我待会儿过目", expectedTool: PROPOSE_PO },
  { id: "zh-c09", split: 'blind-v2', language: 'zh', question: "帮我下单吧，按缺的货给每个供应商各拟一份订单", expectedTool: PROPOSE_PO },
];

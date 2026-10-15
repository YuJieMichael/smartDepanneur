'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Input, Modal, Row, Space, Table, Tag } from 'antd';
import { BulbOutlined, CheckOutlined, CloseOutlined, FileAddOutlined, SendOutlined } from '@ant-design/icons';
import {
  AgentAction,
  apiApproveAgentAction,
  apiGetAgentActions,
  apiProposeMinStock,
  apiRejectAgentAction,
  MinStockActionPayload,
  PurchaseOrderActionPayload,
} from '@/api/agent-actions';
import {
  apiAskInsight,
  apiGeneratePurchaseOrders,
  apiGetExpiryRisks,
  apiGetMinStockReview,
  apiGetReorderSuggestions,
  apiGetSlowMovers,
  apiGetTopSellers,
  ExpiryRisk,
  GeneratedPurchaseOrder,
  GeneratedPurchaseOrderBatch,
  InsightAgentTool,
  MinStockReview,
  ReorderSuggestion,
  SlowMover,
  TopSeller,
} from '@/api/insights';
import { Locale, useI18nStore } from '@/lib/i18n';
import { globalMessage } from '@/lib/message-bridge';
import { ApiError } from '@/lib/request';

const suggestedQuestions: Record<Locale, string[]> = {
  en: [
    'What should I restock today?',
    'Prepare the purchase orders for me',
    'Which products expire soon?',
    'Are my minimum stock levels right?',
  ],
  fr: [
    'Que dois-je réapprovisionner aujourd’hui?',
    'Prépare les bons de commande',
    'Quels produits vont expirer bientôt?',
    'Mes seuils de stock minimum sont-ils bons?',
  ],
  zh: ['今天应该补什么货？', '帮我生成采购单', '哪些商品快过期了？', '最低库存设置合理吗？'],
};

const labels = {
  en: {
    title: 'Store Agent',
    askTitle: 'Ask the Store Agent',
    placeholder: 'Ask in English, e.g. What should I restock today?',
    ask: 'Ask',
    error: 'Unable to get an answer. Please try again.',
    local: 'Local Agent',
    tools: 'Tools used',
    product: 'Product',
    urgency: 'Urgency',
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    stock: 'Stock',
    sold7d: 'Sold (7d)',
    suggestOrder: 'Suggest Order',
    estCost: 'Est. Cost',
    supplier: 'Supplier',
    category: 'Category',
    totalSold: 'Total Sold',
    revenue: 'Revenue',
    inStock: 'In Stock',
    stockValue: 'Stock Value',
    expires: 'Expires',
    reorderTitle: 'Reorder Suggestions',
    topTitle: 'Top Sellers',
    slowTitle: 'Slow Movers (No Sales in 30 Days)',
    refresh: 'Refresh',
    loadReorder: 'Load Reorder Suggestions',
    loadTop: 'Load Top Sellers',
    loadSlow: 'Load Slow Movers',
    generateOrders: 'Generate Purchase Orders',
    generatingOrders: 'Generating...',
    orderError: 'Unable to generate purchase orders. Please try again.',
    ordersTitle: 'Purchase Orders',
    orderCreated: 'new draft(s) created',
    orderUpdated: 'existing draft(s) updated',
    orderNumber: 'Order No.',
    orderDate: 'Business Date',
    draft: 'Draft',
    quantity: 'Quantity',
    unitCost: 'Unit Cost',
    lineTotal: 'Line Total',
    orderTotal: 'Estimated Total',
    noSupplier: 'Supplier not assigned',
    noOrders: 'No purchase orders were needed.',
    close: 'Close',
    forecast14d: 'Forecast (14d)',
    pendingTitle: 'Pending actions',
    pendingHint: 'The agent only proposes. Nothing changes until the store owner approves.',
    noPending: 'No actions waiting for approval.',
    approve: 'Approve',
    approvedDone: 'Approved and applied.',
    rejectedDone: 'Proposal rejected. Nothing was changed.',
    reject: 'Reject',
    proposedBy: 'Proposed by',
    poAction: 'Generate purchase-order drafts',
    poDetail: '{items} product(s), {suppliers} supplier(s), about ${total}',
    minAction: 'Change minimum stock',
    minDetail: '{product}: {from} → {to}',
    ownerOnly: 'Only the store owner can approve or reject agent actions.',
    proposalCreated: 'The agent prepared a proposal. Review it under Pending actions.',
    expiryTitle: 'Expiry risks (next 14 days)',
    loadExpiry: 'Check expiry risks',
    daysLeft: 'Days left',
    atRisk: 'At risk',
    atRiskCost: 'Cost at risk',
    markdown: 'Suggested price',
    remove: 'Remove from shelf',
    belowCost: 'below cost',
    minTitle: 'Minimum stock review',
    loadMin: 'Review minimum stock',
    currentMin: 'Current min',
    recommendedMin: 'Recommended',
    raise: 'Raise',
    lower: 'Lower',
    avgDaily: 'Avg / day',
    minHint: 'Propose a change here or ask the agent. The store owner approves it under Pending actions.',
    propose: 'Propose',
    proposed: 'Proposed. Waiting for the owner’s approval.',
  },
  fr: {
    title: 'Agent du magasin',
    askTitle: 'Demander à l’agent du magasin',
    placeholder: 'Posez votre question en français',
    ask: 'Demander',
    error: 'Impossible d’obtenir une réponse. Veuillez réessayer.',
    local: 'Agent local',
    tools: 'Outils utilisés',
    product: 'Produit',
    urgency: 'Urgence',
    critical: 'Critique',
    high: 'Élevée',
    medium: 'Moyenne',
    stock: 'Stock',
    sold7d: 'Vendus (7 j)',
    suggestOrder: 'Commande suggérée',
    estCost: 'Coût estimé',
    supplier: 'Fournisseur',
    category: 'Catégorie',
    totalSold: 'Total vendu',
    revenue: 'Revenus',
    inStock: 'En stock',
    stockValue: 'Valeur du stock',
    expires: 'Expire le',
    reorderTitle: 'Suggestions de réapprovisionnement',
    topTitle: 'Meilleures ventes',
    slowTitle: 'Produits lents (aucune vente en 30 jours)',
    refresh: 'Actualiser',
    loadReorder: 'Charger les suggestions',
    loadTop: 'Charger les meilleures ventes',
    loadSlow: 'Charger les produits lents',
    generateOrders: 'Générer les bons de commande',
    generatingOrders: 'Génération...',
    orderError: 'Impossible de générer les bons de commande. Veuillez réessayer.',
    ordersTitle: 'Bons de commande',
    orderCreated: 'nouveau(x) brouillon(s) créé(s)',
    orderUpdated: 'brouillon(s) existant(s) mis à jour',
    orderNumber: 'No de commande',
    orderDate: 'Date commerciale',
    draft: 'Brouillon',
    quantity: 'Quantité',
    unitCost: 'Coût unitaire',
    lineTotal: 'Total',
    orderTotal: 'Total estimé',
    noSupplier: 'Fournisseur non attribué',
    noOrders: 'Aucun bon de commande nécessaire.',
    close: 'Fermer',
    forecast14d: 'Prévision (14 j)',
    pendingTitle: 'Actions en attente',
    pendingHint: 'L’agent propose seulement. Rien ne change avant l’approbation du propriétaire.',
    noPending: 'Aucune action en attente d’approbation.',
    approve: 'Approuver',
    approvedDone: 'Approuvée et appliquée.',
    rejectedDone: 'Proposition refusée. Rien n’a été modifié.',
    reject: 'Refuser',
    proposedBy: 'Proposé par',
    poAction: 'Générer des bons de commande',
    poDetail: '{items} produit(s), {suppliers} fournisseur(s), environ {total} $',
    minAction: 'Modifier le stock minimum',
    minDetail: '{product} : {from} → {to}',
    ownerOnly: 'Seul le propriétaire peut approuver ou refuser les actions de l’agent.',
    proposalCreated: 'L’agent a préparé une proposition. Vérifiez-la dans Actions en attente.',
    expiryTitle: 'Risques d’expiration (14 prochains jours)',
    loadExpiry: 'Vérifier les expirations',
    daysLeft: 'Jours restants',
    atRisk: 'À risque',
    atRiskCost: 'Coût à risque',
    markdown: 'Prix suggéré',
    remove: 'Retirer de la tablette',
    belowCost: 'sous le coût',
    minTitle: 'Revue des stocks minimums',
    loadMin: 'Revoir les stocks minimums',
    currentMin: 'Minimum actuel',
    recommendedMin: 'Recommandé',
    raise: 'Hausser',
    lower: 'Baisser',
    avgDaily: 'Moy. / jour',
    minHint: 'Proposez un changement ici ou demandez à l’agent. Le propriétaire l’approuve dans Actions en attente.',
    propose: 'Proposer',
    proposed: 'Proposé. En attente de l’approbation du propriétaire.',
  },
  zh: {
    title: '门店 Agent',
    askTitle: '询问门店 Agent',
    placeholder: '请使用中文提问，例如：今天应该补什么货？',
    ask: '询问',
    error: '暂时无法获取回答，请稍后重试。',
    local: '本地 Agent',
    tools: '已调用工具',
    product: '商品',
    urgency: '紧急程度',
    critical: '紧急',
    high: '较高',
    medium: '一般',
    stock: '库存',
    sold7d: '7 天销量',
    suggestOrder: '建议补货',
    estCost: '预计成本',
    supplier: '供应商',
    category: '分类',
    totalSold: '总销量',
    revenue: '收入',
    inStock: '库存',
    stockValue: '库存价值',
    expires: '过期日期',
    reorderTitle: '补货建议',
    topTitle: '热销商品',
    slowTitle: '滞销商品（30 天无销售）',
    refresh: '刷新',
    loadReorder: '加载补货建议',
    loadTop: '加载热销商品',
    loadSlow: '加载滞销商品',
    generateOrders: '一键生成采购单',
    generatingOrders: '正在生成...',
    orderError: '采购单生成失败，请稍后重试。',
    ordersTitle: '今日采购单',
    orderCreated: '张新草稿已创建',
    orderUpdated: '张原草稿已更新',
    orderNumber: '采购单号',
    orderDate: '营业日期',
    draft: '草稿',
    quantity: '数量',
    unitCost: '单价',
    lineTotal: '小计',
    orderTotal: '预计总额',
    noSupplier: '未指定供应商',
    noOrders: '当前无需生成采购单。',
    close: '关闭',
    forecast14d: '14 天预测',
    pendingTitle: '待审批操作',
    pendingHint: 'Agent 只负责提议，店主批准前不会改动任何数据。',
    noPending: '暂无待审批操作。',
    approve: '批准',
    approvedDone: '已批准并执行。',
    rejectedDone: '已拒绝提案，没有任何改动。',
    reject: '拒绝',
    proposedBy: '提议来源',
    poAction: '生成采购单草稿',
    poDetail: '{items} 个商品，{suppliers} 个供应商，预计 ${total}',
    minAction: '调整最低库存',
    minDetail: '{product}：{from} → {to}',
    ownerOnly: '只有店主可以批准或拒绝 Agent 的操作。',
    proposalCreated: 'Agent 已准备好提案，请在“待审批操作”中查看。',
    expiryTitle: '临期风险（未来 14 天）',
    loadExpiry: '检查临期风险',
    daysLeft: '剩余天数',
    atRisk: '可能卖不完',
    atRiskCost: '风险成本',
    markdown: '建议售价',
    remove: '下架',
    belowCost: '低于成本',
    minTitle: '最低库存检查',
    loadMin: '检查最低库存',
    currentMin: '当前最低库存',
    recommendedMin: '建议值',
    raise: '调高',
    lower: '调低',
    avgDaily: '日均预测',
    minHint: '可以在这里提议修改，也可以让 Agent 提议；店主在“待审批操作”中批准。',
    propose: '提议修改',
    proposed: '已提议，等待店主批准。',
  },
};

const toolLabels: Record<Locale, Record<InsightAgentTool, string>> = {
  en: {
    get_reorder_suggestions: 'Reorder suggestions',
    get_top_sellers: 'Top sellers',
    get_slow_movers: 'Slow movers',
    get_store_summary: 'Store summary',
    get_expiry_risks: 'Expiry risks',
    get_min_stock_review: 'Minimum stock review',
    propose_purchase_orders: 'Purchase-order proposal',
    propose_min_stock_change: 'Minimum stock proposal',
  },
  fr: {
    get_reorder_suggestions: 'Réapprovisionnement',
    get_top_sellers: 'Meilleures ventes',
    get_slow_movers: 'Produits lents',
    get_store_summary: 'Résumé du magasin',
    get_expiry_risks: 'Risques d’expiration',
    get_min_stock_review: 'Revue des minimums',
    propose_purchase_orders: 'Proposition de commandes',
    propose_min_stock_change: 'Proposition de minimum',
  },
  zh: {
    get_reorder_suggestions: '补货建议',
    get_top_sellers: '热销商品',
    get_slow_movers: '滞销商品',
    get_store_summary: '门店概况',
    get_expiry_risks: '临期风险',
    get_min_stock_review: '最低库存检查',
    propose_purchase_orders: '采购单提案',
    propose_min_stock_change: '最低库存提案',
  },
};

export default function InsightsPage() {
  const locale = useI18nStore((state) => state.locale);
  const text = labels[locale];
  const [reorderData, setReorderData] = useState<{ suggestions: ReorderSuggestion[]; summary: string } | null>(null);
  const [topSellers, setTopSellers] = useState<TopSeller[] | null>(null);
  const [slowMovers, setSlowMovers] = useState<{ slowMovers: SlowMover[]; message: string } | null>(null);
  const [loadingReorder, setLoadingReorder] = useState(false);
  const [loadingTop, setLoadingTop] = useState(false);
  const [loadingSlow, setLoadingSlow] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [provider, setProvider] = useState<'openai-agent' | 'local-agent' | ''>('');
  const [toolsUsed, setToolsUsed] = useState<InsightAgentTool[]>([]);
  const [loadingAsk, setLoadingAsk] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [purchaseOrderBatch, setPurchaseOrderBatch] =
    useState<GeneratedPurchaseOrderBatch | null>(null);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [pendingActions, setPendingActions] = useState<AgentAction[]>([]);
  const [decidingId, setDecidingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  const [proposalNotice, setProposalNotice] = useState(false);
  const [expiry, setExpiry] = useState<{ risks: ExpiryRisk[]; summary: string } | null>(null);
  const [loadingExpiry, setLoadingExpiry] = useState(false);
  const [minReview, setMinReview] = useState<{ reviews: MinStockReview[]; summary: string } | null>(null);
  const [loadingMin, setLoadingMin] = useState(false);

  const loadPending = useCallback(async () => {
    try {
      setPendingActions(await apiGetAgentActions('pending'));
    } catch {
      setPendingActions([]);
    }
  }, []);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  useEffect(() => {
    setQuestion('');
    setAnswer('');
    setProvider('');
    setToolsUsed([]);
    setReorderData(null);
    setOrderError('');
    setPurchaseOrderBatch(null);
    setOrdersOpen(false);
    setExpiry(null);
    setMinReview(null);
    setProposalNotice(false);
  }, [locale]);

  const loadReorder = async () => {
    setLoadingReorder(true);
    try {
      setReorderData(await apiGetReorderSuggestions(locale));
    } finally {
      setLoadingReorder(false);
    }
  };

  const loadTop = async () => {
    setLoadingTop(true);
    try {
      const result = await apiGetTopSellers();
      setTopSellers(result.topSellers);
    } finally {
      setLoadingTop(false);
    }
  };

  const loadSlow = async () => {
    setLoadingSlow(true);
    try {
      setSlowMovers(await apiGetSlowMovers());
    } finally {
      setLoadingSlow(false);
    }
  };

  const loadExpiry = async () => {
    setLoadingExpiry(true);
    try {
      setExpiry(await apiGetExpiryRisks(locale));
    } finally {
      setLoadingExpiry(false);
    }
  };

  const loadMinReview = async () => {
    setLoadingMin(true);
    try {
      setMinReview(await apiGetMinStockReview(locale));
    } finally {
      setLoadingMin(false);
    }
  };

  const decide = async (action: AgentAction, decision: 'approve' | 'reject') => {
    setDecidingId(action.id);
    setActionError('');
    try {
      const result =
        decision === 'approve'
          ? await apiApproveAgentAction(action.id)
          : await apiRejectAgentAction(action.id);
      if (result.status === 'failed' && result.error) setActionError(result.error);
      if (result.status === 'approved') {
        globalMessage.success(text.approvedDone);
        void loadReorder();
      }
      if (result.status === 'rejected') globalMessage.warning(text.rejectedDone);
    } catch (error) {
      setActionError(
        error instanceof ApiError && error.status === 403
          ? text.ownerOnly
          : error instanceof Error
            ? error.message
            : String(error),
      );
    } finally {
      setDecidingId(null);
      void loadPending();
    }
  };

  const proposeMinStock = async (row: MinStockReview) => {
    try {
      await apiProposeMinStock(row.productId, row.recommendedMinStock);
      globalMessage.success(text.proposed);
      void loadPending();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  };

  const describeAction = (action: AgentAction) => {
    if (action.type === 'generate_purchase_orders') {
      const payload = action.payload as PurchaseOrderActionPayload;
      return {
        title: text.poAction,
        detail: text.poDetail
          .replace('{items}', String(payload.itemCount))
          .replace('{suppliers}', String(payload.supplierCount))
          .replace('{total}', payload.estimatedTotal),
      };
    }
    const payload = action.payload as MinStockActionPayload;
    return {
      title: text.minAction,
      detail: text.minDetail
        .replace('{product}', payload.productName)
        .replace('{from}', String(payload.currentMinStock))
        .replace('{to}', String(payload.newMinStock)),
    };
  };

  const handleAsk = async (value = question) => {
    if (!value.trim()) return;
    setQuestion(value);
    setLoadingAsk(true);
    try {
      const result = await apiAskInsight(value, locale);
      setAnswer(result.answer);
      setProvider(result.provider);
      setToolsUsed(result.toolsUsed);
      setProposalNotice(result.proposals.length > 0);
      if (result.proposals.length > 0) void loadPending();
    } catch {
      setAnswer(text.error);
      setProvider('');
      setToolsUsed([]);
    } finally {
      setLoadingAsk(false);
    }
  };

  const handleGenerateOrders = async () => {
    setLoadingOrders(true);
    setOrderError('');
    try {
      const result = await apiGeneratePurchaseOrders(locale);
      setPurchaseOrderBatch(result);
      setOrdersOpen(true);
    } catch {
      setOrderError(text.orderError);
    } finally {
      setLoadingOrders(false);
    }
  };

  const urgencyColor = { critical: 'red', high: 'orange', medium: 'gold' } as const;
  const urgencyLabel = {
    critical: text.critical,
    high: text.high,
    medium: text.medium,
  };
  const formatUnit = (unit: string) => {
    const unitKey = unit.toLowerCase();
    const translatedUnits: Record<Locale, Record<string, string>> = {
      en: {},
      fr: {
        unit: 'unité',
        bottle: 'bouteille',
        pack: 'paquet',
        box: 'boîte',
        case: 'caisse',
        can: 'canette',
        carton: 'carton',
        piece: 'pièce',
        bag: 'sac',
      },
      zh: {
        unit: '件',
        bottle: '瓶',
        pack: '包',
        box: '盒',
        case: '箱',
        can: '罐',
        carton: '盒',
        piece: '件',
        bag: '袋',
      },
    };

    return translatedUnits[locale][unitKey] ?? unit;
  };

  const reorderColumns = [
    { title: text.product, dataIndex: 'productName', key: 'name' },
    {
      title: text.urgency,
      dataIndex: 'urgency',
      key: 'urgency',
      render: (value: ReorderSuggestion['urgency']) => (
        <Tag color={urgencyColor[value]}>{urgencyLabel[value]}</Tag>
      ),
    },
    {
      title: text.stock,
      key: 'stock',
      render: (_: unknown, row: ReorderSuggestion) => `${row.currentStock}/${row.minStock}`,
    },
    { title: text.sold7d, dataIndex: 'soldLast7Days', key: 'sold' },
    { title: text.forecast14d, dataIndex: 'forecastNext14Days', key: 'forecast' },
    {
      title: text.suggestOrder,
      dataIndex: 'suggestedReorderQty',
      key: 'qty',
      render: (value: number, row: ReorderSuggestion) =>
        `${value} ${formatUnit(row.unit)}`,
    },
    {
      title: text.estCost,
      dataIndex: 'estimatedCost',
      key: 'cost',
      render: (value: string) => `$${parseFloat(value).toFixed(2)}`,
    },
    {
      title: text.supplier,
      key: 'supplier',
      render: (_: unknown, row: ReorderSuggestion) => row.supplier?.name ?? '-',
    },
  ];

  const topColumns = [
    { title: '#', key: 'rank', render: (_: unknown, __: unknown, index: number) => index + 1 },
    { title: text.product, dataIndex: 'productName', key: 'name' },
    {
      title: text.category,
      key: 'category',
      render: (_: unknown, row: TopSeller) => row.category?.name ?? '-',
    },
    { title: text.totalSold, dataIndex: 'totalSold', key: 'sold' },
    {
      title: text.revenue,
      dataIndex: 'totalRevenue',
      key: 'revenue',
      render: (value: string) => `$${parseFloat(value).toFixed(2)}`,
    },
    { title: text.inStock, dataIndex: 'currentStock', key: 'stock' },
  ];

  const slowColumns = [
    { title: text.product, dataIndex: 'name', key: 'name' },
    { title: text.inStock, dataIndex: 'currentStock', key: 'stock' },
    {
      title: text.stockValue,
      dataIndex: 'stockValue',
      key: 'value',
      render: (value: string) => `$${parseFloat(value).toFixed(2)}`,
    },
    {
      title: text.category,
      key: 'category',
      render: (_: unknown, row: SlowMover) => row.category?.name ?? '-',
    },
    {
      title: text.expires,
      dataIndex: 'expirationDate',
      key: 'expiration',
      render: (value: string | null) => (value ? new Date(value).toLocaleDateString() : '-'),
    },
  ];

  const expiryColumns = [
    { title: text.product, dataIndex: 'productName', key: 'name' },
    { title: text.expires, dataIndex: 'expirationDate', key: 'expires' },
    { title: text.daysLeft, dataIndex: 'daysLeft', key: 'daysLeft' },
    {
      title: text.atRisk,
      key: 'atRisk',
      render: (_: unknown, row: ExpiryRisk) =>
        `${row.atRiskUnits}/${row.currentStock} ${formatUnit(row.unit)}`,
    },
    {
      title: text.atRiskCost,
      dataIndex: 'atRiskCost',
      key: 'cost',
      render: (value: string) => `$${parseFloat(value).toFixed(2)}`,
    },
    {
      title: text.markdown,
      key: 'markdown',
      render: (_: unknown, row: ExpiryRisk) =>
        row.action === 'remove' ? (
          <Tag color="red">{text.remove}</Tag>
        ) : (
          <Space size={4}>
            <Tag color="orange">-{row.suggestedDiscountPct}%</Tag>
            <span>{`$${parseFloat(row.suggestedPrice ?? '0').toFixed(2)}`}</span>
            {row.belowCost && <Tag>{text.belowCost}</Tag>}
          </Space>
        ),
    },
  ];

  const minColumns = [
    { title: text.product, dataIndex: 'productName', key: 'name' },
    { title: text.currentMin, dataIndex: 'currentMinStock', key: 'current' },
    {
      title: text.recommendedMin,
      key: 'recommended',
      render: (_: unknown, row: MinStockReview) => (
        <Space size={4}>
          <strong>{row.recommendedMinStock}</strong>
          <Tag color={row.direction === 'raise' ? 'orange' : 'blue'}>
            {row.direction === 'raise' ? text.raise : text.lower}
          </Tag>
        </Space>
      ),
    },
    { title: text.avgDaily, dataIndex: 'averageDailyForecast', key: 'avg' },
    {
      title: '',
      key: 'propose',
      render: (_: unknown, row: MinStockReview) => (
        <Button size="small" onClick={() => void proposeMinStock(row)}>
          {text.propose}
        </Button>
      ),
    },
  ];

  const purchaseOrderItemColumns = [
    { title: text.product, dataIndex: 'productName', key: 'productName' },
    {
      title: text.quantity,
      dataIndex: 'quantity',
      key: 'quantity',
      render: (value: number, row: GeneratedPurchaseOrder['items'][number]) =>
        `${value} ${formatUnit(row.unit)}`,
    },
    {
      title: text.unitCost,
      dataIndex: 'unitCost',
      key: 'unitCost',
      render: (value: string) => `$${parseFloat(value).toFixed(2)}`,
    },
    {
      title: text.lineTotal,
      dataIndex: 'lineTotal',
      key: 'lineTotal',
      render: (value: string) => `$${parseFloat(value).toFixed(2)}`,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 20, fontSize: 20, fontWeight: 700 }}>
        <BulbOutlined style={{ marginRight: 8 }} />
        {text.title}
      </h2>

      <Card
        title={text.pendingTitle}
        style={{ marginBottom: 24 }}
        extra={
          <Button size="small" onClick={() => void loadPending()}>
            {text.refresh}
          </Button>
        }
      >
        <Alert type="info" showIcon message={text.pendingHint} style={{ marginBottom: 12 }} />
        {actionError && (
          <Alert
            type="error"
            message={actionError}
            closable
            onClose={() => setActionError('')}
            style={{ marginBottom: 12 }}
          />
        )}
        {pendingActions.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text.noPending} />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            {pendingActions.map((action) => {
              const description = describeAction(action);
              return (
                <Card key={action.id} size="small">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <strong>{description.title}</strong>
                      <div>{description.detail}</div>
                      <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
                        {action.rationale} · {text.proposedBy}:{' '}
                        {action.source === 'openai-agent'
                          ? 'OpenAI Agent'
                          : action.source === 'mcp'
                            ? 'MCP'
                            : action.source === 'min-stock-review'
                              ? action.requestedBy?.email ?? text.minTitle
                              : text.local}
                      </div>
                    </div>
                    <Space>
                      <Button
                        type="primary"
                        icon={<CheckOutlined />}
                        loading={decidingId === action.id}
                        onClick={() => void decide(action, 'approve')}
                      >
                        {text.approve}
                      </Button>
                      <Button
                        icon={<CloseOutlined />}
                        disabled={decidingId === action.id}
                        onClick={() => void decide(action, 'reject')}
                      >
                        {text.reject}
                      </Button>
                    </Space>
                  </div>
                </Card>
              );
            })}
          </Space>
        )}
      </Card>

      <Card title={text.askTitle} style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={text.placeholder}
            onPressEnter={() => handleAsk()}
            style={{ flex: 1 }}
          />
          <Button type="primary" icon={<SendOutlined />} loading={loadingAsk} onClick={() => handleAsk()}>
            {text.ask}
          </Button>
        </div>
        <Space wrap style={{ marginBottom: answer ? 12 : 0 }}>
          {suggestedQuestions[locale].map((item) => (
            <Button key={item} size="small" onClick={() => handleAsk(item)}>
              {item}
            </Button>
          ))}
        </Space>
        {answer && (
          <Alert
            type="info"
            message={
              <>
                {provider && (
                  <Tag color={provider === 'openai-agent' ? 'green' : 'gold'} style={{ marginBottom: 8 }}>
                    {provider === 'openai-agent' ? 'OpenAI Agent' : text.local}
                  </Tag>
                )}
                {toolsUsed.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ marginRight: 6 }}>{text.tools}:</span>
                    {toolsUsed.map((tool) => (
                      <Tag key={tool}>{toolLabels[locale][tool]}</Tag>
                    ))}
                  </div>
                )}
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{answer}</pre>
                {proposalNotice && (
                  <Alert type="warning" showIcon message={text.proposalCreated} style={{ marginTop: 8 }} />
                )}
              </>
            }
          />
        )}
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card
            title={text.reorderTitle}
            extra={
              <Space wrap>
                {reorderData && reorderData.suggestions.length > 0 && (
                  <Button
                    type="primary"
                    icon={<FileAddOutlined />}
                    onClick={handleGenerateOrders}
                    loading={loadingOrders}
                  >
                    {loadingOrders ? text.generatingOrders : text.generateOrders}
                  </Button>
                )}
                <Button size="small" onClick={loadReorder} loading={loadingReorder}>
                  {text.refresh}
                </Button>
              </Space>
            }
          >
            {reorderData ? (
              <>
                <Alert
                  type={reorderData.suggestions.length === 0 ? 'success' : 'warning'}
                  message={reorderData.summary}
                  style={{ marginBottom: 12 }}
                />
                {reorderData.suggestions.length > 0 && (
                  <>
                    {orderError && (
                      <Alert
                        type="error"
                        message={orderError}
                        closable
                        onClose={() => setOrderError('')}
                        style={{ marginBottom: 12 }}
                      />
                    )}
                    <Table
                      size="small"
                      dataSource={reorderData.suggestions}
                      columns={reorderColumns}
                      rowKey="productId"
                      pagination={false}
                      scroll={{ x: 760 }}
                    />
                  </>
                )}
              </>
            ) : (
              <Button onClick={loadReorder} loading={loadingReorder}>
                {text.loadReorder}
              </Button>
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card
            title={text.expiryTitle}
            extra={
              <Button size="small" onClick={loadExpiry} loading={loadingExpiry}>
                {text.refresh}
              </Button>
            }
          >
            {expiry ? (
              <>
                <Alert
                  type={expiry.risks.length === 0 ? 'success' : 'warning'}
                  message={expiry.summary}
                  style={{ marginBottom: 12 }}
                />
                {expiry.risks.length > 0 && (
                  <Table
                    size="small"
                    dataSource={expiry.risks}
                    columns={expiryColumns}
                    rowKey="productId"
                    pagination={false}
                    scroll={{ x: 640 }}
                  />
                )}
              </>
            ) : (
              <Button onClick={loadExpiry} loading={loadingExpiry}>
                {text.loadExpiry}
              </Button>
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card
            title={text.minTitle}
            extra={
              <Button size="small" onClick={loadMinReview} loading={loadingMin}>
                {text.refresh}
              </Button>
            }
          >
            {minReview ? (
              <>
                <Alert
                  type={minReview.reviews.length === 0 ? 'success' : 'warning'}
                  message={minReview.summary}
                  description={minReview.reviews.length > 0 ? text.minHint : undefined}
                  style={{ marginBottom: 12 }}
                />
                {minReview.reviews.length > 0 && (
                  <Table
                    size="small"
                    dataSource={minReview.reviews}
                    columns={minColumns}
                    rowKey="productId"
                    pagination={false}
                  />
                )}
              </>
            ) : (
              <Button onClick={loadMinReview} loading={loadingMin}>
                {text.loadMin}
              </Button>
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card
            title={text.topTitle}
            extra={
              <Button size="small" onClick={loadTop} loading={loadingTop}>
                {text.refresh}
              </Button>
            }
          >
            {topSellers ? (
              <Table size="small" dataSource={topSellers} columns={topColumns} rowKey="productId" pagination={false} />
            ) : (
              <Button onClick={loadTop} loading={loadingTop}>
                {text.loadTop}
              </Button>
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card
            title={text.slowTitle}
            extra={
              <Button size="small" onClick={loadSlow} loading={loadingSlow}>
                {text.refresh}
              </Button>
            }
          >
            {slowMovers ? (
              <>
                <Alert
                  type={slowMovers.slowMovers.length === 0 ? 'success' : 'warning'}
                  message={slowMovers.message}
                  style={{ marginBottom: 12 }}
                />
                {slowMovers.slowMovers.length > 0 && (
                  <Table
                    size="small"
                    dataSource={slowMovers.slowMovers}
                    columns={slowColumns}
                    rowKey="id"
                    pagination={false}
                  />
                )}
              </>
            ) : (
              <Button onClick={loadSlow} loading={loadingSlow}>
                {text.loadSlow}
              </Button>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title={text.ordersTitle}
        open={ordersOpen}
        onCancel={() => setOrdersOpen(false)}
        width={860}
        footer={
          <Button type="primary" onClick={() => setOrdersOpen(false)}>
            {text.close}
          </Button>
        }
      >
        {purchaseOrderBatch && (
          <>
            <Alert
              type={purchaseOrderBatch.orders.length > 0 ? 'success' : 'info'}
              message={
                purchaseOrderBatch.orders.length > 0
                  ? `${purchaseOrderBatch.createdCount} ${text.orderCreated}，${purchaseOrderBatch.updatedCount} ${text.orderUpdated}`
                  : text.noOrders
              }
              description={`${text.orderDate}: ${purchaseOrderBatch.businessDate}`}
              style={{ marginBottom: 16 }}
            />
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {purchaseOrderBatch.orders.map((order) => (
                <Card
                  key={order.id}
                  size="small"
                  title={order.supplier?.name ?? text.noSupplier}
                  extra={<Tag color="blue">{text.draft}</Tag>}
                >
                  <Space wrap style={{ marginBottom: 12 }}>
                    <span>
                      <strong>{text.orderNumber}:</strong> {order.orderNumber}
                    </span>
                    {order.supplier?.phone && <span>{order.supplier.phone}</span>}
                    {order.supplier?.email && <span>{order.supplier.email}</span>}
                  </Space>
                  <Table
                    size="small"
                    dataSource={order.items}
                    columns={purchaseOrderItemColumns}
                    rowKey="id"
                    pagination={false}
                    scroll={{ x: 560 }}
                    summary={() => (
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={3}>
                          <strong>{text.orderTotal}</strong>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3}>
                          <strong>${parseFloat(order.estimatedTotal).toFixed(2)}</strong>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    )}
                  />
                </Card>
              ))}
            </Space>
          </>
        )}
      </Modal>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Input, Row, Space, Table, Tag } from 'antd';
import { BulbOutlined, SendOutlined } from '@ant-design/icons';
import {
  apiAskInsight,
  apiGetReorderSuggestions,
  apiGetSlowMovers,
  apiGetTopSellers,
  InsightAgentTool,
  ReorderSuggestion,
  SlowMover,
  TopSeller,
} from '@/api/insights';
import { Locale, useI18nStore } from '@/lib/i18n';

const suggestedQuestions: Record<Locale, string[]> = {
  en: [
    'What should I restock today?',
    'Show me the top sellers',
    'Which products are not selling?',
  ],
  fr: [
    'Que dois-je réapprovisionner aujourd’hui?',
    'Quels produits se vendent le mieux?',
    'Quels produits se vendent mal?',
  ],
  zh: ['今天应该补什么货？', '哪些商品卖得最好？', '哪些商品卖不动？'],
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
  },
};

const toolLabels: Record<Locale, Record<InsightAgentTool, string>> = {
  en: {
    get_reorder_suggestions: 'Reorder suggestions',
    get_top_sellers: 'Top sellers',
    get_slow_movers: 'Slow movers',
    get_store_summary: 'Store summary',
  },
  fr: {
    get_reorder_suggestions: 'Réapprovisionnement',
    get_top_sellers: 'Meilleures ventes',
    get_slow_movers: 'Produits lents',
    get_store_summary: 'Résumé du magasin',
  },
  zh: {
    get_reorder_suggestions: '补货建议',
    get_top_sellers: '热销商品',
    get_slow_movers: '滞销商品',
    get_store_summary: '门店概况',
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

  useEffect(() => {
    setQuestion('');
    setAnswer('');
    setProvider('');
    setToolsUsed([]);
    setReorderData(null);
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

  const handleAsk = async (value = question) => {
    if (!value.trim()) return;
    setQuestion(value);
    setLoadingAsk(true);
    try {
      const result = await apiAskInsight(value, locale);
      setAnswer(result.answer);
      setProvider(result.provider);
      setToolsUsed(result.toolsUsed);
    } catch {
      setAnswer(text.error);
      setProvider('');
      setToolsUsed([]);
    } finally {
      setLoadingAsk(false);
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

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 20, fontSize: 20, fontWeight: 700 }}>
        <BulbOutlined style={{ marginRight: 8 }} />
        {text.title}
      </h2>

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
              <Button size="small" onClick={loadReorder} loading={loadingReorder}>
                {text.refresh}
              </Button>
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
                  <Table
                    size="small"
                    dataSource={reorderData.suggestions}
                    columns={reorderColumns}
                    rowKey="productId"
                    pagination={false}
                  />
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
    </div>
  );
}

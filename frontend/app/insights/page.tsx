'use client';

import { useState } from 'react';
import { Alert, Button, Card, Col, Input, Row, Space, Table, Tag } from 'antd';
import { BulbOutlined, SendOutlined } from '@ant-design/icons';
import {
  apiAskInsight,
  apiGetReorderSuggestions,
  apiGetSlowMovers,
  apiGetTopSellers,
  ReorderSuggestion,
  SlowMover,
  TopSeller,
} from '@/api/insights';
import { useI18nStore } from '@/lib/i18n';

const suggestedQuestions = [
  'What should I restock today?',
  '今天应该补什么货？',
  'Que dois-je réapprovisionner aujourd’hui ?',
  'Show me top sellers',
  '哪些商品卖得最好？',
  'Quels produits se vendent le mieux ?',
  'Which products are not selling?',
  '哪些商品卖不动？',
  'Quels produits se vendent mal ?',
];

export default function InsightsPage() {
  const locale = useI18nStore((state) => state.locale);
  const isZh = locale === 'zh';
  const isFr = locale === 'fr';
  const [reorderData, setReorderData] = useState<{ suggestions: ReorderSuggestion[]; summary: string } | null>(null);
  const [topSellers, setTopSellers] = useState<TopSeller[] | null>(null);
  const [slowMovers, setSlowMovers] = useState<{ slowMovers: SlowMover[]; message: string } | null>(null);
  const [loadingReorder, setLoadingReorder] = useState(false);
  const [loadingTop, setLoadingTop] = useState(false);
  const [loadingSlow, setLoadingSlow] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [provider, setProvider] = useState<'openai' | 'local-fallback' | ''>('');
  const [loadingAsk, setLoadingAsk] = useState(false);

  const loadReorder = async () => {
    setLoadingReorder(true);
    try {
      setReorderData(await apiGetReorderSuggestions());
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
      const result = await apiAskInsight(value);
      setAnswer(result.answer);
      setProvider(result.provider);
    } catch {
      setAnswer(isZh ? '暂时无法获取回答，请稍后重试。' : isFr ? 'Impossible d’obtenir une réponse. Veuillez réessayer.' : 'Unable to get an answer. Please try again.');
      setProvider('');
    } finally {
      setLoadingAsk(false);
    }
  };

  const urgencyColor = { critical: 'red', high: 'orange', medium: 'gold' } as const;

  const reorderColumns = [
    { title: isZh ? '商品' : isFr ? 'Produit' : 'Product', dataIndex: 'productName', key: 'name' },
    {
      title: isZh ? '紧急程度' : isFr ? 'Urgence' : 'Urgency',
      dataIndex: 'urgency',
      key: 'urgency',
      render: (value: ReorderSuggestion['urgency']) => <Tag color={urgencyColor[value]}>{value.toUpperCase()}</Tag>,
    },
    {
      title: isZh ? '库存' : isFr ? 'Stock' : 'Stock',
      key: 'stock',
      render: (_: unknown, row: ReorderSuggestion) => `${row.currentStock}/${row.minStock}`,
    },
    { title: isZh ? '7 天销量' : isFr ? 'Vendus (7 j)' : 'Sold (7d)', dataIndex: 'soldLast7Days', key: 'sold' },
    {
      title: isZh ? '建议补货' : isFr ? 'Commande suggérée' : 'Suggest Order',
      dataIndex: 'suggestedReorderQty',
      key: 'qty',
      render: (value: number, row: ReorderSuggestion) => `${value} ${row.unit}`,
    },
    {
      title: isZh ? '预估成本' : isFr ? 'Coût estimé' : 'Est. Cost',
      dataIndex: 'estimatedCost',
      key: 'cost',
      render: (value: string) => `$${parseFloat(value).toFixed(2)}`,
    },
    {
      title: isZh ? '供应商' : isFr ? 'Fournisseur' : 'Supplier',
      key: 'supplier',
      render: (_: unknown, row: ReorderSuggestion) => row.supplier?.name ?? '-',
    },
  ];

  const topColumns = [
    { title: '#', key: 'rank', render: (_: unknown, __: unknown, index: number) => index + 1 },
    { title: isZh ? '商品' : isFr ? 'Produit' : 'Product', dataIndex: 'productName', key: 'name' },
    {
      title: isZh ? '分类' : isFr ? 'Catégorie' : 'Category',
      key: 'category',
      render: (_: unknown, row: TopSeller) => row.category?.name ?? '-',
    },
    { title: isZh ? '总销量' : isFr ? 'Total vendu' : 'Total Sold', dataIndex: 'totalSold', key: 'sold' },
    {
      title: isZh ? '收入' : isFr ? 'Revenus' : 'Revenue',
      dataIndex: 'totalRevenue',
      key: 'revenue',
      render: (value: string) => `$${parseFloat(value).toFixed(2)}`,
    },
    { title: isZh ? '库存' : isFr ? 'En stock' : 'In Stock', dataIndex: 'currentStock', key: 'stock' },
  ];

  const slowColumns = [
    { title: isZh ? '商品' : isFr ? 'Produit' : 'Product', dataIndex: 'name', key: 'name' },
    { title: isZh ? '库存' : isFr ? 'En stock' : 'In Stock', dataIndex: 'currentStock', key: 'stock' },
    {
      title: isZh ? '库存价值' : isFr ? 'Valeur du stock' : 'Stock Value',
      dataIndex: 'stockValue',
      key: 'value',
      render: (value: string) => `$${parseFloat(value).toFixed(2)}`,
    },
    {
      title: isZh ? '分类' : isFr ? 'Catégorie' : 'Category',
      key: 'category',
      render: (_: unknown, row: SlowMover) => row.category?.name ?? '-',
    },
    {
      title: isZh ? '过期日期' : isFr ? 'Expire le' : 'Expires',
      dataIndex: 'expirationDate',
      key: 'expiration',
      render: (value: string | null) => (value ? new Date(value).toLocaleDateString() : '-'),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 20, fontSize: 20, fontWeight: 700 }}>
        <BulbOutlined style={{ marginRight: 8 }} />
        {isZh ? 'AI 分析' : isFr ? 'Analyses IA' : 'AI Insights'}
      </h2>

      <Card title={isZh ? '询问 AI' : isFr ? 'Demander à l’IA' : 'Ask AI'} style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={isZh ? '可以用中文提问，例如：今天应该补什么货？' : isFr ? 'Posez une question en français, anglais ou chinois' : 'Ask in English, French, or Chinese, e.g. 今天应该补什么货？'}
            onPressEnter={() => handleAsk()}
            style={{ flex: 1 }}
          />
          <Button type="primary" icon={<SendOutlined />} loading={loadingAsk} onClick={() => handleAsk()}>
            {isZh ? '询问' : isFr ? 'Demander' : 'Ask'}
          </Button>
        </div>
        <Space wrap style={{ marginBottom: answer ? 12 : 0 }}>
          {suggestedQuestions.map((item) => (
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
                  <Tag color={provider === 'openai' ? 'green' : 'gold'} style={{ marginBottom: 8 }}>
                    {provider === 'openai' ? 'OpenAI API' : (isZh ? '本地分析' : isFr ? 'Analyse locale' : 'Local fallback')}
                  </Tag>
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
            title={isZh ? '补货建议' : isFr ? 'Suggestions de réapprovisionnement' : 'Reorder Suggestions'}
            extra={<Button size="small" onClick={loadReorder} loading={loadingReorder}>{isZh ? '刷新' : isFr ? 'Actualiser' : 'Refresh'}</Button>}
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
              <Button onClick={loadReorder} loading={loadingReorder}>{isZh ? '加载补货建议' : isFr ? 'Charger les suggestions' : 'Load Reorder Suggestions'}</Button>
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title={isZh ? '热销商品' : isFr ? 'Meilleures ventes' : 'Top Sellers'} extra={<Button size="small" onClick={loadTop} loading={loadingTop}>{isZh ? '刷新' : isFr ? 'Actualiser' : 'Refresh'}</Button>}>
            {topSellers ? (
              <Table size="small" dataSource={topSellers} columns={topColumns} rowKey="productId" pagination={false} />
            ) : (
              <Button onClick={loadTop} loading={loadingTop}>{isZh ? '加载热销商品' : isFr ? 'Charger les meilleures ventes' : 'Load Top Sellers'}</Button>
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card
            title={isZh ? '滞销商品（30 天无销售）' : isFr ? 'Produits lents (aucune vente en 30 jours)' : 'Slow Movers (No Sales in 30 Days)'}
            extra={<Button size="small" onClick={loadSlow} loading={loadingSlow}>{isZh ? '刷新' : isFr ? 'Actualiser' : 'Refresh'}</Button>}
          >
            {slowMovers ? (
              <>
                <Alert
                  type={slowMovers.slowMovers.length === 0 ? 'success' : 'warning'}
                  message={slowMovers.message}
                  style={{ marginBottom: 12 }}
                />
                {slowMovers.slowMovers.length > 0 && (
                  <Table size="small" dataSource={slowMovers.slowMovers} columns={slowColumns} rowKey="id" pagination={false} />
                )}
              </>
            ) : (
              <Button onClick={loadSlow} loading={loadingSlow}>{isZh ? '加载滞销商品' : isFr ? 'Charger les produits lents' : 'Load Slow Movers'}</Button>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

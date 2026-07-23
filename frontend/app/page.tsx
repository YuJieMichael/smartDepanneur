'use client';

import { Button, Card, Col, Row, Statistic, Typography } from 'antd';
import {
  BarChartOutlined,
  BulbOutlined,
  InboxOutlined,
  ShoppingCartOutlined,
  ShopOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useI18nStore } from '@/lib/i18n';

export default function Home() {
  const router = useRouter();
  const locale = useI18nStore((state) => state.locale);
  const isZh = locale === 'zh';
  const isFr = locale === 'fr';

  const actions = [
    {
      title: isZh ? '仪表盘' : isFr ? 'Tableau de bord' : 'Dashboard',
      description: isZh ? '查看今日销售、收入、低库存提醒和热销商品。' : isFr ? 'Consultez les ventes du jour, les revenus, les alertes de stock bas et les meilleurs vendeurs.' : 'Review daily sales, revenue, low-stock alerts, and top-selling products.',
      icon: <BarChartOutlined />,
      path: '/dashboard',
    },
    {
      title: isZh ? '商品管理' : isFr ? 'Produits' : 'Products',
      description: isZh ? '管理条形码、分类、供应商、价格、库存和过期日期。' : isFr ? 'Gérez les codes-barres, catégories, fournisseurs, prix, stocks et dates d’expiration.' : 'Manage barcodes, categories, suppliers, prices, stock levels, and expiration dates.',
      icon: <ShopOutlined />,
      path: '/products',
    },
    {
      title: isZh ? '新销售' : isFr ? 'Nouvelle vente' : 'New Sale',
      description: isZh ? '创建类似 POS 的销售订单，并自动更新库存。' : isFr ? 'Créez une transaction type caisse et mettez le stock à jour automatiquement.' : 'Create a POS-style transaction and automatically update inventory.',
      icon: <ShoppingCartOutlined />,
      path: '/sales',
    },
    {
      title: isZh ? '门店 Agent' : isFr ? 'Agent du magasin' : 'Store Agent',
      description: isZh ? '询问补货建议、热销商品和滞销商品。' : isFr ? 'Demandez quoi réapprovisionner, ce qui se vend bien et quels produits stagnent.' : 'Ask what to restock, what is selling well, and which products are slow movers.',
      icon: <BulbOutlined />,
      path: '/insights',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Typography.Title level={2} style={{ marginBottom: 8 }}>
          SmartDepanneur Agent
        </Typography.Title>
        <Typography.Paragraph style={{ color: '#5f6b7a', maxWidth: 760, marginBottom: 0 }}>
          {isZh
            ? '面向便利店的智能 Agent，支持库存、销售、过期检查、补货决策和店主易懂的业务分析。'
            : isFr
              ? 'Un agent de gestion pour dépanneur qui aide avec l’inventaire, les ventes, les expirations, le réapprovisionnement et les analyses métier.'
              : 'An agent-powered convenience store platform for inventory, sales, expiration checks, restocking decisions, and owner-friendly business insights.'}
        </Typography.Paragraph>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic title={isZh ? '门店类型' : isFr ? 'Type de commerce' : 'Store Focus'} value={isZh ? '便利店' : 'Dépanneur'} prefix={<ShopOutlined />} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic title={isZh ? '核心流程' : isFr ? 'Flux principal' : 'Core Workflow'} value={isZh ? '库存' : isFr ? 'Inventaire' : 'Inventory'} prefix={<InboxOutlined />} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic title={isZh ? '智能模块' : isFr ? 'Module intelligent' : 'Smart Module'} value={isZh ? '门店 Agent' : isFr ? 'Agent du magasin' : 'Store Agent'} prefix={<BulbOutlined />} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic title={isZh ? '风险检查' : isFr ? 'Contrôles de risque' : 'Risk Checks'} value={isZh ? '过期' : isFr ? 'Expiration' : 'Expiry'} prefix={<WarningOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {actions.map((item) => (
          <Col xs={24} md={12} xl={6} key={item.path}>
            <Card
              title={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {item.icon}
                  {item.title}
                </span>
              }
              actions={[
                <Button type="link" key="open" onClick={() => router.push(item.path)}>
                  {isZh ? '打开' : isFr ? 'Ouvrir' : 'Open'}
                </Button>,
              ]}
            >
              <Typography.Paragraph style={{ minHeight: 66, marginBottom: 0, color: '#5f6b7a' }}>
                {item.description}
              </Typography.Paragraph>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}

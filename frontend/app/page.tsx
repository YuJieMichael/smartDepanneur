'use client';

import { Button, Card, Col, Row, Space, Statistic, Tag, Typography } from 'antd';
import {
  ArrowRightOutlined,
  BarChartOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  InboxOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  ShoppingCartOutlined,
  ShopOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useI18nStore } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';

export default function Home() {
  const router = useRouter();
  const locale = useI18nStore((state) => state.locale);
  const currentUser = useAppStore((state) => state.currentUser);
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
    <div style={{ padding: 24, background: '#f4f7fb', minHeight: '100%' }}>
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          marginBottom: 24,
          padding: '32px clamp(24px, 5vw, 52px)',
          borderRadius: 24,
          color: '#fff',
          background: 'linear-gradient(120deg, #0f766e 0%, #0b6bcb 58%, #4338ca 100%)',
          boxShadow: '0 18px 45px rgba(15, 118, 110, 0.2)',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            width: 260,
            height: 260,
            right: -65,
            top: -105,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            width: 150,
            height: 150,
            right: 190,
            bottom: -95,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
          }}
        />
        <Row gutter={[28, 24]} align="middle" style={{ position: 'relative' }}>
          <Col xs={24} lg={15}>
            <Tag
              icon={<CheckCircleOutlined />}
              color="cyan"
              style={{ marginBottom: 14, border: 0, fontWeight: 600 }}
            >
              {isZh ? '门店系统运行正常' : isFr ? 'Magasin prêt à fonctionner' : 'Store operations ready'}
            </Tag>
            <Typography.Title level={1} style={{ color: '#fff', margin: '0 0 10px', fontSize: 34 }}>
              {isZh
                ? '欢迎回来，开始管理今天的门店'
                : isFr
                  ? 'Bon retour — gérez votre magasin du jour'
                  : 'Welcome back — run today’s store'}
            </Typography.Title>
            <Typography.Paragraph
              style={{ color: 'rgba(255,255,255,0.82)', maxWidth: 720, fontSize: 16, marginBottom: 22 }}
            >
              {isZh
                ? `已登录：${currentUser?.email ?? 'Store Owner'}。销售、库存预警和门店 Agent 都集中在一个工作台。`
                : isFr
                  ? `Connecté : ${currentUser?.email ?? 'Store Owner'}. Les ventes, alertes de stock et l’agent du magasin sont réunis dans un seul espace.`
                  : `Signed in as ${currentUser?.email ?? 'Store Owner'}. Sales, stock alerts, and the Store Agent are together in one workspace.`}
            </Typography.Paragraph>
            <Space wrap>
              <Button
                type="primary"
                size="large"
                icon={<RocketOutlined />}
                onClick={() => router.push('/dashboard')}
                style={{ background: '#fff', color: '#0b6bcb', borderColor: '#fff', fontWeight: 600 }}
              >
                {isZh ? '查看今日经营' : isFr ? 'Voir l’activité du jour' : 'View today’s operations'}
              </Button>
              <Button
                size="large"
                ghost
                icon={<BulbOutlined />}
                onClick={() => router.push('/insights')}
              >
                {isZh ? '询问门店 Agent' : isFr ? 'Demander à l’agent' : 'Ask Store Agent'}
              </Button>
            </Space>
          </Col>
          <Col xs={24} lg={9}>
            <div
              style={{
                padding: 20,
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 18,
                background: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <Space direction="vertical" size={14} style={{ width: '100%' }}>
                {[
                  [<ShoppingCartOutlined key="sales" />, isZh ? '完成销售' : isFr ? 'Finaliser les ventes' : 'Complete sales'],
                  [<InboxOutlined key="stock" />, isZh ? '自动扣减库存' : isFr ? 'Déduire le stock automatiquement' : 'Auto-update inventory'],
                  [<BulbOutlined key="agent" />, isZh ? '获取补货建议' : isFr ? 'Recevoir les conseils de stock' : 'Get reorder guidance'],
                ].map(([icon, label], index) => (
                  <div
                    key={String(label)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      paddingBottom: index < 2 ? 14 : 0,
                      borderBottom: index < 2 ? '1px solid rgba(255,255,255,0.16)' : undefined,
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{icon}</span>
                    <span style={{ flex: 1, fontWeight: 600 }}>{label}</span>
                    <CheckCircleOutlined style={{ color: '#a7f3d0' }} />
                  </div>
                ))}
              </Space>
            </div>
          </Col>
        </Row>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} lg={6}>
          <Card style={{ border: 0, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
            <Statistic title={isZh ? '门店类型' : isFr ? 'Type de commerce' : 'Store Focus'} value={isZh ? '便利店' : 'Dépanneur'} prefix={<ShopOutlined />} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card style={{ border: 0, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
            <Statistic title={isZh ? '核心流程' : isFr ? 'Flux principal' : 'Core Workflow'} value={isZh ? '库存' : isFr ? 'Inventaire' : 'Inventory'} prefix={<InboxOutlined />} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card style={{ border: 0, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
            <Statistic title={isZh ? '智能模块' : isFr ? 'Module intelligent' : 'Smart Module'} value={isZh ? '门店 Agent' : isFr ? 'Agent du magasin' : 'Store Agent'} prefix={<BulbOutlined />} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card style={{ border: 0, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
            <Statistic title={isZh ? '风险检查' : isFr ? 'Contrôles de risque' : 'Risk Checks'} value={isZh ? '过期' : isFr ? 'Expiration' : 'Expiry'} prefix={<WarningOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card
        style={{ marginBottom: 24, border: 0, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}
        title={
          <Space>
            <SafetyCertificateOutlined style={{ color: '#0f766e' }} />
            {isZh ? '今日门店流程' : isFr ? 'Flux de travail du jour' : 'Today’s store workflow'}
          </Space>
        }
      >
        <Row gutter={[16, 16]} align="middle">
          {[
            {
              number: '01',
              title: isZh ? '完成收银' : isFr ? 'Encaisser' : 'Checkout',
              text: isZh ? '扫描商品并完成付款。' : isFr ? 'Scannez les produits et finalisez le paiement.' : 'Scan items and complete payment.',
            },
            {
              number: '02',
              title: isZh ? '库存自动同步' : isFr ? 'Stock synchronisé' : 'Inventory sync',
              text: isZh ? '销售完成后库存自动扣减。' : isFr ? 'Le stock est déduit après chaque vente.' : 'Stock is deducted after every sale.',
            },
            {
              number: '03',
              title: isZh ? 'Agent 给出建议' : isFr ? 'Conseils de l’agent' : 'Agent guidance',
              text: isZh ? '检查缺货、热销和滞销商品。' : isFr ? 'Vérifiez les ruptures, meilleures ventes et produits lents.' : 'Review shortages, top sellers, and slow movers.',
            },
          ].map((step, index) => (
            <Col xs={24} md={8} key={step.number}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div
                  style={{
                    minWidth: 42,
                    height: 42,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 12,
                    background: index === 0 ? '#e6f4ff' : index === 1 ? '#e8fff5' : '#f0edff',
                    color: index === 0 ? '#1677ff' : index === 1 ? '#0f766e' : '#4338ca',
                    fontWeight: 800,
                  }}
                >
                  {step.number}
                </div>
                <div style={{ flex: 1 }}>
                  <Typography.Text strong>{step.title}</Typography.Text>
                  <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                    {step.text}
                  </Typography.Paragraph>
                </div>
                {index < 2 && <ArrowRightOutlined style={{ color: '#b5bdc9', marginTop: 12 }} />}
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      <Typography.Title level={4} style={{ marginBottom: 14 }}>
        {isZh ? '快捷入口' : isFr ? 'Accès rapide' : 'Quick actions'}
      </Typography.Title>
      <Row gutter={[16, 16]}>
        {actions.map((item) => (
          <Col xs={12} key={item.path}>
            <Card
              hoverable
              onClick={() => router.push(item.path)}
              style={{
                height: '100%',
                minHeight: 176,
                border: 0,
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
              }}
              title={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {item.icon}
                  {item.title}
                </span>
              }
              actions={[
                <Button
                  type="link"
                  key="open"
                  onClick={(event) => {
                    event.stopPropagation();
                    router.push(item.path);
                  }}
                >
                  {isZh ? '打开' : isFr ? 'Ouvrir' : 'Open'}
                </Button>,
              ]}
            >
              <Typography.Paragraph
                ellipsis={{ rows: 2 }}
                style={{ minHeight: 44, marginBottom: 0, color: '#5f6b7a' }}
              >
                {item.description}
              </Typography.Paragraph>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}

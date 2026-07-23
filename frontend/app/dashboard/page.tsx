'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Col, Row, Statistic, Table, Tag } from 'antd';
import {
  AlertOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  LineChartOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';
import { apiGetDashboardOverview, DashboardOverview } from '@/api/dashboard';
import { useI18nStore } from '@/lib/i18n';

export default function DashboardPage() {
  const locale = useI18nStore((state) => state.locale);
  const isZh = locale === 'zh';
  const isFr = locale === 'fr';
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiGetDashboardOverview();
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const lowStockColumns = [
    { title: isZh ? '商品' : isFr ? 'Produit' : 'Product', dataIndex: 'name', key: 'name' },
    {
      title: isZh ? '库存' : isFr ? 'Stock' : 'Stock',
      key: 'stock',
      render: (_: unknown, row: DashboardOverview['lowStockList'][0]) => (
        <span style={{ color: '#cf1322', fontWeight: 600 }}>
          {row.currentStock} / {row.minStock}
        </span>
      ),
    },
    {
      title: isZh ? '供应商' : isFr ? 'Fournisseur' : 'Supplier',
      key: 'supplier',
      render: (_: unknown, row: DashboardOverview['lowStockList'][0]) =>
        row.supplier ? <Tag>{row.supplier.name}</Tag> : <span style={{ color: '#bbb' }}>-</span>,
    },
  ];

  const topSellerColumns = [
    { title: isZh ? '商品' : isFr ? 'Produit' : 'Product', dataIndex: 'productName', key: 'name' },
    { title: isZh ? '销量（总计）' : isFr ? 'Vendus (total)' : 'Sold (all time)', dataIndex: 'totalSold', key: 'sold' },
    { title: isZh ? '库存' : isFr ? 'En stock' : 'In Stock', dataIndex: 'currentStock', key: 'stock' },
  ];

  const expiringColumns = [
    { title: isZh ? '商品' : isFr ? 'Produit' : 'Product', dataIndex: 'name', key: 'name' },
    { title: isZh ? '库存' : isFr ? 'Stock' : 'Stock', dataIndex: 'currentStock', key: 'stock', width: 90 },
    {
      title: isZh ? '过期日期' : isFr ? 'Expire le' : 'Expires',
      dataIndex: 'expirationDate',
      key: 'expirationDate',
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      title: isZh ? '供应商' : isFr ? 'Fournisseur' : 'Supplier',
      key: 'supplier',
      render: (_: unknown, row: DashboardOverview['expiringList'][0]) =>
        row.supplier ? <Tag>{row.supplier.name}</Tag> : <span style={{ color: '#bbb' }}>-</span>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 20, fontSize: 20, fontWeight: 700 }}>
        {isZh ? 'SmartDepanneur Agent - 仪表盘' : isFr ? 'SmartDepanneur Agent - Tableau de bord' : 'SmartDepanneur Agent - Dashboard'}
      </h2>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} lg={5}>
          <Card loading={loading}>
            <Statistic
              title={isZh ? '今日销售' : isFr ? 'Ventes du jour' : "Today's Sales"}
              value={data?.today.saleCount ?? 0}
              prefix={<ShoppingCartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} lg={5}>
          <Card loading={loading}>
            <Statistic
              title={isZh ? '今日收入' : isFr ? 'Revenus du jour' : "Today's Revenue"}
              value={data ? parseFloat(data.today.revenue).toFixed(2) : '0.00'}
              prefix={<DollarOutlined />}
              suffix="$"
            />
          </Card>
        </Col>
        <Col xs={12} lg={5}>
          <Card loading={loading}>
            <Statistic
              title={isZh ? '预估利润' : isFr ? 'Profit estimé' : 'Estimated Profit'}
              value={data ? parseFloat(data.today.profit).toFixed(2) : '0.00'}
              prefix={<LineChartOutlined />}
              suffix="$"
              styles={{ content: { color: '#237804' } }}
            />
          </Card>
        </Col>
        <Col xs={12} lg={5}>
          <Card loading={loading}>
            <Statistic
              title={isZh ? '低库存' : isFr ? 'Stock bas' : 'Low Stock'}
              value={data?.products.lowStock ?? 0}
              prefix={<AlertOutlined />}
              styles={data && data.products.lowStock > 0 ? { content: { color: '#cf1322' } } : undefined}
            />
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card loading={loading}>
            <Statistic
              title={isZh ? '即将过期' : isFr ? 'Expire bientôt' : 'Expiring Soon'}
              value={data?.products.expiringSoon ?? 0}
              prefix={<ClockCircleOutlined />}
              styles={data && data.products.expiringSoon > 0 ? { content: { color: '#d48806' } } : undefined}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card
            title={isZh ? '低库存提醒' : isFr ? 'Alerte de stock bas' : 'Low Stock Alert'}
            loading={loading}
            extra={
              <Button size="small" type="link" href="/inventory">
                {isZh ? '查看库存' : isFr ? 'Voir l’inventaire' : 'View Inventory'}
              </Button>
            }
          >
            <Table
              size="small"
              dataSource={data?.lowStockList ?? []}
              columns={lowStockColumns}
              rowKey="id"
              pagination={false}
              locale={{ emptyText: isZh ? '所有商品库存充足' : isFr ? 'Tous les produits ont un stock suffisant' : 'All products are sufficiently stocked' }}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title={isZh ? '热销商品（总计）' : isFr ? 'Meilleures ventes (total)' : 'Top Sellers (All Time)'} loading={loading}>
            <Table
              size="small"
              dataSource={data?.topSellers ?? []}
              columns={topSellerColumns}
              rowKey="productId"
              pagination={false}
              locale={{ emptyText: isZh ? '暂无销售记录' : isFr ? 'Aucune vente enregistrée' : 'No sales recorded yet' }}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            title={isZh ? '即将过期商品' : isFr ? 'Produits bientôt expirés' : 'Products Expiring Soon'}
            loading={loading}
            extra={
              <Button size="small" type="link" href="/inventory">
                {isZh ? '查看库存' : isFr ? 'Voir l’inventaire' : 'View Inventory'}
              </Button>
            }
          >
            <Table
              size="small"
              dataSource={data?.expiringList ?? []}
              columns={expiringColumns}
              rowKey="id"
              pagination={false}
              locale={{ emptyText: isZh ? '未来 7 天没有即将过期商品' : isFr ? 'Aucun produit n’expire dans les 7 prochains jours' : 'No products expiring in the next 7 days' }}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card loading={loading}>
            <Statistic
              title={isZh ? '启用商品' : isFr ? 'Produits actifs' : 'Active Products'}
              value={data?.products.active ?? 0}
              prefix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

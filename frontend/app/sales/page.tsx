'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Divider,
  InputNumber,
  message,
  Popconfirm,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  DeleteOutlined,
  HistoryOutlined,
  PlusOutlined,
  ShoppingCartOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { apiGetProductList, ProductRow } from '@/api/products';
import {
  apiCreateSale,
  apiGetRecentSales,
  apiVoidSale,
  SaleRow,
} from '@/api/sales';
import { useI18nStore, useT } from '@/lib/i18n';
import { globalMessage } from '@/lib/message-bridge';

interface CartItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  lineTotal: number;
}

const TAX_RATE = 0.14975;

export default function SalesPage() {
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const isZh = locale === 'zh';
  const isFr = locale === 'fr';
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'debit' | 'credit' | 'other'>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<SaleRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [voidingId, setVoidingId] = useState<number | null>(null);

  const loadProducts = useCallback(async () => {
    const result = await apiGetProductList({
      pageSize: 500,
      filterActive: 'true',
      sortField: 'name',
      sortOrder: 'asc',
    });
    setProducts(result.list);
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setHistory(await apiGetRecentSales(12));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadProducts(), loadHistory()]).catch(() => {});
  }, [loadHistory, loadProducts]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;
  const estimatedProfit = cart.reduce(
    (sum, item) => sum + (item.unitPrice - item.costPrice) * item.quantity,
    0,
  );

  const getRemainingStock = (productId: number) => {
    const product = products.find((item) => item.id === productId);
    const inCart = cart.find((item) => item.productId === productId)?.quantity ?? 0;
    return Math.max(0, (product?.currentStock ?? 0) - inCart);
  };

  const addToCart = () => {
    if (!selectedProduct || quantity <= 0) return;

    const remainingStock = getRemainingStock(selectedProduct.id);
    if (quantity > remainingStock) {
      message.warning(isZh ? `${selectedProduct.name} 只剩 ${remainingStock} 件` : isFr ? `Seulement ${remainingStock} unité(s) disponibles pour ${selectedProduct.name}` : `Only ${remainingStock} unit(s) available for ${selectedProduct.name}`);
      return;
    }

    const unitPrice = parseFloat(selectedProduct.sellingPrice);
    const costPrice = parseFloat(selectedProduct.costPrice);

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === selectedProduct.id);
      if (existing) {
        const nextQuantity = existing.quantity + quantity;
        return prev.map((item) =>
          item.productId === selectedProduct.id
            ? { ...item, quantity: nextQuantity, lineTotal: nextQuantity * unitPrice }
            : item,
        );
      }

      return [
        ...prev,
        {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          quantity,
          unitPrice,
          costPrice,
          lineTotal: quantity * unitPrice,
        },
      ];
    });

    setSelectedProductId(null);
    setQuantity(1);
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      message.warning(isZh ? '购物车为空' : isFr ? 'Le panier est vide' : 'Cart is empty');
      return;
    }

    try {
      setSubmitting(true);
      const sale = await apiCreateSale({
        items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        paymentMethod,
        taxRate: TAX_RATE,
      });
      globalMessage.success(isZh ? `销售单 ${sale.saleNumber} 已创建 - $${parseFloat(sale.total).toFixed(2)}` : isFr ? `Vente ${sale.saleNumber} créée - $${parseFloat(sale.total).toFixed(2)}` : `Sale ${sale.saleNumber} created - $${parseFloat(sale.total).toFixed(2)}`);
      setCart([]);
      await Promise.all([loadProducts(), loadHistory()]);
    } catch {
      globalMessage.error(t.common.create_failed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoidSale = async (sale: SaleRow) => {
    try {
      setVoidingId(sale.id);
      await apiVoidSale(
        sale.id,
        isZh
          ? '收银员撤销误操作'
          : isFr
            ? 'Vente annulée par erreur de caisse'
            : 'Cashier reversed an accidental sale',
      );
      globalMessage.success(
        isZh
          ? `销售单 ${sale.saleNumber} 已撤销，库存已恢复`
          : isFr
            ? `Vente ${sale.saleNumber} annulée et stock restauré`
            : `Sale ${sale.saleNumber} voided and inventory restored`,
      );
      await Promise.all([loadProducts(), loadHistory()]);
    } catch {
      globalMessage.error(
        isZh
          ? '撤销失败，请刷新后重试'
          : isFr
            ? 'Échec de l’annulation'
            : 'Unable to void the sale',
      );
    } finally {
      setVoidingId(null);
    }
  };

  const cartColumns = [
    { title: isZh ? '商品' : isFr ? 'Produit' : 'Product', dataIndex: 'productName', key: 'name' },
    {
      title: isZh ? '数量' : isFr ? 'Qté' : 'Qty',
      key: 'qty',
      width: 120,
      render: (_: unknown, item: CartItem) => (
        <InputNumber
          min={1}
          max={products.find((product) => product.id === item.productId)?.currentStock ?? 999}
          value={item.quantity}
          size="small"
          onChange={(value) => {
            if (!value) return;
            setCart((prev) =>
              prev.map((cartItem) =>
                cartItem.productId === item.productId
                  ? { ...cartItem, quantity: value, lineTotal: value * cartItem.unitPrice }
                  : cartItem,
              ),
            );
          }}
        />
      ),
    },
    {
      title: isZh ? '单价' : isFr ? 'Prix unitaire' : 'Unit Price',
      dataIndex: 'unitPrice',
      key: 'price',
      render: (value: number) => `$${value.toFixed(2)}`,
    },
    {
      title: isZh ? '小计' : isFr ? 'Total ligne' : 'Line Total',
      dataIndex: 'lineTotal',
      key: 'total',
      render: (value: number) => `$${value.toFixed(2)}`,
    },
    {
      title: '',
      key: 'remove',
      width: 48,
      render: (_: unknown, item: CartItem) => (
        <Button
          type="link"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => removeFromCart(item.productId)}
        />
      ),
    },
  ];

  const paymentLabels = {
    cash: isZh ? '现金' : isFr ? 'Espèces' : 'Cash',
    debit: isZh ? '借记卡' : isFr ? 'Débit' : 'Debit',
    credit: isZh ? '信用卡' : isFr ? 'Crédit' : 'Credit',
    other: isZh ? '其他' : isFr ? 'Autre' : 'Other',
  };
  const dateFormatter = new Intl.DateTimeFormat(
    isZh ? 'zh-CN' : isFr ? 'fr-CA' : 'en-CA',
    {
      timeZone: 'America/Toronto',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  );

  const historyColumns = [
    {
      title: isZh ? '销售单' : isFr ? 'Vente' : 'Sale',
      key: 'sale',
      width: 190,
      render: (_: unknown, sale: SaleRow) => (
        <Space direction="vertical" size={3}>
          <Typography.Text code>{sale.saleNumber}</Typography.Text>
          {sale.isVoided ? (
            <Tag color="default">
              {isZh ? '已撤销' : isFr ? 'Annulée' : 'Voided'}
            </Tag>
          ) : (
            <Tag color="green">
              {isZh ? '已完成' : isFr ? 'Complétée' : 'Completed'}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: isZh ? '时间' : isFr ? 'Heure' : 'Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (value: string) => dateFormatter.format(new Date(value)),
    },
    {
      title: isZh ? '商品明细' : isFr ? 'Articles' : 'Items',
      key: 'items',
      render: (_: unknown, sale: SaleRow) => (
        <Space direction="vertical" size={2}>
          {sale.items.map((item) => (
            <Typography.Text key={item.id}>
              {item.product.name} × {item.quantity}
            </Typography.Text>
          ))}
        </Space>
      ),
    },
    {
      title: isZh ? '收银员' : isFr ? 'Caissier' : 'Cashier',
      key: 'cashier',
      width: 190,
      render: (_: unknown, sale: SaleRow) => sale.cashier?.email ?? '—',
    },
    {
      title: isZh ? '支付' : isFr ? 'Paiement' : 'Payment',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 100,
      render: (value: SaleRow['paymentMethod']) => paymentLabels[value],
    },
    {
      title: isZh ? '总计' : isFr ? 'Total' : 'Total',
      dataIndex: 'total',
      key: 'total',
      width: 105,
      align: 'right' as const,
      render: (value: string, sale: SaleRow) => (
        <Typography.Text delete={sale.isVoided}>
          ${Number(value).toFixed(2)}
        </Typography.Text>
      ),
    },
    {
      title: isZh ? '操作' : isFr ? 'Action' : 'Action',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: unknown, sale: SaleRow) =>
        sale.isVoided ? (
          <Typography.Text type="secondary">
            {isZh ? '库存已恢复' : isFr ? 'Stock restauré' : 'Stock restored'}
          </Typography.Text>
        ) : (
          <Popconfirm
            title={
              isZh
                ? '确认撤销这笔销售？'
                : isFr
                  ? 'Annuler cette vente?'
                  : 'Void this sale?'
            }
            description={
              isZh
                ? '销售记录会保留，商品库存会自动加回。'
                : isFr
                  ? 'La vente restera visible et le stock sera restauré.'
                  : 'The sale stays in history and inventory is restored.'
            }
            okText={isZh ? '确认撤销' : isFr ? 'Confirmer' : 'Void Sale'}
            cancelText={isZh ? '取消' : isFr ? 'Annuler' : 'Cancel'}
            okButtonProps={{ danger: true }}
            onConfirm={() => handleVoidSale(sale)}
          >
            <Button
              danger
              size="small"
              icon={<UndoOutlined />}
              loading={voidingId === sale.id}
            >
              {isZh ? '撤销' : isFr ? 'Annuler' : 'Undo'}
            </Button>
          </Popconfirm>
        ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 20, fontSize: 20, fontWeight: 700 }}>
        <ShoppingCartOutlined style={{ marginRight: 8 }} />
        {isZh ? '新销售' : isFr ? 'Nouvelle vente' : 'New Sale'}
      </h2>

      <Card title={isZh ? '添加商品到购物车' : isFr ? 'Ajouter un article au panier' : 'Add Item to Cart'} style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            showSearch
            placeholder={isZh ? '搜索商品' : isFr ? 'Rechercher un produit' : 'Search product'}
            style={{ width: 320 }}
            value={selectedProductId}
            onChange={setSelectedProductId}
            optionFilterProp="label"
            options={products.map((product) => ({
              label: `${product.name}${product.sku ? ` (${product.sku})` : ''} - ${isZh ? '库存' : isFr ? 'stock' : 'stock'}: ${product.currentStock}`,
              value: product.id,
              disabled: product.currentStock === 0,
            }))}
          />
          <InputNumber
            min={1}
            max={selectedProduct ? getRemainingStock(selectedProduct.id) : undefined}
            value={quantity}
            onChange={(value) => setQuantity(value ?? 1)}
            placeholder={isZh ? '数量' : isFr ? 'Qté' : 'Qty'}
            style={{ width: 90 }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={addToCart}
            disabled={!selectedProductId || (selectedProduct ? getRemainingStock(selectedProduct.id) <= 0 : false)}
          >
            {isZh ? '添加' : isFr ? 'Ajouter' : 'Add'}
          </Button>
        </Space>
      </Card>

      <Card title={isZh ? '购物车' : isFr ? 'Panier' : 'Cart'}>
        <Table
          size="small"
          dataSource={cart}
          columns={cartColumns}
          rowKey="productId"
          pagination={false}
          locale={{ emptyText: isZh ? '购物车为空，请先添加商品' : isFr ? 'Le panier est vide - ajoutez des produits ci-dessus' : 'Cart is empty - add products above' }}
        />

        {cart.length > 0 && (
          <>
            <Divider />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, marginBottom: 16 }}>
              <Statistic title={isZh ? '小计' : isFr ? 'Sous-total' : 'Subtotal'} value={subtotal.toFixed(2)} prefix="$" />
              <Statistic title={isZh ? '税费 (QC 14.975%)' : isFr ? 'Taxes (QC 14,975 %)' : 'Tax (QC 14.975%)'} value={tax.toFixed(2)} prefix="$" />
              <Statistic title={isZh ? '预估利润' : isFr ? 'Profit estimé' : 'Estimated Profit'} value={estimatedProfit.toFixed(2)} prefix="$" />
              <Statistic title={isZh ? '总计' : isFr ? 'Total' : 'Total'} value={total.toFixed(2)} prefix="$" styles={{ content: { fontWeight: 700 } }} />
            </div>
            <Space>
              <span>{isZh ? '支付方式：' : isFr ? 'Paiement :' : 'Payment:'}</span>
              <Select
                value={paymentMethod}
                onChange={setPaymentMethod}
                style={{ width: 120 }}
                options={[
                  { label: isZh ? '现金' : isFr ? 'Espèces' : 'Cash', value: 'cash' },
                  { label: isZh ? '借记卡' : isFr ? 'Débit' : 'Debit', value: 'debit' },
                  { label: isZh ? '信用卡' : isFr ? 'Crédit' : 'Credit', value: 'credit' },
                  { label: isZh ? '其他' : isFr ? 'Autre' : 'Other', value: 'other' },
                ]}
              />
              <Button type="primary" size="large" loading={submitting} onClick={handleCheckout}>
                {isZh ? '完成销售' : isFr ? 'Finaliser la vente' : 'Complete Sale'}
              </Button>
            </Space>
          </>
        )}
      </Card>

      <Card
        style={{ marginTop: 18 }}
        title={
          <Space>
            <HistoryOutlined />
            {isZh ? '销售历史' : isFr ? 'Historique des ventes' : 'Sales History'}
          </Space>
        }
        extra={
          <Button type="link" onClick={loadHistory} loading={historyLoading}>
            {isZh ? '刷新' : isFr ? 'Actualiser' : 'Refresh'}
          </Button>
        }
      >
        <Table
          size="small"
          loading={historyLoading}
          dataSource={history}
          columns={historyColumns}
          rowKey="id"
          pagination={false}
          scroll={{ x: 980 }}
          rowClassName={(sale) => (sale.isVoided ? 'sale-row-voided' : '')}
          locale={{
            emptyText: isZh
              ? '暂无销售历史'
              : isFr
                ? 'Aucun historique de vente'
                : 'No sales history yet',
          }}
        />
        <Typography.Paragraph
          type="secondary"
          style={{ margin: '12px 0 0', fontSize: 12 }}
        >
          {isZh
            ? '撤销不会删除销售记录；系统会保留操作人和时间，并自动恢复库存。'
            : isFr
              ? 'Une annulation conserve la vente, l’opérateur et l’heure, puis restaure automatiquement le stock.'
              : 'Undo keeps the sale, operator, and timestamp in history while restoring inventory automatically.'}
        </Typography.Paragraph>
      </Card>
    </div>
  );
}

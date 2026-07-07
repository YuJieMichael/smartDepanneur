'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Divider, InputNumber, message, Select, Space, Statistic, Table } from 'antd';
import { DeleteOutlined, PlusOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { apiGetProductList, ProductRow } from '@/api/products';
import { apiCreateSale } from '@/api/sales';
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

  const loadProducts = async () => {
    const result = await apiGetProductList({
      pageSize: 500,
      filterActive: 'true',
      sortField: 'name',
      sortOrder: 'asc',
    });
    setProducts(result.list);
  };

  useEffect(() => {
    loadProducts().catch(() => {});
  }, []);

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
      await loadProducts();
    } catch {
      globalMessage.error(t.common.create_failed);
    } finally {
      setSubmitting(false);
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
    </div>
  );
}

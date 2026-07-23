'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Divider,
  Input,
  InputNumber,
  message,
  Modal,
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
  VoidReasonCode,
} from '@/api/sales';
import { useI18nStore, useT } from '@/lib/i18n';
import { globalMessage } from '@/lib/message-bridge';
import { ApiError } from '@/lib/request';
import { localizeStoreCategory } from '@/lib/store-category';

interface CartItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  lineTotal: number;
}

type CategoryFilter = 'all' | 'uncategorized' | `category:${number}`;

const TAX_RATE = 0.14975;

export default function SalesPage() {
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const isZh = locale === 'zh';
  const isFr = locale === 'fr';
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'debit' | 'credit' | 'other'>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<SaleRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [voidingId, setVoidingId] = useState<number | null>(null);
  const [voidTarget, setVoidTarget] = useState<SaleRow | null>(null);
  const [voidReason, setVoidReason] = useState<VoidReasonCode | undefined>();
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [policyClock, setPolicyClock] = useState(Date.now());

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

  useEffect(() => {
    const timer = window.setInterval(() => setPolicyClock(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const categoryOptions = useMemo(() => {
    const categoryCounts = new Map<
      number,
      { id: number; name: string; count: number }
    >();
    let uncategorizedCount = 0;

    for (const product of products) {
      if (!product.category) {
        uncategorizedCount += 1;
        continue;
      }
      const existing = categoryCounts.get(product.category.id);
      categoryCounts.set(product.category.id, {
        id: product.category.id,
        name: product.category.name,
        count: (existing?.count ?? 0) + 1,
      });
    }

    const allLabel = isZh ? '全部分类' : isFr ? 'Toutes les catégories' : 'All categories';
    const options: Array<{ label: string; value: CategoryFilter }> = [
      { label: `${allLabel} (${products.length})`, value: 'all' },
      ...[...categoryCounts.values()]
        .sort((left, right) =>
          localizeStoreCategory(left.name, locale).localeCompare(
            localizeStoreCategory(right.name, locale),
            locale === 'zh' ? 'zh-CN' : locale === 'fr' ? 'fr-CA' : 'en-CA',
          ),
        )
        .map((category) => ({
          label: `${localizeStoreCategory(category.name, locale)} (${category.count})`,
          value: `category:${category.id}` as CategoryFilter,
        })),
    ];

    if (uncategorizedCount > 0) {
      options.push({
        label: `${localizeStoreCategory('Uncategorized', locale)} (${uncategorizedCount})`,
        value: 'uncategorized',
      });
    }

    return options;
  }, [isFr, isZh, locale, products]);

  const filteredProducts = useMemo(() => {
    if (categoryFilter === 'all') return products;
    if (categoryFilter === 'uncategorized') {
      return products.filter((product) => product.category === null);
    }
    const categoryId = Number(categoryFilter.replace('category:', ''));
    return products.filter((product) => product.categoryId === categoryId);
  }, [categoryFilter, products]);

  const productSearchIndex = useMemo(
    () =>
      new Map(
        products.map((product) => [
          product.id,
          [
            product.name,
            product.sku,
            product.barcode,
            product.category
              ? localizeStoreCategory(product.category.name, locale)
              : localizeStoreCategory('Uncategorized', locale),
          ]
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase(),
        ]),
      ),
    [locale, products],
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

  const closeVoidModal = () => {
    if (voidingId !== null) return;
    setVoidTarget(null);
    setVoidReason(undefined);
    setOwnerEmail('');
    setOwnerPassword('');
  };

  const openVoidModal = (sale: SaleRow) => {
    setVoidTarget(sale);
    setVoidReason(undefined);
    setOwnerEmail('');
    setOwnerPassword('');
  };

  const handleVoidSale = async () => {
    if (!voidTarget || !voidReason) return;
    try {
      setVoidingId(voidTarget.id);
      await apiVoidSale(voidTarget.id, {
        reason: voidReason,
        ...(voidTarget.voidPolicy.requiresOwnerApproval
          ? { ownerEmail, ownerPassword }
          : {}),
      });
      globalMessage.success(
        isZh
          ? `销售单 ${voidTarget.saleNumber} 已撤销，库存已恢复`
          : isFr
            ? `Vente ${voidTarget.saleNumber} annulée et stock restauré`
            : `Sale ${voidTarget.saleNumber} voided and inventory restored`,
      );
      setVoidTarget(null);
      setVoidReason(undefined);
      setOwnerEmail('');
      setOwnerPassword('');
      await Promise.all([loadProducts(), loadHistory()]);
    } catch (error) {
      globalMessage.error(
        error instanceof ApiError && error.status === 401
          ? isZh
            ? 'Owner 账号或密码验证失败'
            : isFr
              ? 'Échec de la confirmation du propriétaire'
              : 'Owner confirmation failed'
          : isZh
            ? '撤销失败，可能已超过 10 分钟，请刷新后重试'
            : isFr
              ? 'Échec de l’annulation. Le délai de 10 minutes est peut-être dépassé.'
              : 'Unable to void the sale. The 10-minute window may have expired.',
      );
    } finally {
      setVoidingId(null);
    }
  };

  const reasonLabels: Record<VoidReasonCode, string> = {
    wrong_item: isZh ? '商品选错' : isFr ? 'Mauvais article' : 'Wrong item',
    wrong_quantity: isZh ? '数量错误' : isFr ? 'Mauvaise quantité' : 'Wrong quantity',
    duplicate_sale: isZh ? '重复销售' : isFr ? 'Vente en double' : 'Duplicate sale',
    customer_cancelled: isZh ? '顾客取消' : isFr ? 'Annulation du client' : 'Customer cancelled',
    payment_error: isZh ? '支付错误' : isFr ? 'Erreur de paiement' : 'Payment error',
    other: isZh ? '其他' : isFr ? 'Autre' : 'Other',
  };
  const reasonOptions = Object.entries(reasonLabels).map(([value, label]) => ({
    value: value as VoidReasonCode,
    label,
  }));

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
            <>
              <Tag color="default">
                {isZh ? '已撤销' : isFr ? 'Annulée' : 'Voided'}
              </Tag>
              {sale.voidReason && sale.voidReason in reasonLabels && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {reasonLabels[sale.voidReason as VoidReasonCode]}
                </Typography.Text>
              )}
              {sale.voidApprovedBy && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {isZh
                    ? `Owner 确认：${sale.voidApprovedBy.email}`
                    : isFr
                      ? `Confirmée par : ${sale.voidApprovedBy.email}`
                      : `Owner approval: ${sale.voidApprovedBy.email}`}
                </Typography.Text>
              )}
            </>
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
        ) : !sale.voidPolicy.canVoid ||
          (sale.voidPolicy.windowEndsAt !== null &&
            new Date(sale.voidPolicy.windowEndsAt).getTime() <= policyClock) ? (
          <Typography.Text type="secondary">
            {sale.voidPolicy.restriction === 'not_own_sale'
              ? isZh
                ? '仅限本人'
                : isFr
                  ? 'Vente personnelle'
                  : 'Own sales only'
              : isZh
                ? '已超过 10 分钟'
                : isFr
                  ? 'Délai de 10 min dépassé'
                  : '10-minute window expired'}
          </Typography.Text>
        ) : (
          <Button
            danger
            size="small"
            icon={<UndoOutlined />}
            loading={voidingId === sale.id}
            onClick={() => openVoidModal(sale)}
          >
            {isZh ? '撤销' : isFr ? 'Annuler' : 'Void'}
          </Button>
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
          <Select<CategoryFilter>
            aria-label={isZh ? '商品分类' : isFr ? 'Catégorie de produit' : 'Product category'}
            value={categoryFilter}
            onChange={(value) => {
              setCategoryFilter(value);
              setSelectedProductId(null);
              setQuantity(1);
            }}
            options={categoryOptions}
            style={{ width: 220 }}
          />
          <Select
            showSearch
            aria-label={isZh ? '选择商品' : isFr ? 'Choisir un produit' : 'Choose product'}
            placeholder={
              isZh
                ? '按名称、条码或 SKU 搜索'
                : isFr
                  ? 'Rechercher par nom, code-barres ou UGS'
                  : 'Search by name, barcode, or SKU'
            }
            style={{ width: 380 }}
            value={selectedProductId}
            onChange={setSelectedProductId}
            filterOption={(input, option) =>
              productSearchIndex
                .get(Number(option?.value))
                ?.includes(input.trim().toLocaleLowerCase()) ?? false
            }
            notFoundContent={
              isZh
                ? '该分类没有匹配商品'
                : isFr
                  ? 'Aucun produit correspondant dans cette catégorie'
                  : 'No matching products in this category'
            }
            options={filteredProducts.map((product) => ({
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
            ? 'Cashier 只能撤销自己最近 10 分钟的销售；$100 及以上需要 Owner 确认。Owner 可以撤销所有销售。'
            : isFr
              ? 'Un caissier peut annuler ses propres ventes dans les 10 minutes. À partir de 100 $, la confirmation du propriétaire est requise. Le propriétaire peut annuler toute vente.'
              : 'Cashiers can void their own sales within 10 minutes. Voids of $100 or more require Owner confirmation. Owners can void any sale.'}
        </Typography.Paragraph>
      </Card>

      <Modal
        open={voidTarget !== null}
        title={
          voidTarget
            ? isZh
              ? `撤销销售 ${voidTarget.saleNumber}`
              : isFr
                ? `Annuler la vente ${voidTarget.saleNumber}`
                : `Void Sale ${voidTarget.saleNumber}`
            : undefined
        }
        onCancel={closeVoidModal}
        closable={voidingId === null}
        maskClosable={voidingId === null}
        footer={
          <Space>
            <Button onClick={closeVoidModal} disabled={voidingId !== null}>
              {isZh ? '取消' : isFr ? 'Fermer' : 'Cancel'}
            </Button>
            <Button
              danger
              type="primary"
              icon={<UndoOutlined />}
              loading={voidingId !== null}
              disabled={
                !voidReason ||
                Boolean(
                  voidTarget?.voidPolicy.requiresOwnerApproval &&
                    (!ownerEmail.trim() || !ownerPassword),
                )
              }
              onClick={handleVoidSale}
            >
              {isZh ? '确认撤销' : isFr ? 'Confirmer l’annulation' : 'Confirm Void'}
            </Button>
          </Space>
        }
      >
        {voidTarget && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              type="warning"
              showIcon
              message={
                isZh
                  ? `销售总额 $${Number(voidTarget.total).toFixed(2)}`
                  : isFr
                    ? `Total de la vente : ${Number(voidTarget.total).toFixed(2)} $`
                    : `Sale total: $${Number(voidTarget.total).toFixed(2)}`
              }
              description={
                isZh
                  ? '撤销后库存会自动恢复，销售记录和操作人仍会保留。'
                  : isFr
                    ? 'Le stock sera restauré; la vente et l’opérateur resteront dans l’historique.'
                    : 'Inventory will be restored while the sale and operator remain in history.'
              }
            />

            <div>
              <Typography.Text strong>
                {isZh ? '撤销原因（必选）' : isFr ? 'Motif (obligatoire)' : 'Void reason (required)'}
              </Typography.Text>
              <Select<VoidReasonCode>
                value={voidReason}
                onChange={setVoidReason}
                options={reasonOptions}
                placeholder={
                  isZh
                    ? '请选择撤销原因'
                    : isFr
                      ? 'Sélectionner un motif'
                      : 'Select a void reason'
                }
                style={{ width: '100%', marginTop: 8 }}
              />
            </div>

            {voidTarget.voidPolicy.requiresOwnerApproval && (
              <>
                <Alert
                  type="error"
                  showIcon
                  message={
                    isZh
                      ? `大额撤销：$${voidTarget.voidPolicy.largeVoidThreshold} 及以上需要 Owner 确认`
                      : isFr
                        ? `Annulation importante : confirmation requise à partir de ${voidTarget.voidPolicy.largeVoidThreshold} $`
                        : `Large void: Owner confirmation is required at $${voidTarget.voidPolicy.largeVoidThreshold} or more`
                  }
                />
                <Input
                  value={ownerEmail}
                  onChange={(event) => setOwnerEmail(event.target.value)}
                  placeholder={
                    isZh ? 'Owner 邮箱' : isFr ? 'Courriel du propriétaire' : 'Owner email'
                  }
                  autoComplete="username"
                />
                <Input.Password
                  value={ownerPassword}
                  onChange={(event) => setOwnerPassword(event.target.value)}
                  placeholder={
                    isZh ? 'Owner 密码' : isFr ? 'Mot de passe du propriétaire' : 'Owner password'
                  }
                  autoComplete="current-password"
                  onPressEnter={() => {
                    if (voidReason && ownerEmail.trim() && ownerPassword) {
                      void handleVoidSale();
                    }
                  }}
                />
              </>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
}

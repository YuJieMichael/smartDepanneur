'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Form, Input, InputNumber, Modal, Select, Space, Tag } from 'antd';
import { AlertOutlined, ClockCircleOutlined, MinusOutlined, PlusOutlined, ToolOutlined } from '@ant-design/icons';
import DataTable, { DataTableColumnConfig, DataTableParams, DataTableResult } from '@/components/table/data-table';
import {
  apiAdjustStock,
  apiGetExpirationAlerts,
  apiGetInventoryFilterOptions,
  apiGetInventoryMovementList,
  apiGetLowStockProducts,
  apiStockIn,
  apiWasteStock,
  ExpirationAlertRow,
  InventoryMovementRow,
  LowStockProductRow,
} from '@/api/inventory';
import { apiGetProductList, ProductRow } from '@/api/products';
import { useI18nStore, useT } from '@/lib/i18n';
import { globalMessage } from '@/lib/message-bridge';

type ModalMode = 'stockIn' | 'adjust' | 'waste' | null;

interface StockFormValues {
  productId: number;
  quantity: number;
  unitCost?: number | null;
  reason?: string | null;
}

export default function InventoryPage() {
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const isZh = locale === 'zh';
  const isFr = locale === 'fr';
  const [refreshFlag, setRefreshFlag] = useState(0);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [lowStock, setLowStock] = useState<LowStockProductRow[]>([]);
  const [expirationAlerts, setExpirationAlerts] = useState<ExpirationAlertRow[]>([]);
  const [form] = Form.useForm<StockFormValues>();

  useEffect(() => {
    apiGetProductList({ pageSize: 500, filterActive: 'true', sortField: 'name', sortOrder: 'asc' })
      .then((result) => setProducts(result.list))
      .catch(() => {});
    apiGetLowStockProducts().then(setLowStock).catch(() => {});
    apiGetExpirationAlerts(7).then(setExpirationAlerts).catch(() => {});
  }, [refreshFlag]);

  const fetchData = useCallback(
    async (params: DataTableParams): Promise<DataTableResult<InventoryMovementRow>> => {
      return apiGetInventoryMovementList({
        productName: params.search || undefined,
        filterTypes: params.filters.filterTypes,
        filterProductNames: params.filters.filterProductNames,
        filterCreatedDates: params.filters.filterCreatedDates,
        sortField: params.sortField as 'id' | 'type' | 'quantity' | 'createdAt',
        sortOrder: params.sortOrder,
        page: params.page,
        pageSize: params.pageSize,
      });
    },
    [],
  );

  const fetchFilterOptions = useCallback(
    async (field: string, context: Record<string, string | undefined>) => {
      return apiGetInventoryFilterOptions(field, {
        productName: context.search,
        filterTypes: context.filterTypes,
        filterProductNames: context.filterProductNames,
        filterCreatedDates: context.filterCreatedDates,
      });
    },
    [],
  );

  const openModal = (mode: Exclude<ModalMode, null>) => {
    form.resetFields();
    setModalMode(mode);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      setModalLoading(true);

      if (modalMode === 'stockIn') {
        await apiStockIn({
          productId: values.productId,
          quantity: values.quantity,
          unitCost: values.unitCost ?? null,
          reason: values.reason ?? null,
        });
        globalMessage.success(isZh ? `已入库 ${values.quantity} 件` : isFr ? `${values.quantity} unité(s) reçue(s)` : `Stocked in ${values.quantity} unit(s)`);
      }

      if (modalMode === 'adjust') {
        await apiAdjustStock({
          productId: values.productId,
          quantity: values.quantity,
          reason: values.reason ?? null,
        });
        globalMessage.success(isZh ? `库存已调整 ${values.quantity}` : isFr ? `Stock ajusté de ${values.quantity}` : `Stock adjusted by ${values.quantity}`);
      }

      if (modalMode === 'waste') {
        await apiWasteStock({
          productId: values.productId,
          quantity: values.quantity,
          reason: values.reason ?? null,
        });
        globalMessage.success(isZh ? `已记录 ${values.quantity} 件报损` : isFr ? `${values.quantity} unité(s) marquée(s) comme perte` : `Recorded ${values.quantity} unit(s) as waste`);
      }

      form.resetFields();
      setModalMode(null);
      setRefreshFlag((flag) => flag + 1);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'errorFields' in error) return;
      globalMessage.error(t.common.create_failed);
    } finally {
      setModalLoading(false);
    }
  };

  const movementTypeColor: Record<InventoryMovementRow['type'], string> = {
    purchase: 'green',
    adjustment: 'blue',
    sale: 'purple',
    waste: 'red',
    expired: 'orange',
    return_item: 'cyan',
  };

  const columns: DataTableColumnConfig<InventoryMovementRow>[] = [
    {
      title: isZh ? '商品' : isFr ? 'Produit' : 'Product',
      dataIndex: 'product',
      editable: false,
      filterKey: 'filterProductNames',
      filterField: 'productName',
      render: (product: InventoryMovementRow['product']) => product.name,
    },
    {
      title: isZh ? '类型' : isFr ? 'Type' : 'Type',
      dataIndex: 'type',
      editable: false,
      filterKey: 'filterTypes',
      filterField: 'type',
      width: 120,
      render: (type: InventoryMovementRow['type']) => (
        <Tag color={movementTypeColor[type]}>{type.replace('_', ' ')}</Tag>
      ),
    },
    {
      title: isZh ? '数量' : isFr ? 'Quantité' : 'Quantity',
      dataIndex: 'quantity',
      editable: false,
      sorter: true,
      width: 100,
      render: (quantity: number) => (
        <span style={{ color: quantity > 0 ? '#389e0d' : '#cf1322', fontWeight: 600 }}>
          {quantity > 0 ? `+${quantity}` : quantity}
        </span>
      ),
    },
    {
      title: isZh ? '调整后库存' : isFr ? 'Stock après' : 'Stock After',
      dataIndex: 'product',
      editable: false,
      width: 110,
      render: (product: InventoryMovementRow['product']) => product.currentStock,
    },
    {
      title: isZh ? '原因' : isFr ? 'Raison' : 'Reason',
      dataIndex: 'reason',
      editable: false,
      render: (value: string | null) => value ?? <span style={{ color: '#bbb' }}>-</span>,
    },
    {
      title: isZh ? '操作人' : isFr ? 'Par' : 'By',
      dataIndex: 'user',
      editable: false,
      width: 180,
      render: (user: InventoryMovementRow['user']) =>
        user ? user.email : <span style={{ color: '#bbb' }}>-</span>,
    },
    {
      title: isZh ? '日期' : isFr ? 'Date' : 'Date',
      dataIndex: 'createdAt',
      editable: false,
      sorter: true,
      filterKey: 'filterCreatedDates',
      filterField: 'createdAt',
      date: true,
      width: 120,
    },
  ];

  const productOptions = products.map((product) => ({
    label: `${product.name}${product.sku ? ` (${product.sku})` : ''} - ${isZh ? '库存' : isFr ? 'stock' : 'stock'}: ${product.currentStock}`,
    value: product.id,
  }));

  const modalTitles: Record<Exclude<ModalMode, null>, string> = {
    stockIn: isZh ? '入库 - 接收商品' : isFr ? 'Réception - Ajouter du stock' : 'Stock In - Receive Products',
    adjust: isZh ? '调整库存' : isFr ? 'Ajuster le stock' : 'Adjust Stock',
    waste: isZh ? '记录报损 / 丢弃' : isFr ? 'Enregistrer une perte' : 'Record Waste / Disposal',
  };

  return (
    <>
      <div style={{ display: 'grid', gap: 8, padding: lowStock.length || expirationAlerts.length ? '8px 24px' : 0 }}>
        {lowStock.length > 0 && (
          <Alert
            type="error"
            showIcon
            icon={<AlertOutlined />}
            message={isZh ? `${lowStock.length} 个商品低于或等于最低库存` : isFr ? `${lowStock.length} produit(s) sont au niveau ou sous le stock minimum` : `${lowStock.length} product(s) are at or below minimum stock`}
            description={
              <Space wrap>
                {lowStock.slice(0, 8).map((product) => (
                  <Tag key={product.id} color="error">
                    {product.name} ({product.currentStock}/{product.minStock})
                  </Tag>
                ))}
                {lowStock.length > 8 && <Tag color="error">+{lowStock.length - 8} {isZh ? '更多' : isFr ? 'de plus' : 'more'}</Tag>}
              </Space>
            }
          />
        )}

        {expirationAlerts.length > 0 && (
          <Alert
            type="warning"
            showIcon
            icon={<ClockCircleOutlined />}
            message={isZh ? `${expirationAlerts.length} 个商品已过期或将在 7 天内过期` : isFr ? `${expirationAlerts.length} produit(s) expirés ou expirant dans 7 jours` : `${expirationAlerts.length} product(s) expired or expiring within 7 days`}
            description={
              <Space wrap>
                {expirationAlerts.slice(0, 8).map((product) => (
                  <Tag key={product.id} color={product.status === 'expired' ? 'red' : 'orange'}>
                    {product.name} ({product.daysUntilExpiration < 0 ? (isZh ? '已过期' : isFr ? 'expiré' : 'expired') : `${product.daysUntilExpiration}${isZh ? '天' : isFr ? ' j' : 'd'}`})
                  </Tag>
                ))}
                {expirationAlerts.length > 8 && <Tag color="warning">+{expirationAlerts.length - 8} {isZh ? '更多' : isFr ? 'de plus' : 'more'}</Tag>}
              </Space>
            }
          />
        )}
      </div>

      <DataTable<InventoryMovementRow>
        title={t.nav.inventory}
        rowKey="id"
        columns={columns}
        searchPlaceholder={isZh ? '按商品名称搜索' : isFr ? 'Rechercher par produit' : 'Search by product name'}
        defaultSortField="createdAt"
        totalLabel={isZh ? '共 {count} 条库存流水' : isFr ? '{count} mouvements au total' : 'Total {count} movements'}
        fetchData={fetchData}
        fetchFilterOptions={fetchFilterOptions}
        headerExtra={
          <Space>
            <Button icon={<PlusOutlined />} type="primary" onClick={() => openModal('stockIn')}>
              {isZh ? '入库' : isFr ? 'Réception' : 'Stock In'}
            </Button>
            <Button icon={<ToolOutlined />} onClick={() => openModal('adjust')}>
              {isZh ? '调整' : isFr ? 'Ajuster' : 'Adjust'}
            </Button>
            <Button icon={<MinusOutlined />} danger onClick={() => openModal('waste')}>
              {isZh ? '报损' : isFr ? 'Perte' : 'Waste'}
            </Button>
          </Space>
        }
        refreshFlag={refreshFlag}
      />

      <Modal
        title={modalMode ? modalTitles[modalMode] : ''}
        open={modalMode !== null}
        onOk={handleModalOk}
        onCancel={() => {
          form.resetFields();
          setModalMode(null);
        }}
        confirmLoading={modalLoading}
        okText={t.common.submit}
        cancelText={t.common.cancel}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item label={isZh ? '商品' : isFr ? 'Produit' : 'Product'} name="productId" rules={[{ required: true, message: isZh ? '请选择商品' : isFr ? 'Sélectionnez un produit' : 'Select a product' }]}>
            <Select showSearch optionFilterProp="label" options={productOptions} placeholder={isZh ? '搜索商品' : isFr ? 'Rechercher un produit' : 'Search product'} />
          </Form.Item>
          <Form.Item
            label={modalMode === 'adjust' ? (isZh ? '数量（正数增加，负数减少）' : isFr ? 'Quantité (positif = ajouter, négatif = retirer)' : 'Quantity (positive = add, negative = remove)') : (isZh ? '数量' : isFr ? 'Quantité' : 'Quantity')}
            name="quantity"
            rules={[{ required: true, message: isZh ? '请输入数量' : isFr ? 'Entrez la quantité' : 'Enter quantity' }]}
          >
            <InputNumber min={modalMode === 'adjust' ? undefined : 1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          {modalMode === 'stockIn' && (
            <Form.Item label={isZh ? '单位成本 ($)' : isFr ? 'Coût unitaire ($)' : 'Unit Cost ($)'} name="unitCost">
              <InputNumber min={0} precision={2} prefix="$" style={{ width: '100%' }} />
            </Form.Item>
          )}
          <Form.Item label={isZh ? '原因（可选）' : isFr ? 'Raison (facultatif)' : 'Reason (optional)'} name="reason">
            <Input.TextArea rows={2} placeholder={isZh ? '例如：供应商每周送货' : isFr ? 'ex. Livraison hebdomadaire du fournisseur' : 'e.g. Weekly delivery from supplier'} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

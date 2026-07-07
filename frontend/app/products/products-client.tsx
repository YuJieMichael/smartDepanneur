'use client';

import { useCallback, useState } from 'react';
import { Button, Popconfirm, Tag } from 'antd';
import { DeleteOutlined, FileSearchOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons';
import DataTable, {
  DataTableColumnConfig,
  DataTableParams,
  DataTableResult,
} from '@/components/table/data-table';
import AuditTrailDialog from '@/components/common/audit-trail-dialog';
import CreateProductDialog from '@/components/common/create-product-dialog';
import {
  apiDeleteProduct,
  apiGetProductById,
  apiGetProductFilterOptions,
  apiGetProductList,
  ProductRow,
} from '@/api/products';
import { useI18nStore, useT } from '@/lib/i18n';
import { globalMessage } from '@/lib/message-bridge';

export default function ProductsClient() {
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const isZh = locale === 'zh';
  const isFr = locale === 'fr';
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditRecordId, setAuditRecordId] = useState<number>(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshFlag, setRefreshFlag] = useState(0);

  const fetchData = useCallback(
    async (params: DataTableParams): Promise<DataTableResult<ProductRow>> => {
      return apiGetProductList({
        name: params.search || undefined,
        filterIds: params.filters.filterIds,
        filterNames: params.filters.filterNames,
        filterCategories: params.filters.filterCategories,
        filterSuppliers: params.filters.filterSuppliers,
        filterActive: params.filters.filterActive,
        filterCreatedDates: params.filters.filterCreatedDates,
        sortField: params.sortField as 'id' | 'name' | 'currentStock' | 'sellingPrice' | 'createdAt' | 'updatedAt',
        sortOrder: params.sortOrder,
        page: params.page,
        pageSize: params.pageSize,
      });
    },
    [],
  );

  const fetchFilterOptions = useCallback(
    async (field: string, context: Record<string, string | undefined>) => {
      return apiGetProductFilterOptions(field, {
        name: context.search,
        filterIds: context.filterIds,
        filterNames: context.filterNames,
        filterCategories: context.filterCategories,
        filterSuppliers: context.filterSuppliers,
        filterActive: context.filterActive,
        filterCreatedDates: context.filterCreatedDates,
      });
    },
    [],
  );

  const fetchRow = useCallback(
    async (id: string | number) => apiGetProductById(id),
    [],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await apiDeleteProduct(id);
        globalMessage.success(t.common.delete_success);
        setRefreshFlag((flag) => flag + 1);
      } catch {
        globalMessage.error(t.common.delete_failed);
      }
    },
    [t],
  );

  const getExpirationStatus = (record: ProductRow) => {
    if (!record.expirationTracked || !record.expirationDate) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expirationDate = new Date(record.expirationDate);
    const days = Math.ceil((expirationDate.getTime() - today.getTime()) / 86400000);

    if (days < 0) return <Tag color="red">{isZh ? '已过期' : isFr ? 'Expiré' : 'Expired'}</Tag>;
    if (days <= 7) return <Tag color="orange">{isZh ? `${days} 天后过期` : isFr ? `Expire dans ${days} j` : `Expiring in ${days}d`}</Tag>;
    return <Tag color="green">{isZh ? '安全' : isFr ? 'OK' : 'Safe'}</Tag>;
  };

  const columns: DataTableColumnConfig<ProductRow>[] = [
    {
      title: t.products.name,
      dataIndex: 'name',
      editable: false,
      sorter: true,
      filterKey: 'filterNames',
      filterField: 'name',
    },
    {
      title: t.products.category,
      dataIndex: 'category',
      editable: false,
      filterKey: 'filterCategories',
      filterField: 'category',
      render: (category: ProductRow['category']) =>
        category ? <Tag>{category.name}</Tag> : <span style={{ color: '#bbb' }}>-</span>,
    },
    {
      title: t.products.supplier,
      dataIndex: 'supplier',
      editable: false,
      filterKey: 'filterSuppliers',
      filterField: 'supplier',
      render: (supplier: ProductRow['supplier']) =>
        supplier ? <span>{supplier.name}</span> : <span style={{ color: '#bbb' }}>-</span>,
    },
    {
      title: t.products.selling_price,
      dataIndex: 'sellingPrice',
      editable: false,
      sorter: true,
      width: 130,
      render: (value: string) => `$${parseFloat(value).toFixed(2)}`,
    },
    {
      title: t.products.current_stock,
      dataIndex: 'currentStock',
      editable: false,
      sorter: true,
      width: 110,
      render: (stock: number, record: ProductRow) =>
        stock <= record.minStock ? (
          <span style={{ color: '#cf1322', fontWeight: 600 }}>
            <WarningOutlined style={{ marginRight: 4 }} />
            {stock}
          </span>
        ) : (
          <span>{stock}</span>
        ),
    },
    {
      title: t.products.min_stock,
      dataIndex: 'minStock',
      editable: false,
      width: 100,
    },
    {
      title: isZh ? '保质期' : isFr ? 'Expiration' : 'Expiration',
      dataIndex: 'expirationDate',
      editable: false,
      width: 150,
      render: (_: unknown, record: ProductRow) =>
        getExpirationStatus(record) ?? <span style={{ color: '#bbb' }}>-</span>,
    },
    {
      title: t.products.is_active,
      dataIndex: 'isActive',
      editable: false,
      width: 90,
      filterKey: 'filterActive',
      filterField: 'isActive',
      render: (active: boolean) =>
        active ? <Tag color="green">{isZh ? '启用' : isFr ? 'Actif' : 'Active'}</Tag> : <Tag color="default">{isZh ? '停用' : isFr ? 'Inactif' : 'Inactive'}</Tag>,
    },
    {
      title: isZh ? '操作' : isFr ? 'Action' : 'Action',
      editable: false,
      tooltip: false,
      dataIndex: 'id',
      width: 100,
      render: (_: unknown, record: ProductRow) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Button
            type="link"
            size="small"
            icon={<FileSearchOutlined />}
            onClick={() => {
              setAuditRecordId(record.id);
              setAuditOpen(true);
            }}
            style={{ padding: 0 }}
          />
          <Popconfirm
            title={t.common.delete_confirm}
            onConfirm={() => handleDelete(record.id)}
            okText={t.common.submit}
            cancelText={t.common.cancel}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} style={{ padding: 0 }} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable<ProductRow>
        title={t.products.title}
        rowKey="id"
        columns={columns}
        searchPlaceholder={t.products.search_placeholder}
        defaultSortField="id"
        totalLabel={t.products.total}
        fetchData={fetchData}
        fetchFilterOptions={fetchFilterOptions}
        fetchRow={fetchRow}
        headerExtra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            {t.common.create}
          </Button>
        }
        refreshFlag={refreshFlag}
      />
      <AuditTrailDialog
        open={auditOpen}
        table="products"
        recordId={auditRecordId}
        onClose={() => setAuditOpen(false)}
      />
      <CreateProductDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          setRefreshFlag((flag) => flag + 1);
        }}
      />
    </>
  );
}

'use client';

import { useCallback, useState } from 'react';
import { Button, Modal, Form, Input, Popconfirm } from 'antd';
import { DeleteOutlined, FileSearchOutlined, PlusOutlined } from '@ant-design/icons';
import DataTable, { DataTableColumnConfig, DataTableParams, DataTableResult } from '@/components/table/data-table';
import AuditTrailDialog from '@/components/common/audit-trail-dialog';
import {
  apiGetCategoryList,
  apiGetCategoryFilterOptions,
  apiGetCategoryById,
  apiCreateCategory,
  apiUpdateCategory,
  apiDeleteCategory,
  CategoryRow,
} from '@/api/categories';
import { useT } from '@/lib/i18n';
import { globalMessage } from '@/lib/message-bridge';

export default function CategoriesPage() {
  const t = useT();
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditRecordId, setAuditRecordId] = useState<number>(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [refreshFlag, setRefreshFlag] = useState(0);
  const [form] = Form.useForm();

  const fetchData = useCallback(
    async (params: DataTableParams): Promise<DataTableResult<CategoryRow>> => {
      return apiGetCategoryList({
        name: params.search || undefined,
        filterNames: params.filters.filterNames,
        filterCodes: params.filters.filterCodes,
        filterCreatedDates: params.filters.filterCreatedDates,
        sortField: params.sortField as any,
        sortOrder: params.sortOrder,
        page: params.page,
        pageSize: params.pageSize,
      });
    },
    [],
  );

  const fetchFilterOptions = useCallback(
    async (field: string, context: Record<string, string | undefined>) => {
      return apiGetCategoryFilterOptions(field, {
        name: context.search,
        filterNames: context.filterNames,
        filterCodes: context.filterCodes,
        filterCreatedDates: context.filterCreatedDates,
      });
    },
    [],
  );

  const fetchRow = useCallback(async (id: string | number) => apiGetCategoryById(id), []);

  const onCellUpdate = useCallback(
    async (rowId: string | number, dataIndex: string, newValue: any) => {
      await apiUpdateCategory(rowId, { [dataIndex]: newValue });
    },
    [],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await apiDeleteCategory(id);
        globalMessage.success(t.common.delete_success);
        setRefreshFlag((f) => f + 1);
      } catch {
        globalMessage.error(t.common.delete_failed);
      }
    },
    [t],
  );

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setCreateLoading(true);
      await apiCreateCategory({ name: values.name, code: values.code || null });
      globalMessage.success(t.common.create_success);
      form.resetFields();
      setCreateOpen(false);
      setRefreshFlag((f) => f + 1);
    } catch (err: any) {
      if (err?.errorFields) return;
      globalMessage.error(t.common.create_failed);
    } finally {
      setCreateLoading(false);
    }
  };

  const columns: DataTableColumnConfig<CategoryRow>[] = [
    {
      title: 'Name',
      dataIndex: 'name',
      sorter: true,
      filterKey: 'filterNames',
      filterField: 'name',
      editable: true,
    },
    {
      title: 'Code',
      dataIndex: 'code',
      filterKey: 'filterCodes',
      filterField: 'code',
      editable: true,
      render: (v: string | null) => v ?? <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      sorter: true,
      filterKey: 'filterCreatedDates',
      filterField: 'createdAt',
      editable: false,
      date: true,
    },
    {
      title: 'Action',
      editable: false,
      tooltip: false,
      dataIndex: 'id',
      width: 100,
      render: (_: any, record: CategoryRow) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Button type="link" size="small" icon={<FileSearchOutlined />}
            onClick={() => { setAuditRecordId(record.id); setAuditOpen(true); }}
            style={{ padding: 0 }} />
          <Popconfirm title={t.common.delete_confirm} onConfirm={() => handleDelete(record.id)}
            okText={t.common.submit} cancelText={t.common.cancel}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} style={{ padding: 0 }} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable<CategoryRow>
        title={t.nav.categories}
        rowKey="id"
        columns={columns}
        searchPlaceholder="Search by name…"
        defaultSortField="id"
        totalLabel="Total {count} categories"
        fetchData={fetchData}
        fetchFilterOptions={fetchFilterOptions}
        onCellUpdate={onCellUpdate}
        fetchRow={fetchRow}
        headerExtra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            {t.common.create}
          </Button>
        }
        refreshFlag={refreshFlag}
      />
      <AuditTrailDialog open={auditOpen} table="categories" recordId={auditRecordId} onClose={() => setAuditOpen(false)} />
      <Modal
        title="Create Category"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => { form.resetFields(); setCreateOpen(false); }}
        confirmLoading={createLoading}
        okText={t.common.submit}
        cancelText={t.common.cancel}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Name" name="name" rules={[{ required: true, message: 'Please enter a category name' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Code" name="code">
            <Input placeholder="e.g. DRINKS" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

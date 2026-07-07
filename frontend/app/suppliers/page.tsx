'use client';

import { useCallback, useState } from 'react';
import { Button, Form, Input, Modal, Popconfirm } from 'antd';
import { DeleteOutlined, FileSearchOutlined, PlusOutlined } from '@ant-design/icons';
import DataTable, { DataTableColumnConfig, DataTableParams, DataTableResult } from '@/components/table/data-table';
import AuditTrailDialog from '@/components/common/audit-trail-dialog';
import {
  apiGetSupplierList,
  apiGetSupplierFilterOptions,
  apiGetSupplierById,
  apiCreateSupplier,
  apiUpdateSupplier,
  apiDeleteSupplier,
  SupplierRow,
} from '@/api/suppliers';
import { useT } from '@/lib/i18n';
import { globalMessage } from '@/lib/message-bridge';

export default function SuppliersPage() {
  const t = useT();
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditRecordId, setAuditRecordId] = useState<number>(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [refreshFlag, setRefreshFlag] = useState(0);
  const [form] = Form.useForm();

  const fetchData = useCallback(
    async (params: DataTableParams): Promise<DataTableResult<SupplierRow>> => {
      return apiGetSupplierList({
        name: params.search || undefined,
        filterNames: params.filters.filterNames,
        filterContactNames: params.filters.filterContactNames,
        filterEmails: params.filters.filterEmails,
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
      return apiGetSupplierFilterOptions(field, {
        name: context.search,
        filterNames: context.filterNames,
        filterContactNames: context.filterContactNames,
        filterEmails: context.filterEmails,
        filterCreatedDates: context.filterCreatedDates,
      });
    },
    [],
  );

  const fetchRow = useCallback(async (id: string | number) => apiGetSupplierById(id), []);

  const onCellUpdate = useCallback(
    async (rowId: string | number, dataIndex: string, newValue: any) => {
      await apiUpdateSupplier(rowId, { [dataIndex]: newValue });
    },
    [],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await apiDeleteSupplier(id);
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
      await apiCreateSupplier({
        name: values.name,
        contactName: values.contactName || null,
        phone: values.phone || null,
        email: values.email || null,
        notes: values.notes || null,
      });
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

  const columns: DataTableColumnConfig<SupplierRow>[] = [
    {
      title: 'Name',
      dataIndex: 'name',
      sorter: true,
      filterKey: 'filterNames',
      filterField: 'name',
      editable: true,
    },
    {
      title: 'Contact',
      dataIndex: 'contactName',
      filterKey: 'filterContactNames',
      filterField: 'contactName',
      editable: true,
      render: (v: string | null) => v ?? <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      editable: true,
      render: (v: string | null) => v ?? <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      filterKey: 'filterEmails',
      filterField: 'email',
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
      render: (_: any, record: SupplierRow) => (
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
      <DataTable<SupplierRow>
        title={t.nav.suppliers}
        rowKey="id"
        columns={columns}
        searchPlaceholder="Search by name…"
        defaultSortField="id"
        totalLabel="Total {count} suppliers"
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
      <AuditTrailDialog open={auditOpen} table="suppliers" recordId={auditRecordId} onClose={() => setAuditOpen(false)} />
      <Modal
        title="Create Supplier"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => { form.resetFields(); setCreateOpen(false); }}
        confirmLoading={createLoading}
        okText={t.common.submit}
        cancelText={t.common.cancel}
        destroyOnHidden
        width={480}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Name" name="name" rules={[{ required: true, message: 'Please enter a supplier name' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Contact Name" name="contactName"><Input /></Form.Item>
          <Form.Item label="Phone" name="phone"><Input /></Form.Item>
          <Form.Item label="Email" name="email"><Input type="email" /></Form.Item>
          <Form.Item label="Notes" name="notes"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}

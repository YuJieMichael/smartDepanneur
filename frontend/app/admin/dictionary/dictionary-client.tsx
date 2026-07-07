'use client';

import { useCallback, useState } from 'react';
import { Button, Popconfirm, Tag } from 'antd';
import { DeleteOutlined, FileSearchOutlined, PlusOutlined } from '@ant-design/icons';
import DataTable, {
    DataTableColumnConfig,
    DataTableParams,
    DataTableResult,
} from '@/components/table/data-table';
import AuditTrailDialog from '@/components/common/audit-trail-dialog';
import CreateDictionaryDialog from '@/components/common/create-dictionary-dialog';
import { apiGetDictionaryList, apiGetDictionaryFilterOptions, apiGetDictionaryById, apiUpdateDictionary, apiDeleteDictionary, DictionaryRow } from '@/api/dictionary';
import { useT } from '@/lib/i18n';
import { globalMessage } from '@/lib/message-bridge';
import NA from '@/components/common/na';

export default function DictionaryClient() {
    const t = useT();
    const [auditOpen, setAuditOpen] = useState(false);
    const [auditRecordId, setAuditRecordId] = useState<number>(0);
    const [createOpen, setCreateOpen] = useState(false);
    const [refreshFlag, setRefreshFlag] = useState(0);

    const fetchData = useCallback(
        async (params: DataTableParams): Promise<DataTableResult<DictionaryRow>> => {
            return apiGetDictionaryList({
                key: params.search || undefined,
                filterKeys: params.filters.filterKeys,
                filterCategories: params.filters.filterCategories,
                filterCreatedDates: params.filters.filterCreatedDates,
                filterUpdatedDates: params.filters.filterUpdatedDates,
                sortField: params.sortField as 'id' | 'key' | 'category' | 'createdAt' | 'updatedAt',
                sortOrder: params.sortOrder,
                page: params.page,
                pageSize: params.pageSize,
            });
        },
        [],
    );

    const fetchFilterOptions = useCallback(
        async (field: string, context: Record<string, string | undefined>) => {
            return apiGetDictionaryFilterOptions(field, {
                key: context.search,
                filterKeys: context.filterKeys,
                filterCategories: context.filterCategories,
                filterCreatedDates: context.filterCreatedDates,
                filterUpdatedDates: context.filterUpdatedDates,
            });
        },
        [],
    );

    const onCellUpdate = useCallback(
        async (rowId: string | number, dataIndex: string, newValue: any) => {
            const payload: { key?: string; value?: string[]; category?: string } = {};
            if (dataIndex === 'key') payload.key = newValue;
            if (dataIndex === 'value') payload.value = newValue;
            if (dataIndex === 'category') payload.category = newValue;
            await apiUpdateDictionary(rowId, payload);
        },
        [],
    );

    const fetchRow = useCallback(
        async (id: string | number) => apiGetDictionaryById(id),
        [],
    );

    const handleDelete = useCallback(
        async (id: number) => {
            try {
                await apiDeleteDictionary(id);
                globalMessage.success(t.common.delete_success);
                setRefreshFlag((f) => f + 1);
            } catch {
                globalMessage.error(t.common.delete_failed);
            }
        },
        [t],
    );

    const columns: DataTableColumnConfig<DictionaryRow>[] = [
        {
            title: t.dictionary.key,
            dataIndex: 'key',
            accessCode: 'edit-dictionary',
            sorter: true,
            filterKey: 'filterKeys',
            filterField: 'key',
        },
        {
            title: t.dictionary.value,
            dataIndex: 'value',
            accessCode: 'edit-dictionary',
            type: 'selectInput',
            render: (value: string[]) =>
                value.length ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {value.map((v) => (
                            <Tag key={v} style={{ margin: 0 }}>
                                {v}
                            </Tag>
                        ))}
                    </div>
                ) : (
                    <NA />
                ),
        },
        {
            title: t.dictionary.category,
            dataIndex: 'category',
            accessCode: 'edit-dictionary',
            sorter: true,
            filterKey: 'filterCategories',
            filterField: 'category',
            render: (category: string | null) => category || <NA />,
        },
        {
            title: t.dictionary.created_at,
            dataIndex: 'createdAt',
            editable: false,
            sorter: true,
            filterKey: 'filterCreatedDates',
            filterField: 'createdAt',
            date: true,
        },
        {
            title: t.dictionary.updated_at,
            dataIndex: 'updatedAt',
            editable: false,
            sorter: true,
            filterKey: 'filterUpdatedDates',
            filterField: 'updatedAt',
            date: true,
        },
        {
            title: 'Action',
            editable: false,
            tooltip: false,
            dataIndex: 'id',
            width: 100,
            render: (_: any, record: DictionaryRow) => (
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
                        <Button
                            type="link"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            style={{ padding: 0 }}
                        />
                    </Popconfirm>
                </div>
            ),
        },
    ];

    return (
        <>
            <DataTable<DictionaryRow>
                title={t.nav.dictionary}
                rowKey="id"
                columns={columns}
                searchPlaceholder={t.dictionary.search_placeholder}
                defaultSortField="id"
                totalLabel={t.dictionary.total}
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
            <AuditTrailDialog
                open={auditOpen}
                table="dictionaries"
                recordId={auditRecordId}
                onClose={() => setAuditOpen(false)}
            />
            <CreateDictionaryDialog
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                onSuccess={() => {
                    setCreateOpen(false);
                    setRefreshFlag((f) => f + 1);
                }}
            />
        </>
    );
}

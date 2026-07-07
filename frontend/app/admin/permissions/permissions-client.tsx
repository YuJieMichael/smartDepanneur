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
import CreatePermissionDialog from '@/components/common/create-permission-dialog';
import { apiGetPermissions, apiGetPermissionFilterOptions, apiGetPermissionById, apiUpdatePermission, apiDeletePermission, PermissionRow } from '@/api/permissions';
import { useT } from '@/lib/i18n';
import { globalMessage } from '@/lib/message-bridge';
import NA from '@/components/common/na';

export default function PermissionsClient({ roleOptions }: { roleOptions: { label: string; value: string }[] }) {
    const t = useT();
    const [auditOpen, setAuditOpen] = useState(false);
    const [auditRecordId, setAuditRecordId] = useState<number>(0);
    const [createOpen, setCreateOpen] = useState(false);
    const [refreshFlag, setRefreshFlag] = useState(0);

    const fetchData = useCallback(
        async (params: DataTableParams): Promise<DataTableResult<PermissionRow>> => {
            return apiGetPermissions({
                name: params.search || undefined,
                filterCodes: params.filters.filterCodes,
                filterRoles: params.filters.filterRoles,
                filterCreatedDates: params.filters.filterCreatedDates,
                filterUpdatedDates: params.filters.filterUpdatedDates,
                sortField: params.sortField as 'id' | 'name' | 'createdAt' | 'updatedAt',
                sortOrder: params.sortOrder,
                page: params.page,
                pageSize: params.pageSize,
            });
        },
        [],
    );

    const fetchFilterOptions = useCallback(
        async (field: string, context: Record<string, string | undefined>) => {
            return apiGetPermissionFilterOptions(field, {
                name: context.search,
                filterCodes: context.filterCodes,
                filterRoles: context.filterRoles,
                filterCreatedDates: context.filterCreatedDates,
                filterUpdatedDates: context.filterUpdatedDates,
            });
        },
        [],
    );

    const onCellUpdate = useCallback(
        async (rowId: string | number, dataIndex: string, newValue: any) => {
            const payload: { roles?: string[] } = {};
            if (dataIndex === 'roles') payload.roles = newValue;
            await apiUpdatePermission(rowId, payload);
        },
        [],
    );

    const fetchRow = useCallback(
        async (id: string | number) => apiGetPermissionById(id),
        [],
    );

    const handleDelete = useCallback(
        async (id: number) => {
            try {
                await apiDeletePermission(id);
                globalMessage.success(t.common.delete_success);
                setRefreshFlag((f) => f + 1);
            } catch {
                globalMessage.error(t.common.delete_failed);
            }
        },
        [t],
    );

    const columns: DataTableColumnConfig<PermissionRow>[] = [
        {
            title: t.permissions.code,
            dataIndex: 'name',
            accessCode:'edit-permission',
            sorter: true,
            filterKey: 'filterCodes',
            filterField: 'name',
        },
        {
            title: t.permissions.related_roles,
            dataIndex: 'roles',
            type: 'multipleSelection',
            accessCode:'edit-permission',
            options: roleOptions,
            filterKey: 'filterRoles',
            filterField: 'roles',
            render: (roles: PermissionRow['roles']) =>
                roles.length ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {roles.map((r) => (
                            <Tag key={r.id} style={{ margin: 0 }}>
                                {r.name}
                            </Tag>
                        ))}
                    </div>
                ) : (
                    <NA />
                ),
        },
        {
            title: t.permissions.created_at,
            dataIndex: 'createdAt',
            editable: false,
            sorter: true,
            filterKey: 'filterCreatedDates',
            filterField: 'createdAt',
            date: true,
        },
        {
            title: t.permissions.updated_at,
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
            render: (_: any, record: PermissionRow) => (
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
            <DataTable<PermissionRow>
                title={t.nav.permissions}
                rowKey="id"
                columns={columns}
                searchPlaceholder={t.permissions.search_placeholder}
                defaultSortField="id"
                totalLabel={t.permissions.total}
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
                table="permissions"
                recordId={auditRecordId}
                onClose={() => setAuditOpen(false)}
            />
            <CreatePermissionDialog
                open={createOpen}
                roleOptions={roleOptions}
                onClose={() => setCreateOpen(false)}
                onSuccess={() => {
                    setCreateOpen(false);
                    setRefreshFlag((f) => f + 1);
                }}
            />
        </>
    );
}

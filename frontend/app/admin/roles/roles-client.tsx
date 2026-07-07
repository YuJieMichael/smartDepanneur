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
import CreateRoleDialog from '@/components/common/create-role-dialog';
import { apiGetRolesList, apiGetRoleFilterOptions, apiGetRoleById, apiUpdateRole, apiDeleteRole, RoleRow } from '@/api/roles';
import { useT } from '@/lib/i18n';
import { globalMessage } from '@/lib/message-bridge';
import NA from '@/components/common/na';

export default function RolesClient({ permissionOptions }: { permissionOptions: { label: string; value: string }[] }) {
    const t = useT();
    const [auditOpen, setAuditOpen] = useState(false);
    const [auditRecordId, setAuditRecordId] = useState<number>(0);
    const [createOpen, setCreateOpen] = useState(false);
    const [refreshFlag, setRefreshFlag] = useState(0);

    const fetchData = useCallback(
        async (params: DataTableParams): Promise<DataTableResult<RoleRow>> => {
            return apiGetRolesList({
                name: params.search || undefined,
                filterNames: params.filters.filterNames,
                filterPermissions: params.filters.filterPermissions,
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
            return apiGetRoleFilterOptions(field, {
                name: context.search,
                filterNames: context.filterNames,
                filterPermissions: context.filterPermissions,
                filterCreatedDates: context.filterCreatedDates,
                filterUpdatedDates: context.filterUpdatedDates,
            });
        },
        [],
    );

    const onCellUpdate = useCallback(
        async (rowId: string | number, dataIndex: string, newValue: any) => {
            const payload: { name?: string; permissionNames?: string[] } = {};
            if (dataIndex === 'name') payload.name = newValue;
            if (dataIndex === 'permissions') payload.permissionNames = newValue;
            await apiUpdateRole(rowId, payload);
        },
        [],
    );

    const fetchRow = useCallback(
        async (id: string | number) => apiGetRoleById(id),
        [],
    );

    const handleDelete = useCallback(
        async (id: number) => {
            try {
                await apiDeleteRole(id);
                globalMessage.success(t.common.delete_success);
                setRefreshFlag((f) => f + 1);
            } catch {
                globalMessage.error(t.common.delete_failed);
            }
        },
        [t],
    );

    const columns: DataTableColumnConfig<RoleRow>[] = [
        {
            title: t.roles.name,
            dataIndex: 'name',
            accessCode: 'edit-role',
            sorter: true,
            filterKey: 'filterNames',
            filterField: 'name',
        },
        {
            title: t.roles.related_permissions,
            dataIndex: 'permissions',
            type: 'multipleSelection',
            accessCode: 'edit-role',
            options: permissionOptions,
            filterKey: 'filterPermissions',
            filterField: 'permissions',
            render: (permissions: RoleRow['permissions']) =>
                permissions.length ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {permissions.map((p) => (
                            <Tag key={p.id} style={{ margin: 0 }}>
                                {p.name}
                            </Tag>
                        ))}
                    </div>
                ) : (
                    <NA />
                ),
        },
        {
            title: t.roles.created_at,
            dataIndex: 'createdAt',
            editable: false,
            sorter: true,
            filterKey: 'filterCreatedDates',
            filterField: 'createdAt',
            date: true,
        },
        {
            title: t.roles.updated_at,
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
            render: (_: any, record: RoleRow) => (
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
            <DataTable<RoleRow>
                title={t.nav.roles}
                rowKey="id"
                columns={columns}
                searchPlaceholder={t.roles.search_placeholder}
                defaultSortField="id"
                totalLabel={t.roles.total}
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
                table="roles"
                recordId={auditRecordId}
                onClose={() => setAuditOpen(false)}
            />
            <CreateRoleDialog
                open={createOpen}
                permissionOptions={permissionOptions}
                onClose={() => setCreateOpen(false)}
                onSuccess={() => {
                    setCreateOpen(false);
                    setRefreshFlag((f) => f + 1);
                }}
            />
        </>
    );
}

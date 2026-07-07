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
import CreateUserDialog from '@/components/common/create-user-dialog';
import { apiGetUserById, apiGetUserFilterOptions, apiGetUsers, apiUpdateUser, apiDeleteUser, UserRow } from '@/api/users';
import { useT } from '@/lib/i18n';
import { globalMessage } from '@/lib/message-bridge';
import NA from '@/components/common/na';

interface UsersClientProps {
    roleOptions: { label: string; value: string }[];
}

export default function UsersClient({ roleOptions }: UsersClientProps) {
    const t = useT();
    const [auditOpen, setAuditOpen] = useState(false);
    const [auditRecordId, setAuditRecordId] = useState<number>(0);
    const [createOpen, setCreateOpen] = useState(false);
    const [refreshFlag, setRefreshFlag] = useState(0);
    const fetchData = useCallback(
        async (params: DataTableParams): Promise<DataTableResult<UserRow>> => {
            return apiGetUsers({
                email: params.search || undefined,
                filterIds: params.filters.filterIds,
                filterEmails: params.filters.filterEmails,
                filterRoles: params.filters.filterRoles,
                filterDates: params.filters.filterDates,
                sortField: params.sortField as 'id' | 'email' | 'createdAt',
                sortOrder: params.sortOrder,
                page: params.page,
                pageSize: params.pageSize,
            });
        },
        [],
    );

    const fetchFilterOptions = useCallback(
        async (field: string, context: Record<string, string | undefined>) => {
            return apiGetUserFilterOptions(field, {
                email: context.search,
                filterIds: context.filterIds,
                filterEmails: context.filterEmails,
                filterRoles: context.filterRoles,
                filterDates: context.filterDates,
            });
        },
        [],
    );

    const onCellUpdate = useCallback(
        async (rowId: string | number, dataIndex: string, newValue: any) => {
            const payload: { email?: string; roles?: string[] } = {};
            if (dataIndex === 'email') payload.email = newValue;
            if (dataIndex === 'roles') payload.roles = newValue;
            await apiUpdateUser(rowId, payload);
        },
        [],
    );

    const fetchRow = useCallback(
        async (id: string | number) => apiGetUserById(id),
        [],
    );

    const handleDelete = useCallback(
        async (id: number) => {
            try {
                await apiDeleteUser(id);
                globalMessage.success(t.common.delete_success);
                setRefreshFlag((f) => f + 1);
            } catch {
                globalMessage.error(t.common.delete_failed);
            }
        },
        [t],
    );

    const columns: DataTableColumnConfig<UserRow>[] = [
        {
            title: t.users.email,
            editable: false,
            dataIndex: 'email',
            sorter: true,
            filterKey: 'filterEmails',
            filterField: 'email',
        },
        {
            title: t.users.roles,
            dataIndex: 'roles',
            filterKey: 'filterRoles',
            filterField: 'roles',
            type: 'multipleSelection',
            accessCode:'edit-user',
            options: roleOptions,
            render: (roles: UserRow['roles']) =>
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
            title: t.users.created_at,
            dataIndex: 'createdAt',
            editable: false,
            sorter: true,
            filterKey: 'filterDates',
            filterField: 'createdAt',
            date: true,
        },
        {
            title: 'Action',
            editable: false,
            tooltip: false,
            dataIndex: 'id',
            width: 100,
            render: (_: any, record: UserRow) => (
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
            <DataTable<UserRow>
                title={t.nav.users}
                rowKey="id"
                columns={columns}
                searchPlaceholder={t.users.search_placeholder}
                defaultSortField="id"
                totalLabel={t.users.total}
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
                table="users"
                recordId={auditRecordId}
                onClose={() => setAuditOpen(false)}
            />
            <CreateUserDialog
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

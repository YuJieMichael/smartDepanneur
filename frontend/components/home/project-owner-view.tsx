'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Tag, Popconfirm, message, Tour } from 'antd';
import { PlusOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n';
import { checkPermissionCode } from '@/lib/utils';
import DataTable, {
  DataTableColumnConfig,
  DataTableParams,
  DataTableResult,
} from '@/components/table/data-table';
import { apiGetJobPostList, apiGetJobPostById, apiUpdateJobPost, apiDeleteJobPost } from '@/api/job-post';
import type { JobPost } from '@/api/job-post';
import { apiGetDictionaryByKey } from '@/api/dictionary';

export default function ProjectOwnerView() {
  const t = useT();
  const router = useRouter();
  const canEdit = checkPermissionCode('template-edit');
  const canCreatePost = checkPermissionCode('post-edit');
  const [refreshFlag, setRefreshFlag] = useState(0);
  const [stateOptions, setStateOptions] = useState<{ label: string; value: string }[]>([]);
  const tableRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<HTMLButtonElement>(null);
  const createRef = useRef<HTMLButtonElement>(null);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    apiGetDictionaryByKey('poststate').then((dict) => {
      if (dict?.value) {
        setStateOptions(dict.value.map((v) => ({ label: v, value: v })));
      }
    });
    const tourKey = 'SmartDepanneur_tour_seen_owner';
    if (!localStorage.getItem(tourKey)) {
      setTimeout(() => setTourOpen(true), 800);
      localStorage.setItem(tourKey, '1');
    }
  }, []);

  const fetchData = useCallback(
    async (params: DataTableParams): Promise<DataTableResult<JobPost>> => {
      return apiGetJobPostList({
        title: params.search || undefined,
        filterStates: params.filters.filterStates,
        filterPostedDates: params.filters.filterPostedDates,
        filter: 'my',
        sortField: params.sortField,
        sortOrder: params.sortOrder,
        page: params.page,
        pageSize: params.pageSize,
      });
    },
    [],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await apiDeleteJobPost(id);
        message.success(t.common.delete_success);
        setRefreshFlag((f) => f + 1);
      } catch {
        message.error(t.common.delete_failed);
      }
    },
    [t],
  );

  const columns: DataTableColumnConfig<JobPost>[] = [
    {
      title: '',
      tooltip: false,
      dataIndex: 'appliedCount',
      editable: false,
      width: 40,
      render: (_: any, record: JobPost) =>
        (record.appliedCount ?? 0) > 0 ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 20,
              height: 20,
              borderRadius: '50%',
              backgroundColor: '#ff4d4f',
              color: '#fff',
              fontSize: 12,
              lineHeight: 1,
              padding: '0 4px',
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/post/detail/${record.id}?filter=applied`);
            }}
          >
            {record.appliedCount}
          </span>
        ) : null,
    },
    {
      title: t.home.post_title,
      dataIndex: 'title',
      accessCode:'post-edit',
      type:'input',
      sorter: true,
    },
    {
      title: t.home.post_state,
      dataIndex: 'state',
      accessCode:'post-edit',
      type: 'select',
      options: stateOptions,
      filterKey: 'filterStates',
      filterField: 'state',
      render: (state: string) => (
        <Tag color={state === 'active' ? 'green' : 'default'}>{state}</Tag>
      ),
    },
    {
      title: t.home.post_posted_at,
      dataIndex: 'postedAt',
      editable: false,
      sorter: true,
      date: true,
      filterKey: 'filterPostedDates',
      filterField: 'postedAt',
    },
    {
      title: t.home.post_created_at,
      dataIndex: 'createdAt',
      editable: false,
      sorter: true,
      date: true,
    },
    {
      title: t.home.post_action,
      dataIndex: 'id',
      tooltip: false,
      editable: false,
      width: 120,
      render: (_: any, record: JobPost) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/post/detail/${record.id}`)}
          >
            {t.common.view}
          </Button>
          <Popconfirm
            title={t.home.delete_post_confirm}
            onConfirm={() => handleDelete(record.id)}
            okText={t.common.submit}
            cancelText={t.common.cancel}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  const onCellUpdate = useCallback(
    async (rowId: string | number, dataIndex: string, newValue: any) => {
      const payload: Record<string, any> = {};
      if (dataIndex === 'state') payload.state = newValue;
      await apiUpdateJobPost(Number(rowId), payload);
    },
    [],
  );

  const fetchRow = useCallback(
    async (id: string | number) => apiGetJobPostById(Number(id)),
    [],
  );

  return (
    <>
    <div ref={tableRef}>
    <DataTable<JobPost>
      title={t.home.my_posts_title}
      rowKey="id"
      columns={columns}
      searchPlaceholder={t.home.search_my_posts}
      defaultSortField="appliedCount"
      totalLabel={t.home.total_posts}
      fetchData={fetchData}
      onCellUpdate={onCellUpdate}
      fetchRow={fetchRow}
      headerExtra={
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && (
            <Button ref={templateRef} onClick={() => router.push('/template/edit')}>
              {t.home.edit_template}
            </Button>
          )}
          {canCreatePost && (
            <Button ref={createRef} type="primary" icon={<PlusOutlined />} onClick={() => router.push('/post/new')}>
              {t.home.create_post}
            </Button>
          )}
        </div>
      }
      refreshFlag={refreshFlag}
    />
    </div>
    <Tour
      open={tourOpen}
      onClose={() => setTourOpen(false)}
      steps={[
        { title: t.home.my_posts_title, description: t.tour.owner_table, target: () => tableRef.current! },
        ...(canEdit && templateRef.current ? [{ title: t.home.edit_template, description: t.tour.owner_template, target: () => templateRef.current! }] : []),
        ...(canCreatePost && createRef.current ? [{ title: t.home.create_post, description: t.tour.owner_create, target: () => createRef.current! }] : []),
      ]}
    />
    </>
  );
}

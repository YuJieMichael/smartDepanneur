'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Tag, Typography, Spin, Button } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useT } from '@/lib/i18n';
import { apiGetJobPostById } from '@/api/job-post';
import type { JobPost } from '@/api/job-post';
import { apiGetApplicationsByPostId, apiGetApplicationFilterOptions, apiUpdateApplicationState } from '@/api/application';
import type { Application } from '@/api/application';
import DataTable, {
  DataTableColumnConfig,
  DataTableParams,
  DataTableResult,
} from '@/components/table/data-table';

const { Title, Paragraph } = Typography;

export default function PostDetailClient({ postId: propPostId }: { postId?: number }) {
  const t = useT();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const postId = propPostId ?? Number(params.id);
  const initialFilterRef = useRef(searchParams.get('filter'));

  useEffect(() => {
    if (searchParams.get('filter')) {
      router.replace(`/post/detail/${postId}`, { scroll: false });
    }
  }, []);

  const [post, setPost] = useState<JobPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshFlag, setRefreshFlag] = useState(0);

  useEffect(() => {
    if (!postId) return;
    apiGetJobPostById(postId)
      .then(setPost)
      .finally(() => setLoading(false));
  }, [postId]);

  const fetchData = useCallback(
    async (p: DataTableParams): Promise<DataTableResult<Application>> => {
      return apiGetApplicationsByPostId(postId, {
        search: p.search || undefined,
        filterStates: initialFilterRef.current || p.filters.filterStates,
        filterDates: p.filters.filterDates,
        sortField: p.sortField,
        sortOrder: p.sortOrder,
        page: p.page,
        pageSize: p.pageSize,
      });
    },
    [postId],
  );

  const fetchFilterOptions = useCallback(
    async (field: string) => {
      return apiGetApplicationFilterOptions(postId, field);
    },
    [postId],
  );

  const handleView = useCallback(
    async (app: Application) => {
      if (app.state === 'applied') {
        await apiUpdateApplicationState(app.id, 'reviewed');
      }
      router.push(`/application/${app.id}`);
    },
    [router],
  );

  const stateColorMap: Record<string, string> = {
    applied: 'blue',
    reviewed: 'green',
    rejected: 'red',
  };

  const columns: DataTableColumnConfig<Application>[] = [
    {
      title: '',
      dataIndex: 'state',
      editable: false,
      width: 60,
      render: (state: string) =>
        state === 'applied' ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: '#ff4d4f',
              color: '#fff',
              fontSize: 11,
              lineHeight: 1,
              padding: '0 6px',
              whiteSpace: 'nowrap',
              cursor: 'default',
            }}
          >
            {t.post.new_application}
          </span>
        ) : null,
    },
    {
      title: t.post.applicant_email,
      dataIndex: 'user',
      editable: false,
      render: (_: any, record: Application) => record.user?.email ?? '',
    },
    {
      title: t.post.application_state,
      dataIndex: 'state',
      editable: false,
      sorter: true,
      filterKey: 'filterStates',
      filterField: 'state',
      render: (state: string) => (
        <Tag color={stateColorMap[state] || 'default'}>{state}</Tag>
      ),
    },
    {
      title: t.post.application_date,
      dataIndex: 'createdAt',
      editable: false,
      sorter: true,
      date: true,
      filterKey: 'filterDates',
      filterField: 'createdAt',
    },
    {
      title: t.post.application_action,
      dataIndex: 'id',
      editable: false,
      tooltip: false,
      width: 100,
      render: (_: any, record: Application) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleView(record)}
        >
          {t.common.view}
        </Button>
      ),
    },
  ];

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Spin size="large" /></div>;
  }

  if (!post) return null;

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-6">
        <Title level={3} style={{ marginBottom: 8 }}>{post.title}</Title>
        <Paragraph style={{ marginBottom: 0 }}>{post.jobDescription}</Paragraph>
      </div>
      <div className="flex-1 min-h-0">
        <DataTable<Application>
          title={t.post.applications_title}
          rowKey="id"
          columns={columns}
          searchPlaceholder={t.post.search_applications}
          defaultSortField="state"
          totalLabel={t.post.total_applications}
          fetchData={fetchData}
          fetchFilterOptions={fetchFilterOptions}
          refreshFlag={refreshFlag}
        />
      </div>
    </div>
  );
}

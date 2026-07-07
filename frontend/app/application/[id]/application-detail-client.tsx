'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Typography, Spin, Descriptions, Button, Popconfirm, App } from 'antd';
import { useT } from '@/lib/i18n';
import { apiGetApplicationById, apiUpdateApplicationState } from '@/api/application';
import type { Application } from '@/api/application';

const { Title } = Typography;

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default function ApplicationDetailClient() {
  const t = useT();
  const router = useRouter();
  const { message } = App.useApp();
  const params = useParams();
  const appId = Number(params.id);
  const [rejecting, setRejecting] = useState(false);

  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appId) return;
    apiGetApplicationById(appId)
      .then(setApp)
      .finally(() => setLoading(false));
  }, [appId]);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Spin size="large" /></div>;
  }

  if (!app) return null;

  const emailAddr = app.user?.email ?? '';

  const handleReject = async () => {
    setRejecting(true);
    try {
      await apiUpdateApplicationState(app.id, 'rejected');
      router.back();
    } catch {
      message.error(t.common.update_failed);
    } finally {
      setRejecting(false);
    }
  };

  const formatDate = (val: string) => {
    const d = new Date(val);
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getFullYear()).slice(-2)}`;
  };

  return (
    <div className="p-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>{app.jobPost?.title ?? `Post #${app.jobPostId}`}</Title>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" href={`mailto:${emailAddr}`}>{t.post.contact}</Button>
          <Popconfirm title={t.post.reject_confirm} onConfirm={handleReject} okText={t.common.confirm} cancelText={t.common.cancel}>
            <Button type="primary" danger loading={rejecting}>{t.post.reject}</Button>
          </Popconfirm>
        </div>
      </div>

      <Descriptions column={2} bordered size="small" style={{ marginTop: 16, marginBottom: 16 }}>
        <Descriptions.Item label={t.post.applicant_email}>
          <a href={`mailto:${app.user?.email}`}>{app.user?.email}</a>
        </Descriptions.Item>
        <Descriptions.Item label={t.post.application_date}>{formatDate(app.createdAt)}</Descriptions.Item>
      </Descriptions>

      {app.answers.length > 0 && (
        <>
          <Title level={4} style={{ marginBottom: 12 }}>{t.post.questions_label}</Title>
          <Descriptions column={1} bordered size="small">
            {app.answers.map((a, i) => {
              const val = typeof a.value === 'string' ? a.value : String(a.value ?? '');
              return (
                <Descriptions.Item key={i} label={a.title}>
                  {val && val.startsWith('/api/upload/') ? (
                    <a href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}${val}`} download>
                      {a.title}
                    </a>
                  ) : isEmail(val) ? (
                    <a href={`mailto:${val}`}>{val}</a>
                  ) : (
                    val
                  )}
                </Descriptions.Item>
              );
            })}
          </Descriptions>
        </>
      )}
    </div>
  );
}

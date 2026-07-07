'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Empty, Spin, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useT } from '@/lib/i18n';
import { apiGetTemplatesByUser, type JobPostTemplate } from '@/api/job-post-template';
import { formatDate, checkPermissionCode } from '@/lib/utils';
import { useAppStore } from '@/lib/store';

export default function TemplateClient() {
  const t = useT();
  const router = useRouter();
  const currentUser = useAppStore((s) => s.currentUser);
  const userId = currentUser?.id;
  const [templates, setTemplates] = useState<JobPostTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const canEdit = checkPermissionCode('template-edit');

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    apiGetTemplatesByUser(userId)
      .then(setTemplates)
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div style={{ padding: 24, background: '#fff', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>{t.template.title}</h2>
        {canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push('/template/new')}>
            {t.template.add_new}
          </Button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : templates.length === 0 ? (
        <Empty description={t.template.no_templates} />
      ) : (
        <Row gutter={[16, 16]}>
          {templates.map((tpl) => (
            <Col key={tpl.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                title={tpl.templateName}
                hoverable
                extra={<span style={{ fontSize: 12, color: '#999' }}>{formatDate(tpl.createdAt)}</span>}
              >
                <p style={{ marginBottom: 4, color: '#666' }}>
                  {tpl.fields.length} {t.template.fields_count}
                </p>
                {tpl.fields.slice(0, 3).map((f, i) => (
                  <span
                    key={i}
                    style={{ display: 'inline-block', background: '#f0f5ff', color: '#1677ff', padding: '2px 8px', borderRadius: 4, marginRight: 4, marginBottom: 4, fontSize: 12 }}
                  >
                    {f.title}
                  </span>
                ))}
                {tpl.fields.length > 3 && (
                  <span style={{ fontSize: 12, color: '#999' }}>+{tpl.fields.length - 3}</span>
                )}
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <Button size="small" icon={<EyeOutlined />} onClick={() => router.push(`/template/view/${tpl.id}`)}>
                    {t.common.view}
                  </Button>
                  {canEdit && (
                    <Button size="small" icon={<EditOutlined />} onClick={() => router.push(`/template/edit/${tpl.id}`)}>
                      {t.common.edit}
                    </Button>
                  )}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}

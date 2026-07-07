'use client';

import { useEffect, useState } from 'react';
import { Modal, Card, Row, Col, Empty, Spin, Button, Space, Switch, App } from 'antd';
import { EyeOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useT } from '@/lib/i18n';
import { apiGetTemplatesByUser, type JobPostTemplate, type PostField } from '@/api/job-post-template';
import { useAppStore } from '@/lib/store';
import { formatDate } from '@/lib/utils';

interface ImportTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (fields: PostField[]) => void;
}

export default function ImportTemplateDialog({ open, onClose, onImport }: ImportTemplateDialogProps) {
  const t = useT();
  const userId = useAppStore((s) => s.currentUser?.id);
  const [templates, setTemplates] = useState<JobPostTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewTemplate, setViewTemplate] = useState<JobPostTemplate | null>(null);
  const { modal } = App.useApp();

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    apiGetTemplatesByUser(userId)
      .then(setTemplates)
      .finally(() => setLoading(false));
  }, [open, userId]);

  const handleImport = (tpl: JobPostTemplate) => {
    modal.confirm({
      title: t.post.import_confirm,
      icon: <ExclamationCircleOutlined />,
      onOk() {
        onImport(tpl.fields);
        onClose();
      },
    });
  };

  return (
    <>
      <Modal
        title={t.post.import_from_template}
        open={open}
        onCancel={onClose}
        footer={null}
        width={800}
        destroyOnHidden
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
        ) : templates.length === 0 ? (
          <Empty description={t.template.no_templates} />
        ) : (
          <Row gutter={[16, 16]}>
            {templates.map((tpl) => (
              <Col key={tpl.id} xs={24} sm={12} md={8}>
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
                    <Button size="small" icon={<EyeOutlined />} onClick={() => setViewTemplate(tpl)}>
                      {t.common.view}
                    </Button>
                    <Button size="small" type="primary" onClick={() => handleImport(tpl)}>
                      {t.post.import}
                    </Button>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Modal>

      <Modal
        title={viewTemplate?.templateName}
        open={!!viewTemplate}
        onCancel={() => setViewTemplate(null)}
        footer={null}
        width={700}
        destroyOnHidden
      >
        {viewTemplate && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {viewTemplate.fields.map((field, index) => (
              <Card key={index} size="small">
                <Space orientation="vertical" style={{ width: '100%' }} size={8}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ flex: 1, fontWeight: 500 }}>{field.title}</span>
                    <span style={{ fontSize: 12, color: '#999', background: '#f5f5f5', padding: '2px 8px', borderRadius: 4 }}>{field.type}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 12, color: '#666' }}>{t.template.required}</span>
                      <Switch size="small" checked={field.required} disabled />
                    </div>
                  </div>
                  {field.type === 'select' && (field.options?.length ?? 0) > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {field.options!.map((opt, i) => (
                        <span key={i} style={{ background: '#f0f5ff', color: '#1677ff', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{opt}</span>
                      ))}
                    </div>
                  )}
                </Space>
              </Card>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}

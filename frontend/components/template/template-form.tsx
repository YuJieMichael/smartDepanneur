'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Select, Switch, Spin, Card, Space, App } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useT } from '@/lib/i18n';
import {
  apiCreateTemplate,
  apiGetTemplateById,
  apiUpdateTemplate,
  type PostField,
} from '@/api/job-post-template';
import { useAppStore } from '@/lib/store';
import { FIELD_TYPES, DEFAULT_FIELDS, DEFAULT_FIELD_COUNT } from '@/lib/constants';

const STORAGE_KEY_BASE_CREATE = 'template_new_draft';
const STORAGE_KEY_BASE_EDIT = 'template_edit_draft';

export type TemplateFormMode = 'create' | 'edit' | 'view';

interface TemplateFormProps {
  mode: TemplateFormMode;
  templateId?: number;
}

export default function TemplateForm({ mode, templateId }: TemplateFormProps) {
  const t = useT();
  const router = useRouter();
  const { message } = App.useApp();
  const currentUser = useAppStore((s) => s.currentUser);
  const STORAGE_KEY_CREATE = `${STORAGE_KEY_BASE_CREATE}_${currentUser?.id}`;
  const STORAGE_KEY_EDIT = `${STORAGE_KEY_BASE_EDIT}_${currentUser?.id}`;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [fields, setFields] = useState<PostField[]>([...DEFAULT_FIELDS]);

  const isReadonly = mode === 'view';

  useEffect(() => {
    const promises: Promise<void>[] = [];

    // Load template data for edit/view
    if ((mode === 'edit' || mode === 'view') && templateId) {
      // For edit mode, check if sessionStorage has a matching draft
      if (mode === 'edit') {
        const saved = sessionStorage.getItem(STORAGE_KEY_EDIT);
        if (saved) {
          try {
            const draft = JSON.parse(saved);
            if (draft.templateId === templateId) {
              setTemplateName(draft.templateName || '');
              if (Array.isArray(draft.fields) && draft.fields.length >= DEFAULT_FIELD_COUNT) {
                setFields(draft.fields);
              }
              setLoading(false);
              return;
            }
          } catch { /* ignore */ }
        }
      }
      promises.push(
        apiGetTemplateById(templateId).then((tpl) => {
          setTemplateName(tpl.templateName);
          setFields(tpl.fields);
        }),
      );
    } else if (mode === 'create') {
      // Restore draft from sessionStorage
      const saved = sessionStorage.getItem(STORAGE_KEY_CREATE);
      if (saved) {
        try {
          const draft = JSON.parse(saved);
          setTemplateName(draft.templateName || '');
          if (Array.isArray(draft.fields) && draft.fields.length >= DEFAULT_FIELD_COUNT) {
            setFields(draft.fields);
          }
        } catch { /* ignore */ }
      }
    }

    Promise.all(promises).finally(() => setLoading(false));
  }, [mode, templateId, isReadonly]);

  const saveDraft = (name: string, flds: PostField[]) => {
    if (mode === 'create') {
      sessionStorage.setItem(STORAGE_KEY_CREATE, JSON.stringify({ templateName: name, fields: flds }));
    } else if (mode === 'edit' && templateId) {
      sessionStorage.setItem(STORAGE_KEY_EDIT, JSON.stringify({ templateId, templateName: name, fields: flds }));
    }
  };

  const handleNameChange = (value: string) => {
    setTemplateName(value);
    saveDraft(value, fields);
  };

  const updateField = (index: number, patch: Partial<PostField>) => {
    const updated = fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    if (patch.type && patch.type !== 'select') {
      updated[index] = { ...updated[index], options: undefined };
    }
    setFields(updated);
    saveDraft(templateName, updated);
  };

  const addField = () => {
    const updated = [...fields, { title: '', type: 'text' as const, required: false }];
    setFields(updated);
    saveDraft(templateName, updated);
  };

  const removeField = (index: number) => {
    const updated = fields.filter((_, i) => i !== index);
    setFields(updated);
    saveDraft(templateName, updated);
  };

  const handleSubmit = async () => {
    if (!templateName.trim()) {
      message.error(t.template.name_required);
      return;
    }
    if (fields.length === 0) {
      message.error(t.template.fields_required);
      return;
    }
    if (fields.some((f) => !f.title.trim())) {
      message.error(t.template.field_title_required);
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'create') {
        await apiCreateTemplate({ templateName: templateName.trim(), fields });
        sessionStorage.removeItem(STORAGE_KEY_CREATE);
        message.success(t.common.create_success);
      } else if (mode === 'edit' && templateId) {
        await apiUpdateTemplate(templateId, { templateName: templateName.trim(), fields });
        sessionStorage.removeItem(STORAGE_KEY_EDIT);
        message.success(t.template.update_success);
      }
      router.push('/template/edit');
    } catch {
      message.error(mode === 'create' ? t.common.create_failed : t.template.update_failed);
    } finally {
      setSubmitting(false);
    }
  };

  const titleMap = {
    create: t.template.create_title,
    edit: t.template.edit_title,
    view: t.template.view_title,
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ padding: 24, background: '#fff', minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => router.back()} />
        <h2 style={{ margin: 0, marginLeft: 8 }}>{titleMap[mode]}</h2>
      </div>

      <div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>{t.template.template_name}</label>
          <Input
            value={templateName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={t.template.template_name_placeholder}
            style={{ maxWidth: 400 }}
            disabled={isReadonly}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 500 }}>{t.template.fields_label}</label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {fields.map((field, index) => {
            const isDefault = index < DEFAULT_FIELD_COUNT;
            const fieldDisabled = isReadonly || isDefault;
            return (
              <Card key={index} size="small">
                <Space orientation="vertical" style={{ width: '100%' }} size={8}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Input
                      style={{ flex: 1 }}
                      value={field.title}
                      onChange={(e) => updateField(index, { title: e.target.value })}
                      placeholder={t.template.field_title_placeholder}
                      disabled={fieldDisabled}
                    />
                    <Select
                      style={{ width: 130 }}
                      value={field.type}
                      options={FIELD_TYPES.map((ft) => ({ ...ft }))}
                      onChange={(val) => updateField(index, { type: val })}
                      disabled={fieldDisabled}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 12, color: '#666' }}>{t.template.required}</span>
                      <Switch
                        size="small"
                        checked={field.required}
                        onChange={(checked) => updateField(index, { required: checked })}
                        disabled={fieldDisabled}
                      />
                    </div>
                    {!isReadonly && !isDefault && (
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => removeField(index)}
                      />
                    )}
                  </div>
                  {field.type === 'select' && !isReadonly && !isDefault && (
                    <Select
                      style={{ width: '100%' }}
                      mode="tags"
                      value={field.options || []}
                      onChange={(val) => updateField(index, { options: val })}
                      placeholder={t.template.enter_options}
                      tokenSeparators={[',']}
                    />
                  )}
                  {field.type === 'select' && isReadonly && (field.options?.length ?? 0) > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {field.options!.map((opt, i) => (
                        <span key={i} style={{ background: '#f0f5ff', color: '#1677ff', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{opt}</span>
                      ))}
                    </div>
                  )}
                </Space>
              </Card>
            );
          })}
        </div>

        {!isReadonly && (
          <Button type="dashed" block icon={<PlusOutlined />} onClick={addField} style={{ marginBottom: 24, marginTop: 12 }}>
            {t.template.add_field}
          </Button>
        )}

        {!isReadonly && (
          <Space style={{ marginTop: isReadonly ? 24 : 0 }}>
            <Button type="primary" onClick={handleSubmit} loading={submitting}>
              {mode === 'create' ? t.common.create : t.common.save}
            </Button>
            <Button onClick={() => router.back()}>
              {t.common.cancel}
            </Button>
          </Space>
        )}
      </div>
    </div>
  );
}

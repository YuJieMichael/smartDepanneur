'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Select, Switch, Card, Space, App } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined, ImportOutlined } from '@ant-design/icons';
import { useT } from '@/lib/i18n';
import { apiCreateJobPost } from '@/api/job-post';
import type { PostField } from '@/api/job-post-template';
import ImportTemplateDialog from '@/components/common/import-template-dialog';
import { useAppStore } from '@/lib/store';
import { FIELD_TYPES, DEFAULT_FIELDS, DEFAULT_FIELD_COUNT } from '@/lib/constants';

const STORAGE_KEY_BASE = 'post_new_draft';

export default function PostNewClient() {
  const t = useT();
  const router = useRouter();
  const { message } = App.useApp();
  const currentUser = useAppStore((s) => s.currentUser);
  const STORAGE_KEY = `${STORAGE_KEY_BASE}_${currentUser?.id}`;

  // Restore draft
  const draft = (() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  })();

  const [title, setTitle] = useState<string>(draft?.title || '');
  const [jobDescription, setJobDescription] = useState<string>(draft?.jobDescription || '');
  const [reviewer, setReviewer] = useState<string>(draft?.reviewer || '');
  const [questions, setQuestions] = useState<PostField[]>(
    Array.isArray(draft?.questions) && draft.questions.length >= DEFAULT_FIELD_COUNT
      ? draft.questions
      : [...DEFAULT_FIELDS],
  );
  const [submitting, setSubmitting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const handleImport = (fields: PostField[]) => {
    // Keep default fields, append all non-default fields from the template
    const customFields = fields.filter((_, i) => i >= DEFAULT_FIELD_COUNT);
    const imported = [...DEFAULT_FIELDS, ...customFields];
    setQuestions(imported);
    saveDraft(title, jobDescription, imported);
  };

  const saveDraft = (t: string, jd: string, q: PostField[], r?: string) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ title: t, jobDescription: jd, questions: q, reviewer: r ?? reviewer }));
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    saveDraft(value, jobDescription, questions);
  };

  const handleDescriptionChange = (value: string) => {
    setJobDescription(value);
    saveDraft(title, value, questions);
  };

  const handleReviewerChange = (value: string) => {
    setReviewer(value);
    saveDraft(title, jobDescription, questions, value);
  };

  const updateQuestion = (index: number, patch: Partial<PostField>) => {
    const updated = questions.map((q, i) => (i === index ? { ...q, ...patch } : q));
    if (patch.type && patch.type !== 'select') {
      updated[index] = { ...updated[index], options: undefined };
    }
    setQuestions(updated);
    saveDraft(title, jobDescription, updated);
  };

  const addQuestion = () => {
    const updated = [...questions, { title: '', type: 'text' as const, required: false }];
    setQuestions(updated);
    saveDraft(title, jobDescription, updated);
  };

  const removeQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
    saveDraft(title, jobDescription, updated);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      message.error(t.post.title_required);
      return;
    }
    if (!jobDescription.trim()) {
      message.error(t.post.description_required);
      return;
    }
    if (questions.length === 0) {
      message.error(t.post.questions_required);
      return;
    }
    if (questions.some((q) => !q.title.trim())) {
      message.error(t.post.question_title_required);
      return;
    }
    setSubmitting(true);
    try {
      await apiCreateJobPost({
        title: title.trim(),
        jobDescription: jobDescription.trim(),
        questions,
        reviewer: reviewer.trim(),
      });
      sessionStorage.removeItem(STORAGE_KEY);
      message.success(t.common.create_success);
      router.push('/');
    } catch {
      message.error(t.common.create_failed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 24, background: '#fff', minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => router.back()} />
        <h2 style={{ margin: 0, marginLeft: 8 }}>{t.post.create_title}</h2>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>{t.post.title}</label>
        <Input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder={t.post.title_placeholder}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>{t.post.job_description}</label>
        <Input.TextArea
          value={jobDescription}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder={t.post.description_placeholder}
          rows={4}
        />
      </div>

      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontWeight: 500 }}>{t.post.questions_label}</label>
        <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>
          {t.post.import_from_template}
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {questions.map((q, index) => {
          const isDefault = index < DEFAULT_FIELD_COUNT;
          return (
          <Card key={index} size="small">
            <Space orientation="vertical" style={{ width: '100%' }} size={8}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Input
                  style={{ flex: 1 }}
                  value={q.title}
                  onChange={(e) => updateQuestion(index, { title: e.target.value })}
                  placeholder={t.post.question_title_placeholder}
                  disabled={isDefault}
                />
                <Select
                  style={{ width: 130 }}
                  value={q.type}
                  options={FIELD_TYPES.map((ft) => ({ ...ft }))}
                  onChange={(val) => updateQuestion(index, { type: val })}
                  disabled={isDefault}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 12, color: '#666' }}>{t.template.required}</span>
                  <Switch
                    size="small"
                    checked={q.required}
                    onChange={(checked) => updateQuestion(index, { required: checked })}
                    disabled={isDefault}
                  />
                </div>
                {!isDefault && (
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeQuestion(index)}
                />
                )}
              </div>
              {q.type === 'select' && !isDefault && (
                <Select
                  style={{ width: '100%' }}
                  mode="tags"
                  value={q.options || []}
                  onChange={(val) => updateQuestion(index, { options: val })}
                  placeholder={t.template.enter_options}
                  tokenSeparators={[',']}
                />
              )}
            </Space>
          </Card>
          );
        })}
      </div>

      <Button type="dashed" block icon={<PlusOutlined />} onClick={addQuestion} style={{ marginBottom: 24, marginTop: 12 }}>
        {t.post.add_question}
      </Button>

      <Space>
        <Button type="primary" onClick={handleSubmit} loading={submitting}>
          {t.common.create}
        </Button>
        <Button onClick={() => router.back()}>
          {t.common.cancel}
        </Button>
      </Space>

      <ImportTemplateDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
      />
    </div>
  );
}

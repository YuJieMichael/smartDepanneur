'use client';

import { useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, Upload, Progress, Button, App } from 'antd';
import { UploadOutlined, PaperClipOutlined } from '@ant-design/icons';
import { useT } from '@/lib/i18n';
import type { ApplicantInformation } from '@/api/applicant-info';
import { apiCreateApplication, apiCheckApplication } from '@/api/application';
import type { JobPost } from '@/api/job-post';
import type { PostField } from '@/api/job-post-template';
import { uploadFile } from '@/lib/upload';
import { loadStateOptions as fetchStateOptions } from '@/lib/dictionary-utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const DEFAULT_FIELD_KEYS: Record<string, keyof ApplicantInformation> = {
  Email: 'email',
  Phone: 'phone',
  Nickname: 'nickname',
  Country: 'country',
  State: 'state',
  Address: 'address',
  Postcode: 'postcode',
  Resume: 'resume',
};

interface ApplyModalProps {
  open: boolean;
  detail: JobPost | null;
  applicantInfo: ApplicantInformation | null;
  countryOptions: { label: string; value: string }[];
  onClose: () => void;
  onApplySuccess: (postId: number) => void;
}

export default function ApplyModal({ open, detail, applicantInfo, countryOptions, onClose, onApplySuccess }: ApplyModalProps) {
  const t = useT();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stateOptions, setStateOptions] = useState<{ label: string; value: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [resumeName, setResumeName] = useState('');

  const questions: PostField[] = (detail?.questions as PostField[]) ?? [];

  const loadStateOptions = async (countryName: string) => {
    setStateOptions(await fetchStateOptions(countryName));
  };

  const handleCountryChange = (value: string, stateFieldName: string) => {
    form.setFieldValue(stateFieldName, undefined);
    loadStateOptions(value);
  };

  const handleUpload = (file: File, fieldName: string) => {
    setUploading(true);
    setUploadPercent(0);
    uploadFile(file, setUploadPercent)
      .then((res) => {
        form.setFieldValue(fieldName, res.url);
        setResumeName(res.originalname);
        message.success(t.applicant.upload_success);
      })
      .catch(() => message.error(t.applicant.upload_failed))
      .finally(() => setUploading(false));
    return false;
  };

  const handleOpen = async () => {
    if (!detail) return;
    form.resetFields();
    setAlreadyApplied(false);
    if (applicantInfo) {
      const initialValues: Record<string, string> = {};
      questions.forEach((q, i) => {
        const key = DEFAULT_FIELD_KEYS[q.title];
        if (key && applicantInfo[key] != null) {
          initialValues[`q_${i}`] = String(applicantInfo[key]);
        }
      });
      form.setFieldsValue(initialValues);
      if (applicantInfo.country) loadStateOptions(applicantInfo.country);
      if (applicantInfo.resume) setResumeName(applicantInfo.resume.split('/').pop() || '');
    }
    const res = await apiCheckApplication(detail.id);
    setAlreadyApplied(res.applied);
  };

  const handleSubmit = async () => {
    if (!detail) return;
    let values: Record<string, any>;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const answers = questions.map((q, i) => ({
      title: q.title,
      value: values[`q_${i}`] ?? '',
    }));
    setSubmitting(true);
    try {
      await apiCreateApplication({ jobPostId: detail.id, answers });
      message.success(t.applicant.apply_success);
      onClose();
      onApplySuccess(detail.id);
    } catch {
      message.error(t.applicant.apply_failed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={`${t.applicant.apply} - ${detail?.title ?? ''}`}
      open={open}
      onCancel={onClose}
      footer={null}
      forceRender
      width={900}
      style={{ top: 40 }}
      afterOpenChange={(visible) => { if (visible) handleOpen(); }}
    >
      {alreadyApplied ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
          {t.applicant.already_applied}
        </div>
      ) : (
        <>
          <Form form={form} layout="vertical" style={{ maxHeight: 700, overflowY: 'auto' }}>
            {questions.map((q, i) => {
              const fieldName = `q_${i}`;
              const isCountry = q.title === 'Country';
              const isState = q.title === 'State';
              const isFile = q.type === 'file';
              const isSelect = q.type === 'select';

              if (isFile) {
                const resumeValue = form.getFieldValue(fieldName);
                return (
                  <Form.Item
                    key={i}
                    label={q.title}
                    name={fieldName}
                    rules={q.required ? [{ required: true, message: `${q.title} is required` }] : []}
                  >
                    <div>
                      <Upload
                        beforeUpload={(file) => handleUpload(file as unknown as File, fieldName)}
                        showUploadList={false}
                        maxCount={1}
                        accept=".pdf,.doc,.docx"
                      >
                        <Button icon={<UploadOutlined />} loading={uploading}>{t.applicant.upload_resume}</Button>
                      </Upload>
                      {uploading && <Progress percent={uploadPercent} size="small" style={{ marginTop: 8 }} />}
                      {resumeValue && !uploading && (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <a href={`${API_URL}${resumeValue}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <PaperClipOutlined />{resumeName || 'Download'}
                          </a>
                        </div>
                      )}
                    </div>
                  </Form.Item>
                );
              }

              return (
                <Form.Item
                  key={i}
                  label={q.title}
                  name={fieldName}
                  rules={q.required ? [{ required: true, message: `${q.title} is required` }] : []}
                >
                  {q.type === 'textarea' ? (
                    <Input.TextArea rows={3} />
                  ) : q.type === 'number' ? (
                    <InputNumber style={{ width: '100%' }} />
                  ) : isSelect ? (
                    <Select
                      options={isCountry ? countryOptions : isState ? stateOptions : q.options?.map((o) => ({ label: o, value: o }))}
                      showSearch
                      allowClear
                      onChange={isCountry ? (val) => {
                        const stateIdx = questions.findIndex((qq) => qq.title === 'State');
                        if (stateIdx >= 0) handleCountryChange(val, `q_${stateIdx}`);
                      } : undefined}
                    />
                  ) : (
                    <Input />
                  )}
                </Form.Item>
              );
            })}
          </Form>
          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              {t.applicant.submit_application}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

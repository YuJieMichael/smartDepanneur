'use client';

import { Input, Select, Upload, Button, Progress } from 'antd';
import { UploadOutlined, PaperClipOutlined } from '@ant-design/icons';
import { useT } from '@/lib/i18n';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface FormData {
  email: string;
  phone: string;
  nickname: string;
  country: string;
  state: string;
  address: string;
  postcode: string;
  resume: string;
}

interface ApplicantInfoFormProps {
  form: FormData;
  onChange: (field: keyof FormData, value: string) => void;
  countryOptions: { label: string; value: string }[];
  stateOptions: { label: string; value: string }[];
  resumeName: string;
  uploading: boolean;
  uploadPercent: number;
  onUpload: (file: File) => false;
  onRemoveResume?: () => void;
}

export type { FormData as ApplicantFormData };

export default function ApplicantInfoForm({
  form,
  onChange,
  countryOptions,
  stateOptions,
  resumeName,
  uploading,
  uploadPercent,
  onUpload,
  onRemoveResume,
}: ApplicantInfoFormProps) {
  const t = useT();
  const labelStyle = { display: 'block', marginBottom: 4, fontWeight: 500 } as const;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px 24px' }}>
        <div>
          <label style={labelStyle}>{t.applicant.email}</label>
          <Input value={form.email} onChange={(e) => onChange('email', e.target.value)} placeholder={t.applicant.email_placeholder} />
        </div>
        <div>
          <label style={labelStyle}>{t.applicant.phone}</label>
          <Input value={form.phone} onChange={(e) => onChange('phone', e.target.value)} placeholder={t.applicant.phone_placeholder} />
        </div>
        <div>
          <label style={labelStyle}>{t.applicant.nickname}</label>
          <Input value={form.nickname} onChange={(e) => onChange('nickname', e.target.value)} placeholder={t.applicant.nickname_placeholder} />
        </div>
        <div>
          <label style={labelStyle}>{t.applicant.country}</label>
          <Select style={{ width: '100%' }} value={form.country || undefined} onChange={(val) => onChange('country', val)} placeholder={t.applicant.country_placeholder} options={countryOptions} showSearch allowClear />
        </div>
        <div>
          <label style={labelStyle}>{t.applicant.state}</label>
          <Select style={{ width: '100%' }} value={form.state || undefined} onChange={(val) => onChange('state', val)} placeholder={t.applicant.state_placeholder} options={stateOptions} showSearch allowClear />
        </div>
        <div>
          <label style={labelStyle}>{t.applicant.address}</label>
          <Input value={form.address} onChange={(e) => onChange('address', e.target.value)} placeholder={t.applicant.address_placeholder} />
        </div>
        <div>
          <label style={labelStyle}>{t.applicant.postcode}</label>
          <Input value={form.postcode} onChange={(e) => onChange('postcode', e.target.value)} placeholder={t.applicant.postcode_placeholder} />
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <label style={labelStyle}>{t.applicant.resume}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Upload beforeUpload={onUpload} showUploadList={false} maxCount={1} accept=".pdf,.doc,.docx">
            <Button icon={<UploadOutlined />} loading={uploading}>{t.applicant.upload_resume}</Button>
          </Upload>
          {uploading && <Progress percent={uploadPercent} size="small" style={{ flex: 1 }} />}
          {form.resume && !uploading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <a href={`${API_URL}${form.resume}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <PaperClipOutlined />{resumeName || 'Download'}
              </a>
              {onRemoveResume && (
                <Button type="text" danger size="small" onClick={onRemoveResume}>{t.common.cancel}</Button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

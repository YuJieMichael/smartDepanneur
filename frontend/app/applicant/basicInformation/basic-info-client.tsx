'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, App, Spin } from 'antd';
import { useT } from '@/lib/i18n';
import { apiGetMyApplicantInfo, apiCreateApplicantInfo, apiUpdateApplicantInfo } from '@/api/applicant-info';
import { apiGetDictionaryByKey } from '@/api/dictionary';
import { useAppStore } from '@/lib/store';
import { uploadFile } from '@/lib/upload';
import { loadStateOptions as fetchStateOptions } from '@/lib/dictionary-utils';
import ApplicantInfoForm from '@/components/common/applicant-info-form';
import type { ApplicantFormData } from '@/components/common/applicant-info-form';

const STORAGE_KEY_BASE = 'applicant_basic_info_draft';

const EMPTY: ApplicantFormData = { email: '', phone: '', nickname: '', country: '', state: '', address: '', postcode: '', resume: '' };

export default function BasicInfoClient() {
  const t = useT();
  const router = useRouter();
  const { message } = App.useApp();
  const currentUser = useAppStore((s) => s.currentUser);
  const STORAGE_KEY = `${STORAGE_KEY_BASE}_${currentUser?.id}`;

  const [loading, setLoading] = useState(true);
  const [isEdit, setIsEdit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<ApplicantFormData>({ ...EMPTY });
  const [resumeName, setResumeName] = useState('');
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [countryOptions, setCountryOptions] = useState<{ label: string; value: string }[]>([]);
  const [stateOptions, setStateOptions] = useState<{ label: string; value: string }[]>([]);

  const loadStateOptions = async (countryName: string) => {
    setStateOptions(await fetchStateOptions(countryName));
  };

  useEffect(() => {
    const loadDict = async () => {
      const countryDict = await apiGetDictionaryByKey('country').catch(() => null);
      if (countryDict) setCountryOptions(countryDict.value.map((v) => ({ label: v, value: v })));
    };

    const loadInfo = async () => {
      const info = await apiGetMyApplicantInfo();
      if (info) {
        setIsEdit(true);
        const data: ApplicantFormData = {
          email: info.email, phone: info.phone, nickname: info.nickname,
          country: info.country, state: info.state, address: info.address,
          postcode: info.postcode, resume: info.resume,
        };
        setForm(data);
        if (info.resume) setResumeName(info.resume.split('/').pop() || '');
        if (info.country) await loadStateOptions(info.country);
      } else {
        try {
          const saved = sessionStorage.getItem(STORAGE_KEY);
          if (saved) {
            const draft = JSON.parse(saved);
            const data: ApplicantFormData = {
              email: draft.email || '', phone: draft.phone || '', nickname: draft.nickname || '',
              country: draft.country || '', state: draft.state || '', address: draft.address || '',
              postcode: draft.postcode || '', resume: draft.resume || '',
            };
            setForm(data);
            if (draft.resumeName) setResumeName(draft.resumeName);
            if (draft.country) await loadStateOptions(draft.country);
          }
        } catch { /* ignore */ }
      }
    };

    Promise.all([loadDict(), loadInfo()]).then(() => setLoading(false));
  }, []);

  const saveDraft = (data: ApplicantFormData) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, resumeName }));
  };

  const handleChange = (field: keyof ApplicantFormData, value: string) => {
    const updated = { ...form, [field]: value };
    if (field === 'country') {
      updated.state = '';
      loadStateOptions(value);
    }
    setForm(updated);
    if (!isEdit) saveDraft(updated);
  };

  const handleUpload = (file: File) => {
    setUploading(true);
    setUploadPercent(0);
    uploadFile(file, setUploadPercent)
      .then((res) => {
        const updated = { ...form, resume: res.url };
        setForm(updated);
        setResumeName(res.originalname);
        if (!isEdit) saveDraft(updated);
        message.success(t.applicant.upload_success);
      })
      .catch(() => message.error(t.applicant.upload_failed))
      .finally(() => setUploading(false));
    return false as const;
  };

  const handleRemoveResume = () => {
    const updated = { ...form, resume: '' };
    setForm(updated);
    setResumeName('');
    if (!isEdit) saveDraft(updated);
  };

  const handleSubmit = async () => {
    const requiredFields = ['email', 'phone', 'nickname', 'country', 'state', 'address', 'postcode'] as const;
    for (const f of requiredFields) {
      if (!form[f].trim()) {
        message.error(t.applicant[`${f}_required` as keyof typeof t.applicant] as string);
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        await apiUpdateApplicantInfo(form);
      } else {
        await apiCreateApplicantInfo(form);
        sessionStorage.removeItem(STORAGE_KEY);
      }
      message.success(isEdit ? t.applicant.update_success : t.common.create_success);
      router.push('/');
    } catch {
      message.error(t.common.create_failed);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }}><Spin /></div>;
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', minHeight: '100%', background: '#fff', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 800 }}>
        <h1 style={{ textAlign: 'center', marginBottom: 32, fontSize: 28 }}>Please fill your basic information to start</h1>

        <ApplicantInfoForm
          form={form}
          onChange={handleChange}
          countryOptions={countryOptions}
          stateOptions={stateOptions}
          resumeName={resumeName}
          uploading={uploading}
          uploadPercent={uploadPercent}
          onUpload={handleUpload}
          onRemoveResume={handleRemoveResume}
        />

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Button type="primary" onClick={handleSubmit} loading={submitting}>
            {t.common.save}
          </Button>
        </div>
      </div>
    </div>
  );
}

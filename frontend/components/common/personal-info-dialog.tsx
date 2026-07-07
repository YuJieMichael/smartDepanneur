'use client';

import { useState, useEffect, useRef } from 'react';
import { Modal, Button, Spin, App } from 'antd';
import { useT } from '@/lib/i18n';
import { apiGetMyApplicantInfo, apiCreateApplicantInfo, apiUpdateApplicantInfo } from '@/api/applicant-info';
import { apiGetDictionaryByKey } from '@/api/dictionary';
import { uploadFile } from '@/lib/upload';
import { loadStateOptions as fetchStateOptions } from '@/lib/dictionary-utils';
import ApplicantInfoForm from './applicant-info-form';
import type { ApplicantFormData } from './applicant-info-form';

interface Props {
  open: boolean;
  onClose: () => void;
}

const EMPTY: ApplicantFormData = { email: '', phone: '', nickname: '', country: '', state: '', address: '', postcode: '', resume: '' };

export default function PersonalInfoDialog({ open, onClose }: Props) {
  const t = useT();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [isEdit, setIsEdit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<ApplicantFormData>({ ...EMPTY });
  const [resumeName, setResumeName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [countryOptions, setCountryOptions] = useState<{ label: string; value: string }[]>([]);
  const [stateOptions, setStateOptions] = useState<{ label: string; value: string }[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const originalRef = useRef<ApplicantFormData>({ ...EMPTY });

  const loadStateOptions = async (countryName: string) => {
    setStateOptions(await fetchStateOptions(countryName));
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setHasChanges(false);

    const load = async () => {
      const countryDict = await apiGetDictionaryByKey('country').catch(() => null);
      if (countryDict) setCountryOptions(countryDict.value.map((v) => ({ label: v, value: v })));

      const info = await apiGetMyApplicantInfo();
      if (info) {
        setIsEdit(true);
        const data: ApplicantFormData = {
          email: info.email, phone: info.phone, nickname: info.nickname,
          country: info.country, state: info.state, address: info.address,
          postcode: info.postcode, resume: info.resume,
        };
        setForm(data);
        originalRef.current = { ...data };
        if (info.resume) setResumeName(info.resume.split('/').pop() || '');
        if (info.country) await loadStateOptions(info.country);
      } else {
        setIsEdit(false);
        setForm({ ...EMPTY });
        originalRef.current = { ...EMPTY };
        setResumeName('');
        setStateOptions([]);
      }
      setLoading(false);
    };
    load();
  }, [open]);

  const checkChanges = (updated: ApplicantFormData) => {
    const orig = originalRef.current;
    setHasChanges(Object.keys(orig).some((k) => orig[k as keyof ApplicantFormData] !== updated[k as keyof ApplicantFormData]));
  };

  const handleChange = (field: keyof ApplicantFormData, value: string) => {
    const updated = { ...form, [field]: value };
    if (field === 'country') {
      updated.state = '';
      loadStateOptions(value);
    }
    setForm(updated);
    checkChanges(updated);
  };

  const handleUpload = (file: File) => {
    setUploading(true);
    setUploadPercent(0);
    uploadFile(file, setUploadPercent)
      .then((res) => {
        const updated = { ...form, resume: res.url };
        setForm(updated);
        setResumeName(res.originalname);
        checkChanges(updated);
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
    checkChanges(updated);
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
        setIsEdit(true);
      }
      originalRef.current = { ...form };
      setHasChanges(false);
      message.success(isEdit ? t.applicant.update_success : t.common.create_success);
    } catch {
      message.error(t.common.create_failed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={t.applicant.personal_info}
      open={open}
      onCancel={onClose}
      width={700}
      footer={hasChanges ? (
        <Button type="primary" onClick={handleSubmit} loading={submitting}>{t.common.save}</Button>
      ) : null}
      destroyOnHidden
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spin /></div>
      ) : (
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
      )}
    </Modal>
  );
}

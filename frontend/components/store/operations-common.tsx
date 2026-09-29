'use client';
import { useRef } from 'react';
import { Alert } from 'antd';
import { useI18nStore } from '@/lib/i18n';
export function useOpsText() {
  const locale = useI18nStore((s) => s.locale);
  return (en: string, fr: string, zh: string) =>
    locale === 'zh' ? zh : locale === 'fr' ? fr : en;
}
export function useRequestId() {
  const pending = useRef({ payload: '', id: '' });
  return (payload: unknown) => {
    const signature = JSON.stringify(payload);
    if (signature !== pending.current.payload)
      pending.current = { payload: signature, id: crypto.randomUUID() };
    return pending.current.id;
  };
}
export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
export function OpsError({ error }: { error: string }) {
  return error ? (
    <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />
  ) : null;
}
export function downloadText(
  name: string,
  text: string,
  type = 'text/csv;charset=utf-8',
) {
  const url = URL.createObjectURL(new Blob(['\uFEFF', text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csvCell(value: unknown) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}

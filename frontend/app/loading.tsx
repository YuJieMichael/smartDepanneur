'use client';

import { useT } from '@/lib/i18n';

export default function Loading() {
  const t = useT();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-400 text-sm">{t.common.loading}</span>
      </div>
    </div>
  );
}

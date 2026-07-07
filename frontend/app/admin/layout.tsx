'use client';

import { Result } from 'antd';
import { checkPermissionCode } from '@/lib/utils';
import { useT } from '@/lib/i18n';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useT();

  if (!checkPermissionCode('view-admin')) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 64px)' }}>
        <Result status="403" title="403" subTitle={t.common.no_permission} />
      </div>
    );
  }

  return <>{children}</>;
}

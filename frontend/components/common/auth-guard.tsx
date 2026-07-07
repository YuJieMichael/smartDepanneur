'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { fetchCurrentUser, logout } from '@/api/auth';

const PUBLIC_PATHS = ['/login', '/register'];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentUser = useAppStore((s) => s.currentUser);

  useEffect(() => {
    // 公开页面，跳过鉴权
    if (PUBLIC_PATHS.includes(pathname)) return;

    if (currentUser) return;

    const token = sessionStorage.getItem('access_token');
    if (!token) {
      logout();
      return;
    }

    fetchCurrentUser().then((user) => {
      if (!user) logout();
    });
  }, [currentUser, pathname]);

  // 公开页面直接渲染，不等 currentUser
  if (PUBLIC_PATHS.includes(pathname)) return <>{children}</>;

  if (!currentUser) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  return <>{children}</>;
}

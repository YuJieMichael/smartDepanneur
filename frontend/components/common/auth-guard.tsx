'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { fetchCurrentUser, logout } from '@/api/auth';
import { DEMO_MODE, DEMO_ROUTES, appPath, AUTH_STORAGE_KEY } from '@/lib/demo/config';

const PUBLIC_PATHS = ['/login', '/register'];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = appPath(usePathname());
  const router = useRouter();
  const currentUser = useAppStore((s) => s.currentUser);
  const isCashierOnly =
    currentUser?.roles.some((role) => role.name === 'Cashier') &&
    !currentUser.roles.some(
      (role) => role.name === 'Admin' || role.name === 'Store Owner',
    );
  const cashierCanAccessPath = pathname === '/sales';

  useEffect(() => {
    // 公开页面，跳过鉴权
    if (PUBLIC_PATHS.includes(pathname)) return;

    if (currentUser) {
      if (DEMO_MODE && !DEMO_ROUTES.includes(pathname)) {
        router.replace('/');
        return;
      }
      if (isCashierOnly && !cashierCanAccessPath) {
        router.replace('/sales');
      }
      return;
    }

    const token = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!token) {
      logout();
      return;
    }

    fetchCurrentUser().then((user) => {
      if (!user) logout();
    });
  }, [cashierCanAccessPath, currentUser, isCashierOnly, pathname, router]);

  // 公开页面直接渲染，不等 currentUser
  if (PUBLIC_PATHS.includes(pathname)) return <>{children}</>;

  if (!currentUser || (isCashierOnly && !cashierCanAccessPath)) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  return <>{children}</>;
}

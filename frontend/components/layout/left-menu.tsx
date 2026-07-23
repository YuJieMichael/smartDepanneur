'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Tour } from 'antd';
import { HomeOutlined, ShopOutlined, TeamOutlined } from '@ant-design/icons';
import { useAppStore } from '@/lib/store';
import { useI18nStore, useT } from '@/lib/i18n';

const NO_MENU_PATHS = ['/login', '/register'];
const TOUR_KEY = 'SmartDepanneur_tour_seen_admin';

export default function LeftMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const locale = useI18nStore((state) => state.locale);
  const currentUser = useAppStore((s) => s.currentUser);

  const isAdmin = currentUser?.roles.some((r) => r.name === 'Admin') ?? false;

  const menuRef = useRef<HTMLElement>(null);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    if (isAdmin && pathname.startsWith('/admin/') && !localStorage.getItem(TOUR_KEY)) {
      const timer = setTimeout(() => setTourOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [isAdmin, pathname]);

  if (NO_MENU_PATHS.includes(pathname) || !isAdmin) return null;

  const items = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: t.nav.main,
    },
    {
      key: 'user-management',
      icon: <TeamOutlined />,
      label: t.nav.user_management,
      children: [
        { key: '/admin/users', label: t.nav.users },
        { key: '/admin/roles', label: t.nav.roles },
        { key: '/admin/permissions', label: t.nav.permissions },
        { key: '/admin/dictionary', label: t.nav.dictionary },
      ],
    },
    {
      key: 'store-management',
      icon: <ShopOutlined />,
      label: t.nav.store_management,
      children: [
        { key: '/dashboard', label: 'Dashboard' },
        { key: '/sales', label: 'New Sale' },
        { key: '/products', label: t.nav.products },
        { key: '/categories', label: t.nav.categories },
        { key: '/suppliers', label: t.nav.suppliers },
        { key: '/inventory', label: t.nav.inventory },
        {
          key: '/insights',
          label:
            locale === 'zh'
              ? '门店 Agent'
              : locale === 'fr'
                ? 'Agent du magasin'
                : 'Store Agent',
        },
      ],
    },
  ];

  const openKeys = pathname.startsWith('/admin/') ? ['user-management'] :
    ['/dashboard', '/sales', '/products', '/categories', '/suppliers', '/inventory', '/insights'].some((p) => pathname.startsWith(p)) ? ['store-management'] : [];

  return (
    <aside ref={menuRef} className="w-52 min-h-[calc(100vh-56px)] border-r border-gray-200 bg-white shrink-0 pt-3">
      <Menu
        mode="inline"
        selectedKeys={[pathname]}
        defaultOpenKeys={openKeys}
        items={items}
        onClick={({ key }) => router.push(key)}
        className="h-full border-r-0"
        style={{ paddingInline: 6 }}
      />
      <Tour
        open={tourOpen}
        onClose={() => {
          setTourOpen(false);
          localStorage.setItem(TOUR_KEY, '1');
        }}
        steps={[
          {
            title: t.tour.perm_flow_title,
            description: t.tour.perm_flow_intro,
            target: () => menuRef.current!,
          },
          {
            title: t.nav.users,
            description: t.tour.perm_flow_users,
            target: () => menuRef.current!,
          },
          {
            title: t.nav.roles,
            description: t.tour.perm_flow_roles,
            target: () => menuRef.current!,
          },
          {
            title: t.nav.permissions,
            description: t.tour.perm_flow_permissions,
            target: () => menuRef.current!,
          },
          {
            title: t.nav.dictionary,
            description: t.tour.perm_flow_dictionary,
            target: () => menuRef.current!,
          },
          {
            title: t.tour.perm_flow_title,
            description: t.tour.perm_flow_audit,
            target: () => menuRef.current!,
          },
        ]}
      />
    </aside>
  );
}

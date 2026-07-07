'use client';

import { usePathname } from 'next/navigation';
import { Breadcrumb } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import { useT } from '@/lib/i18n';

const NO_BREADCRUMB_PATHS = ['/login', '/register', '/'];

export default function AppBreadcrumb() {
  const pathname = usePathname();
  const t = useT();

  if (NO_BREADCRUMB_PATHS.includes(pathname)) return null;

  const labelMap: Record<string, string> = {
    admin: t.nav.user_management,
    users: t.nav.users,
    roles: t.nav.roles,
    permissions: t.nav.permissions,
    dictionary: t.nav.dictionary,
    template: t.template.title,
    post: t.nav.post,
    applicant: t.applicant.page_title,
  };

  // Path-based label overrides for ambiguous segments like 'new', 'edit', 'view'
  const pathLabelMap: Record<string, string> = {
    '/template/new': t.template.create_title,
    '/template/edit': t.template.edit_title,
    '/template/view': t.template.view_title,
    '/post/new': t.post.create_title,
    '/applicant/basicInformation': t.applicant.page_title,
  };

  // Routes that actually have pages
  const validRoutes = new Set(['/', '/admin/users', '/admin/roles', '/admin/permissions', '/admin/dictionary', '/template/edit', '/template/new', '/template/view', '/post/new', '/applicant/basicInformation']);

  const segments = pathname.split('/').filter(Boolean);

  const items = [
    { title: <HomeOutlined />, href: '/' },
    ...segments.map((seg, i) => {
      const href = '/' + segments.slice(0, i + 1).join('/');
      const isLast = i === segments.length - 1;
      const label = pathLabelMap[href] || labelMap[seg] || seg;
      if (isLast) return { title: label };
      if (validRoutes.has(href)) return { title: label, href };
      return { title: label };
    }),
  ];

  return (
    <div style={{ padding: '12px 24px', background: '#fff', borderBottom: '1px solid #e8e8e8' }}>
      <Breadcrumb items={items} />
    </div>
  );
}

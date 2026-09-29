'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button, Dropdown, Space, Badge, Modal } from 'antd';
import { UserOutlined, LogoutOutlined, IdcardOutlined, BellOutlined, QuestionCircleOutlined, ReadOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useAppStore } from '@/lib/store';
import { logout } from '@/api/auth';
import { useT, useI18nStore } from '@/lib/i18n';
import { apiGetNotifications, apiMarkNotificationReviewed } from '@/api/notification';
import type { Notification } from '@/api/notification';
import PersonalInfoDialog from '@/components/common/personal-info-dialog';
import { publicPath, appPath } from '@/lib/demo/config';

const NO_NAV_PATHS = ['/login', '/register'];

export default function Navigation() {
  const pathname = appPath(usePathname());
  const router = useRouter();
  const currentUser = useAppStore((s) => s.currentUser);
  const t = useT();
  const { locale, setLocale } = useI18nStore();
  const [personalInfoOpen, setPersonalInfoOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpPage, setHelpPage] = useState(0);

  useEffect(() => {
    if (currentUser) {
      apiGetNotifications().then(setNotifications).catch(() => {});
    }
  }, [currentUser]);

  if (NO_NAV_PATHS.includes(pathname)) return null;

  const isApplicantOnly =
    currentUser?.roles?.length === 1 && currentUser.roles[0].name === 'Applicant';

  const menuItems = [
    ...(isApplicantOnly ? [{
      key: 'personal-info',
      icon: <IdcardOutlined />,
      label: t.applicant.personal_info,
      onClick: () => setPersonalInfoOpen(true),
    }] : []),
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t.nav.logout,
      onClick: () => logout(false),
    },
  ];

  return (
    <>
    <nav className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6">
      <Link href="/" className="font-semibold text-gray-800 hover:text-blue-600 transition-colors">
        SmartDepanneur
      </Link>
      <Space size={16} align="center">
        <Button
          size="small"
          type="text"
          icon={<QuestionCircleOutlined />}
          onClick={() => {
            localStorage.removeItem('smartdepanneur_tour_seen_applicant');
            localStorage.removeItem('smartdepanneur_tour_seen_owner');
            localStorage.removeItem('smartdepanneur_tour_seen_login');
            localStorage.removeItem('smartdepanneur_tour_seen_admin');
            window.location.href = pathname.startsWith('/admin/') ? publicPath(pathname) : publicPath('/');
          }}
        >
          {t.tour.guide}
        </Button>
        <Button
          size="small"
          type="text"
          icon={<ReadOutlined />}
          onClick={() => { setHelpPage(0); setHelpOpen(true); }}
        >
          {t.help.btn}
        </Button>
        <Space size={4}>
          <Button
            size="small"
            type={locale === 'en' ? 'primary' : 'default'}
            onClick={() => setLocale('en')}
          >
            EN
          </Button>
          <Button
            size="small"
            type={locale === 'fr' ? 'primary' : 'default'}
            onClick={() => setLocale('fr')}
          >
            FR
          </Button>
          <Button
            size="small"
            type={locale === 'zh' ? 'primary' : 'default'}
            onClick={() => setLocale('zh')}
          >
            ZH
          </Button>
        </Space>
        {currentUser && (
          <>
            <Dropdown
              menu={{
                items: notifications.map((n) => ({
                  key: n.id,
                  label: (
                    <span style={{ color: n.reviewed ? '#999' : undefined }}>
                      {n.message}
                    </span>
                  ),
                  onClick: async () => {
                    if (!n.reviewed) {
                      await apiMarkNotificationReviewed(n.id);
                      setNotifications((prev) => prev.map((item) => item.id === n.id ? { ...item, reviewed: true } : item));
                    }
                    if (n.url) router.push(n.url);
                  },
                })),
              }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Badge count={notifications.filter((n) => !n.reviewed).length} size="small" offset={[-4, 4]}>
                <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} style={{ padding: '4px 8px' }} />
              </Badge>
            </Dropdown>
            <Dropdown menu={{ items: menuItems }} placement="bottomRight" trigger={['click']}>
              <Button type="text" icon={<UserOutlined />}>
                {currentUser.email}
              </Button>
            </Dropdown>
          </>
        )}
      </Space>
    </nav>
    {isApplicantOnly && (
      <PersonalInfoDialog open={personalInfoOpen} onClose={() => setPersonalInfoOpen(false)} />
    )}
    <Modal
      title={t.help.pages[helpPage]?.title}
      open={helpOpen}
      onCancel={() => setHelpOpen(false)}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            icon={<LeftOutlined />}
            disabled={helpPage === 0}
            onClick={() => setHelpPage((p) => p - 1)}
          >
            {t.tour.prev}
          </Button>
          <span style={{ color: '#999' }}>{helpPage + 1} / {t.help.pages.length}</span>
          {helpPage < t.help.pages.length - 1 ? (
            <Button
              type="primary"
              onClick={() => setHelpPage((p) => p + 1)}
            >
              {t.tour.next} <RightOutlined />
            </Button>
          ) : (
            <Button type="primary" onClick={() => setHelpOpen(false)}>
              {t.tour.finish}
            </Button>
          )}
        </div>
      }
      width={640}
    >
      <div style={{ whiteSpace: 'pre-line', lineHeight: 1.8, fontSize: 14, maxHeight: 480, overflow: 'auto' }}>
        {t.help.pages[helpPage]?.content}
      </div>
    </Modal>
    </>
  );
}

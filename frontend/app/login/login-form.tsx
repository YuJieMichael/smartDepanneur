'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { App, Button, Form, Input, Radio, Space, Tabs, Tour, Typography } from 'antd';
import { apiCheckEmailExists, apiLogin, apiRegister, fetchCurrentUser } from '@/api/auth';
import { useI18nStore, useT } from '@/lib/i18n';
import { DEMO_MODE, AUTH_STORAGE_KEY } from '@/lib/demo/config';

const TOUR_KEY = 'smartdepanneur_tour_seen_login';

const demoAccounts = [
  { label: 'Store Owner', email: 'owner@smartdepanneur.local', password: '123456' },
  { label: 'Cashier', email: 'cashier@smartdepanneur.local', password: '123456' },
];

export default function LoginForm() {
  const router = useRouter();
  const t = useT();
  const { locale, setLocale } = useI18nStore();
  const { message } = App.useApp();
  const [signInFormInstance] = Form.useForm<{ email: string; password: string }>();
  const [loading, setLoading] = useState(false);
  const [activeKey, setActiveKey] = useState('signin');
  const emailCheckTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const cardRef = useRef<HTMLDivElement>(null);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    if (!DEMO_MODE && !localStorage.getItem(TOUR_KEY)) {
      const timer = setTimeout(() => setTourOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  async function onSignIn(values: { email: string; password: string }) {
    setLoading(true);
    try {
      const { access_token } = await apiLogin(values.email, values.password);
      sessionStorage.setItem(AUTH_STORAGE_KEY, access_token);
      const user = await fetchCurrentUser();
      if (!user) throw new Error(DEMO_MODE ? "Demo session could not be loaded" : t.auth.login_failed);
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      const isCashierOnly =
        user?.roles.some((role) => role.name === 'Cashier') &&
        !user.roles.some((role) => role.name === 'Admin' || role.name === 'Store Owner');
      const safeRedirect =
        redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : null;
      router.replace(isCashierOnly ? '/sales' : safeRedirect ?? '/');
    } catch {
      message.error(t.auth.login_failed);
    } finally {
      setLoading(false);
    }
  }

  async function onSignUp(values: { email: string; password: string; role: string }) {
    setLoading(true);
    try {
      await apiRegister(values.email, values.password, [values.role]);
      message.success(t.auth.register_success);
      setActiveKey('signin');
    } catch {
      message.error(t.auth.register_failed);
    } finally {
      setLoading(false);
    }
  }

  const signInForm = (
    <Form form={signInFormInstance} layout="vertical" onFinish={onSignIn} autoComplete="off">
      <Form.Item
        label={t.common.email}
        name="email"
        rules={[
          { required: true, message: t.auth.email_required },
          { type: 'email', message: t.auth.email_invalid },
        ]}
      >
        <Input placeholder={t.auth.email_placeholder} size="large" />
      </Form.Item>
      <Form.Item
        label={t.common.password}
        name="password"
        rules={[{ required: true, message: t.auth.password_required }]}
      >
        <Input.Password placeholder={t.auth.password_placeholder} size="large" />
      </Form.Item>
      <Form.Item className="mb-0 mt-6">
        <Button type="primary" htmlType="submit" size="large" block loading={loading}>
          {t.auth.login_button}
        </Button>
      </Form.Item>
      <div style={{ marginTop: 16 }}>
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
          Demo accounts
        </Typography.Text>
        <Space wrap>
          {demoAccounts.map((account) => (
            <Button
              key={account.email}
              size="small"
              loading={loading}
              onClick={() => {
                signInFormInstance.setFieldsValue(account);
                onSignIn(account);
              }}
            >
              {account.label}
            </Button>
          ))}
        </Space>
      </div>
    </Form>
  );

  const signUpForm = (
    <Form layout="vertical" onFinish={onSignUp} autoComplete="off">
      <Form.Item
        label={t.common.email}
        name="email"
        validateTrigger="onChange"
        rules={[
          { required: true, message: t.auth.email_required },
          { type: 'email', message: t.auth.email_invalid },
          {
            validator: (_, value) => {
              if (!value || !/\S+@\S+\.\S+/.test(value)) return Promise.resolve();
              return new Promise<void>((resolve, reject) => {
                clearTimeout(emailCheckTimer.current);
                emailCheckTimer.current = setTimeout(async () => {
                  try {
                    const { exists } = await apiCheckEmailExists(value);
                    if (exists) reject(new Error(t.auth.email_already_exists));
                    else resolve();
                  } catch {
                    resolve();
                  }
                }, 500);
              });
            },
          },
        ]}
      >
        <Input placeholder={t.auth.email_placeholder} size="large" />
      </Form.Item>
      <Form.Item
        label={t.common.password}
        name="password"
        rules={[{ required: true, message: t.auth.password_required }]}
      >
        <Input.Password placeholder={t.auth.password_placeholder} size="large" />
      </Form.Item>
      <Form.Item
        label={t.common.confirm_password}
        name="confirm_password"
        dependencies={['password']}
        rules={[
          { required: true, message: t.auth.confirm_password_required },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) return Promise.resolve();
              return Promise.reject(new Error(t.auth.password_mismatch));
            },
          }),
        ]}
      >
        <Input.Password placeholder={t.auth.confirm_password_placeholder} size="large" />
      </Form.Item>
      <Form.Item
        label={t.auth.roles_label}
        name="role"
        rules={[{ required: true, message: t.auth.roles_required }]}
      >
        <Radio.Group
          optionType="button"
          buttonStyle="solid"
          options={[
            {
              label: locale === 'zh' ? '店主' : locale === 'fr' ? 'Propriétaire' : 'Store Owner',
              value: 'Store Owner',
            },
            {
              label: locale === 'zh' ? '收银员' : locale === 'fr' ? 'Caissier' : 'Cashier',
              value: 'Cashier',
            },
          ]}
        />
      </Form.Item>
      <Form.Item className="mb-0 mt-6">
        <Button type="primary" htmlType="submit" size="large" block loading={loading}>
          {t.auth.register_button}
        </Button>
      </Form.Item>
    </Form>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div ref={cardRef} className="bg-white p-10 rounded-2xl shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-center mb-6">SmartDepanneur</h1>
        <Space size={4} style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}>
          {(['en', 'fr', 'zh'] as const).map((language) => (
            <Button
              key={language}
              size="small"
              type={locale === language ? 'primary' : 'default'}
              onClick={() => setLocale(language)}
            >
              {language.toUpperCase()}
            </Button>
          ))}
        </Space>
        {DEMO_MODE ? (
          <Space orientation="vertical" style={{ width: '100%' }} size="middle">
            <Typography.Paragraph type="secondary">
              {locale === 'zh' ? '选择演示角色即可体验。无需注册，所有商品和交易均为虚构数据。'
                : locale === 'fr' ? 'Choisissez un rôle pour explorer le magasin fictif. Aucune inscription nécessaire.'
                : 'Choose a demo role to explore a fictional store. No registration required.'}
            </Typography.Paragraph>
            {demoAccounts.map((account) => (
              <Button key={account.email} type="primary" block size="large" loading={loading} onClick={() => onSignIn(account)}>
                {account.label === 'Store Owner' ? (locale === 'zh' ? '以店主身份体验' : locale === 'fr' ? 'Explorer comme propriétaire' : 'Explore as Store Owner')
                  : (locale === 'zh' ? '以收银员身份体验' : locale === 'fr' ? 'Explorer comme caissier' : 'Explore as Cashier')}
              </Button>
            ))}
          </Space>
        ) : <Tabs
          activeKey={activeKey}
          onChange={setActiveKey}
          centered
          items={[
            { key: 'signin', label: t.auth.sign_in, children: signInForm },
            { key: 'signup', label: t.auth.sign_up, children: signUpForm },
          ]}
        />}
        <Tour
          open={tourOpen}
          onClose={() => {
            setTourOpen(false);
            localStorage.setItem(TOUR_KEY, '1');
          }}
          steps={[
            {
              title: t.auth.sign_in,
              description: t.tour.login_tabs,
              target: () => cardRef.current!,
            },
            {
              title: t.auth.sign_up,
              description: t.tour.login_form,
              target: () => cardRef.current!,
            },
            {
              title: t.auth.roles_label,
              description: t.tour.login_roles,
              target: () => cardRef.current!,
            },
          ]}
        />
      </div>
    </div>
  );
}

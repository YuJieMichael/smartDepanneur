"use client";

import { useEffect } from "react";
import "@/lib/setup-interceptors";
import { App, ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import frFR from "antd/locale/fr_FR";
import zhCN from "antd/locale/zh_CN";
import { setMessageInstance } from "@/lib/message-bridge";
import { initInterceptorCallbacks } from "@/lib/setup-interceptors";
import { logout, apiRefreshToken } from "@/api/auth";
import { useI18nStore } from "@/lib/i18n";

function MessageBridgeRegister() {
  const { message } = App.useApp();
  useEffect(() => {
    setMessageInstance(message);
    initInterceptorCallbacks(logout, apiRefreshToken);
  }, [message]);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const locale = useI18nStore((state) => state.locale);
  const antdLocale = locale === "fr" ? frFR : locale === "zh" ? zhCN : enUS;

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
  }, [locale]);

  return (
    <ConfigProvider locale={antdLocale} theme={{ token: { fontSize: 14 } }}>
      <App>
        <MessageBridgeRegister />
        {children}
      </App>
    </ConfigProvider>
  );
}

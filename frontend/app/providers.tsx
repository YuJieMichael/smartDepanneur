"use client";

import { useEffect } from "react";
import "@/lib/setup-interceptors";
import { App, ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import { setMessageInstance } from "@/lib/message-bridge";
import { initInterceptorCallbacks } from "@/lib/setup-interceptors";
import { logout, apiRefreshToken } from "@/api/auth";

function MessageBridgeRegister() {
  const { message } = App.useApp();
  useEffect(() => {
    setMessageInstance(message);
    initInterceptorCallbacks(logout, apiRefreshToken);
  }, [message]);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider locale={enUS} theme={{ token: { fontSize: 14 } }}>
      <App>
        <MessageBridgeRegister />
        {children}
      </App>
    </ConfigProvider>
  );
}

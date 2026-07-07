import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import AuthGuard from "@/components/common/auth-guard";
import Navigation from "@/components/layout/navigation";
import LeftMenu from "@/components/layout/left-menu";
import AppBreadcrumb from "@/components/layout/breadcrumb";
import { AntdRegistry } from "@ant-design/nextjs-registry";

export const metadata: Metadata = {
  title: "SmartDepanneur",
  description: "SmartDepanneur - Convenience store management demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AntdRegistry>
          <Providers>
            <AuthGuard>
              <Navigation />
              <div className="flex h-[calc(100vh-56px)]">
                <LeftMenu />
                <main className="flex-1 bg-white overflow-hidden flex flex-col">
                  <AppBreadcrumb />
                  <div className="flex-1 overflow-auto">{children}</div>
                </main>
              </div>
            </AuthGuard>
          </Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}

import type { NextConfig } from "next";

const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const nextConfig: NextConfig = {
  output: demo ? "export" : "standalone",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  ...(demo ? { trailingSlash: true, images: { unoptimized: true } } : {}),
  ...(!demo ? { async rewrites() {
    const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:3101";

    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  } } : {}),
};

export default nextConfig;

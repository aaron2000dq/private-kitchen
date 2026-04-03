import type { NextConfig } from "next";

const basePath = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || "";
const isStaticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  output: isStaticExport ? "export" : undefined,
  ...(basePath ? { basePath } : {}),
  trailingSlash: isStaticExport ? true : undefined,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_STATIC_EXPORT: isStaticExport ? "1" : "",
  },
};

export default nextConfig;

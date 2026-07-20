import type { Metadata, Viewport } from "next";
import "@fontsource-variable/noto-serif-sc";
import { PwaBootstrap } from "@/components/common/PwaBootstrap";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || "";

export const metadata: Metadata = {
  title: "私人厨房",
  description: "记录菜谱，享受料理的安静时刻。",
  applicationName: "私人厨房",
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    title: "私人厨房",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: `${basePath}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${basePath}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: `${basePath}/icons/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f2f1ea",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col font-sans">
        <PwaBootstrap />
        {children}
      </body>
    </html>
  );
}

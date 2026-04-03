import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "私人厨房",
  description: "记录菜谱，享受料理的安静时刻。",
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
        {children}
      </body>
    </html>
  );
}

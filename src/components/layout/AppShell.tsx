"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const nav = [
  { href: "/", label: "今日" },
  { href: "/recipes", label: "菜谱" },
  { href: "/categories", label: "分类" },
  { href: "/import", label: "导入" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-full grain">
      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-[color:rgba(246,246,243,0.68)] dark:supports-[backdrop-filter]:bg-[color:rgba(11,13,11,0.55)] border-b border-[color:var(--line)]">
        <div className="mx-auto w-full max-w-6xl px-5">
          <div className="flex h-16 items-center justify-between gap-6">
            <Link
              href="/"
              className="group inline-flex items-baseline gap-3"
              aria-label="私人厨房首页"
            >
              <span className="font-[var(--font-noto-serif-sc)] text-[18px] tracking-wide">
                私人厨房
              </span>
              <span className="hidden text-[12px] text-[color:var(--muted-2)] md:inline">
                记录 · 归类 · 推荐
              </span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              {nav.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-xl px-3 py-2 text-[13px] transition-colors",
                      active
                        ? "bg-black/[0.04] dark:bg-white/[0.07] text-[color:var(--foreground)]"
                        : "text-[color:var(--muted)] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 py-10">{children}</main>

      <footer className="mx-auto w-full max-w-6xl px-5 pb-10">
        <div className="mt-6 border-t border-[color:var(--line)] pt-6 text-[12px] text-[color:var(--muted-2)]">
          <span className="font-[var(--font-noto-serif-sc)]">私人厨房</span>{" "}
          <span className="opacity-80">· 保存在本地浏览器</span>
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--line)] bg-[color:var(--paper)]/90 backdrop-blur md:hidden">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-around px-4">
          {nav.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-xl px-3 py-2 text-[12px]",
                  active
                    ? "text-[color:var(--foreground)]"
                    : "text-[color:var(--muted)]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="h-14 md:hidden" />
    </div>
  );
}


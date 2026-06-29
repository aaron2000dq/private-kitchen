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

function isNavActive(itemHref: string, pathname: string): boolean {
  if (itemHref === "/") return pathname === "/";
  if (itemHref === "/recipes") return pathname === "/recipes" || pathname.startsWith("/recipes/");
  if (itemHref === "/categories") return pathname === "/categories" || pathname.startsWith("/categories/");
  if (itemHref === "/import") return pathname === "/import" || pathname.startsWith("/import/");
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-full grain">
      <header className="sticky top-0 z-30 border-b border-[color:var(--line)] bg-[color:var(--background)]/82 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--background)]/68">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-5">
          <div className="flex h-14 items-center justify-between gap-4 md:h-16">
            <Link
              href="/"
              className="group inline-flex items-center gap-2"
              aria-label="私人厨房首页"
            >
              <span className="h-2.5 w-2.5 rounded-sm bg-[color:var(--warm)]" />
              <span className="font-[var(--font-noto-serif-sc)] text-[18px]">
                私人厨房
              </span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              {nav.map((item) => {
                const active = isNavActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-lg px-3 py-2 text-[13px] transition-colors",
                      active
                        ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
                        : "text-[color:var(--muted)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
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

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-5 md:py-10">{children}</main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-5">
        <div className="mt-6 border-t border-[color:var(--line)] pt-5 text-[12px] text-[color:var(--muted-2)]">
          <span className="font-[var(--font-noto-serif-sc)]">私人厨房</span>{" "}
          <span className="opacity-80">· 保存在本地浏览器</span>
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--line)] bg-[color:var(--paper)]/94 backdrop-blur md:hidden">
        <div className="mx-auto grid h-16 max-w-6xl grid-cols-4 items-center gap-1 px-3 pb-[env(safe-area-inset-bottom)]">
          {nav.map((item) => {
            const active = isNavActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex h-11 items-center justify-center rounded-lg px-2 text-[12px]",
                  active
                    ? "bg-[color:var(--wash)] text-[color:var(--foreground)]"
                    : "text-[color:var(--muted)]",
                )}
              >
                {active ? (
                  <span className="absolute left-1/2 top-1 h-0.5 w-5 -translate-x-1/2 rounded-full bg-[color:var(--warm)]" />
                ) : null}
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="h-16 md:hidden" />
    </div>
  );
}

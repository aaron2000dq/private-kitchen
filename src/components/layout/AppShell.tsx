"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const nav = [
  { href: "/", label: "今日", mark: "今" },
  { href: "/recipes", label: "菜谱", mark: "谱" },
  { href: "/categories", label: "分类", mark: "类" },
  { href: "/import", label: "导入", mark: "入" },
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
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const shellStyle = {
    "--app-paper-texture": `url("${basePath}/images/private-kitchen-paper-texture.webp")`,
  } as React.CSSProperties;

  return (
    <div className="min-h-full grain" style={shellStyle}>
      <header className="sticky top-0 z-30 border-b border-[color:var(--line)] bg-[color:var(--background)]/88 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--background)]/72">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-5">
          <div className="flex h-14 items-center justify-between gap-4 md:h-16">
            <Link
              href="/"
              className="group inline-flex items-center gap-2.5"
              aria-label="私人厨房首页"
            >
              <span className="pk-seal-dot" />
              <span className="pk-serif text-[19px]">
                私人厨房
              </span>
            </Link>

            <nav className="hidden items-center gap-1 rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)]/62 p-1 md:flex">
              {nav.map((item) => {
                const active = isNavActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-[13px] transition-colors",
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

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--line)] bg-[color:var(--paper)]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_28px_rgba(24,33,29,0.08)] backdrop-blur md:hidden">
        <div className="mx-auto grid h-16 max-w-6xl grid-cols-4 items-center gap-1 px-2.5">
          {nav.map((item) => {
            const active = isNavActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-[11px]",
                  active
                    ? "bg-[color:var(--wash)] text-[color:var(--foreground)]"
                    : "text-[color:var(--muted)]",
                )}
              >
                {active ? (
                  <span className="absolute left-1/2 top-1 h-0.5 w-6 -translate-x-1/2 rounded-full bg-[color:var(--warm)]" />
                ) : null}
                <span
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-md border text-[10px] pk-serif",
                    active
                      ? "border-[color:var(--menu-line)] bg-[color:var(--paper)] text-[color:var(--warm)]"
                      : "border-transparent text-[color:var(--muted-2)]",
                  )}
                  aria-hidden
                >
                  {item.mark}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="h-[calc(4rem+env(safe-area-inset-bottom))] md:hidden" />
    </div>
  );
}

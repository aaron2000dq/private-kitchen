"use client";

import { AppLink as Link } from "@/components/ui/AppLink";
import { usePathname } from "next/navigation";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const nav = [
  { href: "/", label: "今日", icon: "today" },
  { href: "/recipes", label: "菜谱", icon: "book" },
  { href: "/categories", label: "分类", icon: "shelf" },
  { href: "/import", label: "导入", icon: "import" },
] as const;

function NavIcon({ name }: { name: (typeof nav)[number]["icon"] }) {
  if (name === "today") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M7 3.5v3M17 3.5v3M5 8.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M6.5 5.5h11A2.5 2.5 0 0 1 20 8v9.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5V8a2.5 2.5 0 0 1 2.5-2.5Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 13h8M8 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "book") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5.5 5.5A2.5 2.5 0 0 1 8 3h10.5v16H8a2.5 2.5 0 0 0-2.5 2.5v-16Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M8 3v16M10.5 8h5M10.5 12h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "shelf") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 6.5h14M5 12h14M5 17.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M7 4.5v15M17 4.5v15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M9.5 8.5h2M13 14h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4v9M8.5 9.5 12 13l3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 14.5v2.8A2.7 2.7 0 0 0 7.7 20h8.6a2.7 2.7 0 0 0 2.7-2.7v-2.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.5 16.5h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

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
      <header className="sticky top-0 z-30 border-b border-[color:var(--line)] bg-[color:var(--background)]/98 shadow-[0_1px_18px_rgba(24,33,29,0.06)] backdrop-blur-xl supports-[backdrop-filter]:bg-[color:var(--background)]/96">
        <div className="mx-auto w-full max-w-6xl px-[var(--app-gutter)] sm:px-5">
          <div className="flex h-16 items-center justify-between gap-4 md:h-16">
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

      <main className="mx-auto w-full max-w-6xl px-[var(--app-gutter)] py-7 sm:px-5 md:py-10">{children}</main>

      <footer className="mx-auto w-full max-w-6xl px-[var(--app-gutter)] pb-8 sm:px-5">
        <div className="mt-6 border-t border-[color:var(--line)] pt-5 text-[12px] text-[color:var(--muted-2)]">
          <span className="font-[var(--font-noto-serif-sc)]">私人厨房</span>{" "}
          <span className="opacity-80">· 保存在本地浏览器</span>
        </div>
      </footer>

      <nav className="fixed inset-x-[var(--app-gutter-tight)] bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 rounded-lg border border-[color:var(--menu-line-soft)] bg-[color:var(--paper)]/98 shadow-[0_-6px_30px_rgba(24,33,29,0.16)] backdrop-blur-xl md:hidden">
        <div className="mx-auto grid h-[4.25rem] max-w-6xl grid-cols-4 items-center gap-1.5 px-2.5">
          {nav.map((item) => {
            const active = isNavActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px]",
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
                    "grid h-6 w-6 place-items-center rounded-md border p-1 transition-colors",
                    active
                      ? "border-[color:var(--menu-line)] bg-[color:var(--paper)] text-[color:var(--warm)]"
                      : "border-[color:rgba(24,33,29,0.10)] bg-[color:var(--paper)]/55 text-[color:var(--muted-2)]",
                  )}
                  aria-hidden
                >
                  <NavIcon name={item.icon} />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="h-[var(--bottom-bar-space)] md:hidden" />
    </div>
  );
}

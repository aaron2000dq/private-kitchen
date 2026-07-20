"use client";

import * as React from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useRecipes } from "@/lib/recipes/useRecipes";
import { useTodayCookbook } from "@/lib/today/useTodayCookbook";
import { buildTodayMenuInsights } from "@/lib/today/menuInsights";
import { useKitchenPrepProgress } from "@/lib/today/useKitchenPrepProgress";

const DINER_COUNT_KEY = "private-kitchen:diner-count:v1";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function normalizeDinerCount(value: number): number {
  if (!Number.isFinite(value)) return 2;
  return Math.min(10, Math.max(1, Math.round(value)));
}

function readDinerCount(): number {
  if (typeof window === "undefined") return 2;

  try {
    const raw = window.localStorage.getItem(DINER_COUNT_KEY);
    return normalizeDinerCount(raw ? Number(raw) : 2);
  } catch {
    return 2;
  }
}

function formatNames(names: string[], fallback: string, max = 4): string {
  const visible = names.slice(0, max);
  if (!visible.length) return fallback;
  return `${visible.join("、")}${names.length > max ? "等" : ""}`;
}

export function TodayMenuConcierge() {
  const { recipes } = useRecipes();
  const { ids } = useTodayCookbook();
  const [dinerCount, setDinerCount] = React.useState(2);
  const [copyTip, setCopyTip] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDinerCount(readDinerCount());
  }, []);

  const selectedRecipes = React.useMemo(() => {
    if (!ids.length) return [];
    const order = new Map(ids.map((id, index) => [id, index]));
    return recipes
      .filter((recipe) => order.has(recipe.id))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }, [ids, recipes]);

  const insights = React.useMemo(() => buildTodayMenuInsights(selectedRecipes, dinerCount), [dinerCount, selectedRecipes]);
  const menuKey = React.useMemo(
    () => selectedRecipes.map((recipe) => recipe.id).join("|"),
    [selectedRecipes],
  );
  const prepProgress = useKitchenPrepProgress(menuKey, insights.shoppingList);
  const shoppingTotal = insights.shoppingList.length;
  const shoppingPercent = shoppingTotal ? Math.round((prepProgress.doneCount / shoppingTotal) * 100) : 0;
  const selectedNames = React.useMemo(() => selectedRecipes.map((recipe) => recipe.name), [selectedRecipes]);

  const dashboardStats = [
    { label: "人数", value: `${insights.serving.diners} 人`, tone: "warm" as const },
    { label: "预算", value: insights.budget.range, tone: "warm" as const },
    { label: "口味", value: insights.palate.label, tone: "accent" as const },
    { label: "采购", value: `${prepProgress.doneCount}/${shoppingTotal || 0}`, tone: "muted" as const },
  ];

  const onCopyBrief = async () => {
    if (!selectedRecipes.length) return;

    try {
      await navigator.clipboard.writeText(
        [
          `${insights.serving.diners}人份 · 私人厨房今日简报`,
          `菜单：${formatNames(selectedNames, "还没选菜", 8)}`,
          `完成度：${insights.score}/100`,
          `预算：${insights.budget.range} · ${insights.budget.perPerson}`,
          `口味：${insights.palate.label} · ${insights.palate.score}分`,
          `采购：${prepProgress.doneCount}/${shoppingTotal || 0} 项已备`,
          `提示：${insights.palate.notes.slice(0, 2).join("；")}`,
        ].join("\n"),
      );
      setCopyTip("今日简报已复制。");
    } catch {
      setCopyTip("复制失败，可以直接截图总控台。");
    }
  };

  return (
    <section className="pk-panel overflow-hidden">
      <div className="grid gap-4 p-4 sm:grid-cols-[0.92fr_1.08fr] sm:p-5">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <Badge tone="accent">今日总控台</Badge>
              <h2 className="pk-serif text-[24px] leading-tight">
                {selectedRecipes.length ? `${insights.serving.diners} 人份晚餐就绪` : insights.headline}
              </h2>
              <p className="text-[13px] leading-6 text-[color:var(--muted)]">{insights.summary}</p>
            </div>
            <div className="grid h-[82px] w-[82px] shrink-0 place-items-center rounded-lg border border-[color:var(--menu-line)] bg-[radial-gradient(circle_at_50%_38%,rgba(185,148,75,0.18),rgba(255,253,246,0.68))]">
              <div className="text-center">
                <div className="pk-serif text-[25px] leading-none text-[color:var(--accent)]">
                  {insights.score}
                </div>
                <div className="mt-1 text-[10px] text-[color:var(--muted-2)]">完成度</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {dashboardStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-[color:var(--line)] bg-[color:var(--paper-strong)]/72 px-3 py-2"
              >
                <div className="text-[11px] text-[color:var(--muted-2)]">{stat.label}</div>
                <div
                  className={cn(
                    "pk-serif mt-1 truncate text-[17px]",
                    stat.tone === "warm" && "text-[color:var(--warm)]",
                    stat.tone === "accent" && "text-[color:var(--accent)]",
                    stat.tone === "muted" && "text-[color:var(--foreground)]",
                  )}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-[color:rgba(63,111,85,0.20)] bg-[color:rgba(63,111,85,0.07)] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] text-[color:var(--muted-2)]">执行进度</div>
                <div className="mt-1 truncate text-[12px] text-[color:var(--muted)]">
                  {shoppingTotal ? `采购已备 ${shoppingPercent}%` : "定好菜单后开始执行"}
                </div>
              </div>
              <Badge tone={shoppingPercent >= 80 ? "accent" : "muted"}>{shoppingPercent}%</Badge>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color:rgba(24,33,29,0.08)]">
              <div
                className="h-full rounded-full bg-[color:var(--accent)] transition-[width]"
                style={{ width: `${shoppingPercent}%` }}
              />
            </div>
          </div>

          <div>
            <div className="text-[12px] text-[color:var(--muted-2)]">结构建议</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {insights.missing.map((item) => (
                <span
                  key={item}
                  className="rounded-md border border-[color:rgba(184,92,56,0.24)] bg-[color:rgba(184,92,56,0.07)] px-2.5 py-1 text-[12px] text-[color:var(--warm)]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[12px] text-[color:var(--muted-2)]">口味把关</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {insights.palate.notes.slice(0, 3).map((note) => (
                <span
                  key={note}
                  className="rounded-md border border-[color:rgba(63,111,85,0.22)] bg-[color:rgba(63,111,85,0.07)] px-2.5 py-1 text-[12px] text-[color:var(--accent)]"
                >
                  {note}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-lg border border-[color:rgba(185,148,75,0.26)] bg-[linear-gradient(180deg,rgba(185,148,75,0.08),rgba(255,253,246,0.54))] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="pk-serif text-[17px]">今晚菜单</div>
                <div className="mt-1 text-[12px] text-[color:var(--muted-2)]">
                  {selectedRecipes.length ? `${selectedRecipes.length} 道 · ${insights.palate.label}` : "选菜后生成完整总控"}
                </div>
              </div>
              <span className="rounded-md border border-[color:var(--line)] px-2 py-1 text-[11px] text-[color:var(--muted)]">
                {insights.score}/100
              </span>
            </div>
            <div className="mt-3 grid gap-2">
              {selectedRecipes.length ? (
                selectedRecipes.slice(0, 5).map((recipe, index) => (
                  <div
                    key={recipe.id}
                    className="grid grid-cols-[1.9rem_minmax(0,1fr)] items-center gap-2 rounded-md border border-[color:var(--line)] bg-[color:var(--paper)]/72 px-2.5 py-2"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-md border border-[color:var(--menu-line-soft)] text-[10px] text-[color:var(--muted)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate text-[12px] text-[color:var(--foreground)]">{recipe.name}</span>
                  </div>
                ))
              ) : (
                <span className="text-[12px] leading-6 text-[color:var(--muted)]">
                  先从推荐或菜谱库挑几道，首页会汇总菜单质量、预算、口味和执行进度。
                </span>
              )}
              {selectedRecipes.length > 5 ? (
                <div className="rounded-md border border-[color:var(--menu-line-soft)] px-2.5 py-2 text-[11px] text-[color:var(--muted)]">
                  还有 {selectedRecipes.length - 5} 道在今日菜单
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--paper-strong)]/66 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="pk-serif text-[17px]">下一步</div>
                <div className="mt-1 text-[12px] text-[color:var(--muted-2)]">
                  {selectedRecipes.length ? insights.crew.headline : "先把菜单定下来"}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 shrink-0 px-2.5 text-[12px]"
                disabled={!selectedRecipes.length}
                onClick={onCopyBrief}
              >
                复制简报
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {insights.timeline.slice(0, 3).map((item) => (
                <div key={item.label} className="grid grid-cols-[34px_minmax(0,1fr)] gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-md border border-[color:var(--menu-line-soft)] text-[11px] text-[color:var(--accent)]">
                    {item.label}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] text-[color:var(--foreground)]">{item.title}</div>
                    <div className="mt-0.5 text-[12px] leading-5 text-[color:var(--muted)]">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
            {copyTip ? (
              <div className="mt-3 rounded-md border border-[color:rgba(63,111,85,0.20)] bg-[color:rgba(63,111,85,0.07)] px-2.5 py-2 text-[11px] text-[color:var(--accent)]">
                {copyTip}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ButtonLink href="/categories" variant="outline" className="h-10 text-[13px]">
              去点单
            </ButtonLink>
            <ButtonLink href="/recipes" className="h-10 text-[13px]">
              管理菜单
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import * as React from "react";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { useRecipes } from "@/lib/recipes/useRecipes";
import { useTodayCookbook } from "@/lib/today/useTodayCookbook";
import { buildTodayMenuInsights } from "@/lib/today/menuInsights";

export function TodayMenuConcierge() {
  const { recipes } = useRecipes();
  const { ids } = useTodayCookbook();

  const selectedRecipes = React.useMemo(() => {
    if (!ids.length) return [];
    const order = new Map(ids.map((id, index) => [id, index]));
    return recipes
      .filter((recipe) => order.has(recipe.id))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }, [ids, recipes]);

  const insights = React.useMemo(() => buildTodayMenuInsights(selectedRecipes), [selectedRecipes]);

  return (
    <section className="pk-panel overflow-hidden">
      <div className="grid gap-4 p-4 sm:grid-cols-[0.95fr_1.05fr] sm:p-5">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <Badge tone="accent">私房管家</Badge>
              <h2 className="pk-serif text-[24px] leading-tight">{insights.headline}</h2>
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

          <div className="grid grid-cols-3 gap-2">
            {insights.stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-[color:var(--line)] bg-[color:var(--paper-strong)]/72 px-3 py-2"
              >
                <div className="text-[11px] text-[color:var(--muted-2)]">{stat.label}</div>
                <div className="pk-serif mt-1 truncate text-[17px] text-[color:var(--foreground)]">
                  {stat.value}
                </div>
              </div>
            ))}
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

          <div className="flex flex-wrap gap-2">
            {insights.roleLabels.length ? (
              insights.roleLabels.map((role) => (
                <span
                  key={role}
                  className="rounded-md border border-[color:rgba(63,111,85,0.22)] bg-[color:rgba(63,111,85,0.07)] px-2.5 py-1 text-[12px] text-[color:var(--accent)]"
                >
                  已有 {role}
                </span>
              ))
            ) : (
              <span className="text-[12px] text-[color:var(--muted-2)]">还没有选菜，先从推荐或菜谱库里挑。</span>
            )}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--paper-strong)]/66 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="pk-serif text-[17px]">采购清单</div>
                <div className="mt-1 text-[12px] text-[color:var(--muted-2)]">
                  {insights.shoppingList.length ? "按出现频率自动合并" : "选菜后自动生成"}
                </div>
              </div>
              <span className="rounded-md border border-[color:var(--line)] px-2 py-1 text-[11px] text-[color:var(--muted)]">
                {insights.shoppingList.length || 0} 项
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {insights.shoppingList.length ? (
                insights.shoppingList.map((item) => (
                  <span
                    key={item}
                    className="rounded-md bg-[color:var(--paper)] px-2.5 py-1 text-[12px] text-[color:var(--muted)] shadow-[0_1px_0_rgba(24,33,29,0.04)]"
                  >
                    {item}
                  </span>
                ))
              ) : (
                <span className="text-[12px] leading-6 text-[color:var(--muted)]">
                  管家会把主料和高频辅料整理成一份轻量采购清单。
                </span>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--paper-strong)]/66 p-3">
            <div className="pk-serif text-[17px]">备菜节奏</div>
            <div className="mt-3 space-y-2">
              {insights.timeline.map((item) => (
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

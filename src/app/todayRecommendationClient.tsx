"use client";

import Link from "next/link";
import * as React from "react";
import { useRecipes } from "@/lib/recipes/useRecipes";
import { useWeeklyRecommendation } from "@/lib/recommendation/useWeeklyRecommendation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useTodayCookbook } from "@/lib/today/useTodayCookbook";
import { recipeImageUrl } from "@/lib/recipes/recipeImageUrl";
import { recipeDetailHref } from "@/lib/recipes/recipeRoutes";

export function TodayRecommendationClient() {
  const { recipes, hydrated } = useRecipes();
  const { data, loading, error } = useWeeklyRecommendation(recipes);
  const { ids: todayIds, has: isTodaySelected, add: addToToday, max: todayMax } =
    useTodayCookbook();

  const recommended = React.useMemo(() => {
    const ids = data?.recommendedRecipeIds ?? [];
    const order = new Map(ids.map((id, i) => [id, i]));
    return [...recipes]
      .filter((r) => order.has(r.id))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .slice(0, 3);
  }, [data?.recommendedRecipeIds, recipes]);

  const selectedRecipes = React.useMemo(() => {
    if (!todayIds.length) return [];
    const order = new Map(todayIds.map((id, i) => [id, i]));
    return [...recipes]
      .filter((r) => order.has(r.id))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .slice(0, 3);
  }, [recipes, todayIds]);

  const display = selectedRecipes.length ? selectedRecipes : recommended;

  return (
    <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper)] p-6 shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-3">
          <Badge tone="accent">今日推荐</Badge>
          <h2 className="font-[var(--font-noto-serif-sc)] text-[22px] leading-tight tracking-wide">
            今天想吃什么？
          </h2>
          <p className="max-w-xl text-[13px] leading-7 text-[color:var(--muted)]">
            {todayIds.length
              ? "你已经把菜选成“今日菜谱”了；可在「菜谱」tab里清空/删除/导出为图片。"
              : data?.reason?.trim()
                  ? data.reason
                  : "根据日期与已有菜谱，为你搭配一份更顺手的组合。"}
          </p>
        </div>
        {loading ? (
          <span className="shrink-0 text-[12px] text-[color:var(--muted-2)]">载入中…</span>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-[color:rgba(201,138,99,0.35)] bg-[color:rgba(201,138,99,0.10)] px-4 py-3 text-[13px]">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {display.length ? (
          display.map((r) => {
            const selected = isTodaySelected(r.id);
            const canAdd = !selected && todayIds.length < todayMax;
            return (
            <Link
              key={r.id}
              href={recipeDetailHref(r.id)}
              className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-black/[0.02] text-[13px] transition-colors hover:bg-black/[0.03] dark:bg-white/[0.04] dark:hover:bg-white/[0.06]"
            >
              {r.images?.[0] ? (
                <div className="border-b border-[color:var(--line)] bg-black/[0.02] dark:bg-white/[0.04]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={recipeImageUrl(r.images[0])}
                    alt={r.name}
                    loading="lazy"
                    decoding="async"
                    className="h-28 w-full object-cover"
                  />
                </div>
              ) : null}
              <div className="px-4 py-3">
                <div className="font-[var(--font-noto-serif-sc)] text-[16px] tracking-wide">
                  {r.name}
                </div>
                <div className="mt-2 text-[12px] text-[color:var(--muted-2)]">
                  {r.category} · {r.rating ? `${r.rating}/5` : "未评分"}
                </div>
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant={selected ? "outline" : "primary"}
                    disabled={selected || !canAdd}
                    className="w-full"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (canAdd) void addToToday(r.id);
                    }}
                  >
                    {selected ? "已加入今日菜谱" : "今天吃这个"}
                  </Button>
                </div>
              </div>
            </Link>
            );
          })
        ) : (
          <div className="md:col-span-3 rounded-2xl border border-[color:var(--line)] bg-black/[0.01] px-4 py-4 text-[13px] text-[color:var(--muted)] dark:bg-white/[0.03]">
            {!hydrated
              ? "加载本地菜谱…"
              : recipes.length === 0
                ? "你还没有菜谱。先新增几道拿手菜。"
                : loading
                  ? "正在生成本周推荐…"
                  : "暂无今日推荐。若刚清空过站点数据，请稍候再打开页面。"}
          </div>
        )}
      </div>
    </div>
  );
}

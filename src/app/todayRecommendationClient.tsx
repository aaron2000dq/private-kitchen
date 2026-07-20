"use client";

import { AppLink as Link } from "@/components/ui/AppLink";
import * as React from "react";
import { useRecipes } from "@/lib/recipes/useRecipes";
import { useDailyRecommendation } from "@/lib/recommendation/useDailyRecommendation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useTodayCookbook } from "@/lib/today/useTodayCookbook";
import { recipeImageThumbUrl, recipeImageUrl } from "@/lib/recipes/recipeImageUrl";
import { recipeDetailHref } from "@/lib/recipes/recipeRoutes";
import { formatRecipeIngredientsPreview } from "@/lib/recipes/formatIngredientsPreview";
import { VisuallyLosslessThumb } from "@/components/recipes/VisuallyLosslessThumb";

export function TodayRecommendationClient() {
  const { recipes, hydrated } = useRecipes();
  const { data, loading } = useDailyRecommendation(recipes);
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
    <section className="pk-panel">
      <div className="px-4 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4 border-b border-dashed border-[color:rgba(24,33,29,0.18)] pb-4">
          <div className="min-w-0 space-y-2">
            <Badge tone="warm">{todayIds.length ? "今日菜单" : "今日推荐"}</Badge>
            <h2 className="pk-serif text-[24px] leading-tight text-[color:var(--foreground)]">
              今天吃这几道
            </h2>
            <p className="max-w-2xl text-[13px] leading-6 text-[color:var(--muted)]">
              {todayIds.length
                ? "今日菜单已选好，可以在菜谱页继续增删和分享小票。"
                : data?.reason?.trim()
                  ? data.reason
                  : "正在从本地菜谱里搭配今天这餐。"}
            </p>
          </div>
          {loading ? (
            <span className="shrink-0 pt-1 text-[12px] text-[color:var(--muted-2)]">读取中</span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 px-3 pb-4 sm:grid-cols-3 sm:px-4">
        {display.length ? (
          display.map((r, index) => {
            const selected = isTodaySelected(r.id);
            const canAdd = !selected && todayIds.length < todayMax;
            const ingPreview = formatRecipeIngredientsPreview(r, 2, 2);
            const href = recipeDetailHref(r.id);
            return (
              <article
                key={r.id}
                className="group overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--paper-strong)] text-[13px] shadow-[0_1px_0_rgba(24,33,29,0.04)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[color:rgba(184,92,56,0.36)] hover:shadow-[var(--shadow-soft)]"
              >
                <Link
                  href={href}
                  className="block aspect-[4/3] w-full overflow-hidden border-b border-[color:var(--line)] bg-[color:var(--wash)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--ring)]"
                  aria-label={`打开菜谱：${r.name}`}
                >
                  {r.images?.[0] ? (
                    <VisuallyLosslessThumb
                      src={recipeImageThumbUrl(r.images[0])}
                      fallbackSrc={recipeImageUrl(r.images[0])}
                      alt={r.name}
                      loading={index === 0 ? "eager" : "lazy"}
                      fetchPriority={index === 0 ? "high" : "auto"}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[12px] text-[color:var(--muted-2)]">
                      无图
                    </div>
                  )}
                </Link>
                <div className="px-3 py-3">
                  <Link
                    href={href}
                  className="pk-serif line-clamp-2 text-[16px] leading-tight transition-colors hover:text-[color:var(--warm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                  >
                    {r.name}
                  </Link>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-[color:var(--muted-2)]">
                    <span className="truncate">{r.category}</span>
                    <span>{r.rating ? `${r.rating}/5` : "未评分"}</span>
                  </div>
                  {ingPreview ? (
                    <div className="mt-2 line-clamp-2 text-[11px] leading-4 text-[color:var(--muted)]">
                      {ingPreview}
                    </div>
                  ) : null}
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant={selected ? "outline" : "primary"}
                      disabled={selected || !canAdd}
                      className="w-full"
                      onClick={() => {
                        if (canAdd) void addToToday(r.id);
                      }}
                    >
                      {selected ? "已加入" : "加入今日"}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--wash)] px-4 py-4 text-[13px] text-[color:var(--muted)] sm:col-span-3">
            {!hydrated
              ? "加载本地菜谱…"
              : recipes.length === 0
                ? "你还没有菜谱。先新增几道拿手菜。"
                : loading
                  ? "正在读取今日推荐…"
                  : "暂无今日推荐。若刚清空过站点数据，请稍候再打开页面。"}
          </div>
        )}
      </div>
    </section>
  );
}

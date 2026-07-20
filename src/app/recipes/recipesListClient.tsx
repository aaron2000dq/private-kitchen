"use client";

import * as React from "react";
import Link from "next/link";
import { useRecipes } from "@/lib/recipes/useRecipes";
import { useTodayCookbook } from "@/lib/today/useTodayCookbook";
import { exportTodayCookbookToPng } from "@/lib/today/exportTodayCookbookToImage";
import { recipeImageThumbUrl, recipeImageUrl } from "@/lib/recipes/recipeImageUrl";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { RecipeCard } from "@/components/recipes/RecipeCard";
import { VisuallyLosslessThumb } from "@/components/recipes/VisuallyLosslessThumb";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function RecipesListClient({
  showHeader = false,
  showTodayShelf = true,
}: {
  showHeader?: boolean;
  showTodayShelf?: boolean;
}) {
  const { recipes, hydrated } = useRecipes();
  const {
    hydrated: todayHydrated,
    ids: todayIds,
    has: isTodaySelected,
    add: addToToday,
    remove: removeFromToday,
    clear,
    max: todayMax,
  } = useTodayCookbook();
  const [q, setQ] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState("全部");
  const [busy, setBusy] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);

  const categories = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const recipe of recipes) {
      counts.set(recipe.category, (counts.get(recipe.category) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"));
  }, [recipes]);

  const selectedRecipes = React.useMemo(() => {
    if (!todayIds.length) return [];
    const order = new Map(todayIds.map((id, i) => [id, i]));
    return recipes
      .filter((recipe) => order.has(recipe.id))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .slice(0, todayMax);
  }, [recipes, todayIds, todayMax]);

  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    return recipes.filter((recipe) => {
      if (activeCategory !== "全部" && recipe.category !== activeCategory) return false;
      if (!query) return true;
      const hay = [
        recipe.name,
        recipe.category,
        recipe.description,
        ...(recipe.tags ?? []),
        ...(recipe.mainIngredients ?? []).map((item) => item.name),
        ...(recipe.auxiliaryIngredients ?? []).map((item) => item.name),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [activeCategory, q, recipes]);

  const onClear = async () => {
    const ok = window.confirm("确认清空今日菜单？");
    if (!ok) return;
    await clear();
  };

  const onExport = async () => {
    if (!selectedRecipes.length) return;
    setBusy(true);
    setExportError(null);
    try {
      await exportTodayCookbookToPng(selectedRecipes);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "分享失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {showHeader ? (
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="pk-section-label">私房菜谱</div>
            <h1 className="pk-serif text-[30px] leading-tight">菜谱库</h1>
            <p className="text-[13px] leading-6 text-[color:var(--muted)]">
              {hydrated ? `${recipes.length} 道家常菜` : "读取本地菜谱"}
            </p>
          </div>
          <ButtonLink href="/recipes/new">新增</ButtonLink>
        </div>
      ) : null}

      {showTodayShelf ? (
        <section className="pk-panel p-3 pb-5 sm:p-4 sm:pb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <Badge tone="warm">今日菜单</Badge>
              <div className="text-[13px] leading-6 text-[color:var(--muted)]">
                {todayHydrated ? `${selectedRecipes.length}/${todayMax} 道` : "读取中"}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onClear}
                disabled={!todayHydrated || selectedRecipes.length === 0 || busy}
              >
                清空
              </Button>
              <Button
                size="sm"
                onClick={onExport}
                disabled={!todayHydrated || selectedRecipes.length === 0 || busy}
              >
                {busy ? "生成中" : "分享小票"}
              </Button>
            </div>
          </div>

          {exportError ? (
            <div className="mt-3 rounded-lg border border-[color:rgba(184,92,56,0.35)] bg-[color:rgba(184,92,56,0.10)] px-3 py-2 text-[12px] text-[color:var(--warm)]">
              {exportError}
            </div>
          ) : null}

          {selectedRecipes.length ? (
            <div className="pk-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1">
              {selectedRecipes.map((recipe) => {
                const image = recipe.images?.[0];
                return (
                  <div
                    key={recipe.id}
                    className="w-36 shrink-0 overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--paper-strong)] shadow-[0_1px_0_rgba(24,33,29,0.04)]"
                  >
                    <div className="aspect-[4/3] bg-[color:var(--wash)]">
                      {image ? (
                        <VisuallyLosslessThumb
                          src={recipeImageThumbUrl(image)}
                          fallbackSrc={recipeImageUrl(image)}
                          alt={recipe.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[12px] text-[color:var(--muted-2)]">
                          无图
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 p-2.5">
                      <div className="pk-serif line-clamp-2 min-h-[2rem] text-[13px] leading-4">
                        {recipe.name}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-full text-[12px]"
                        disabled={busy}
                        onClick={() => void removeFromToday(recipe.id)}
                      >
                        移除
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-[13px] leading-6 text-[color:var(--muted)]">
              还没定下来，先从下面挑两三道。
            </p>
          )}
        </section>
      ) : null}

      <div className="sticky top-14 z-20 -mx-4 space-y-3 border-y border-[color:var(--line)] bg-[color:var(--background)]/94 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:rounded-lg sm:border sm:bg-[color:var(--paper)]/88 sm:p-3 sm:shadow-[var(--shadow-soft)]">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索菜名、食材、标签"
        />
        <div className="pk-scrollbar flex gap-2 overflow-x-auto pb-0.5">
          <button
            type="button"
            className={cn(
              "h-9 shrink-0 rounded-lg border px-3 text-[13px] transition-colors",
              activeCategory === "全部"
                ? "border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]"
                : "border-[color:var(--line)] bg-[color:var(--paper)] text-[color:var(--muted)]",
            )}
            onClick={() => setActiveCategory("全部")}
          >
            全部 {recipes.length}
          </button>
          {categories.map(([category, count]) => (
            <button
              key={category}
              type="button"
              className={cn(
                "h-9 shrink-0 rounded-lg border px-3 text-[13px] transition-colors",
                activeCategory === category
                  ? "border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]"
                  : "border-[color:var(--line)] bg-[color:var(--paper)] text-[color:var(--muted)]",
              )}
              onClick={() => setActiveCategory(category)}
            >
              {category} {count}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 text-[12px] text-[color:var(--muted-2)]">
          <span>{hydrated ? `${filtered.length} 道菜` : "读取中"}</span>
          {activeCategory !== "全部" || q.trim() ? (
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[color:var(--foreground)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              onClick={() => {
                setQ("");
                setActiveCategory("全部");
              }}
            >
              重置
            </button>
          ) : null}
        </div>
      </div>

      {!hydrated ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="h-64 animate-pulse rounded-lg border border-[color:var(--line)] bg-black/[0.04] dark:bg-white/[0.06]"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="pk-panel-plain p-8 text-center">
          <div className="mx-auto max-w-md space-y-3">
            <Badge tone="muted">空</Badge>
            <p className="text-[14px] leading-7 text-[color:var(--muted)]">
              没有匹配的菜谱。
            </p>
            <Link
              href="/recipes/new"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[color:var(--line)] bg-[color:var(--paper-strong)] px-4 text-[13px] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
            >
              新增菜谱
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((recipe) => {
            const selected = isTodaySelected(recipe.id);
            return (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                showTodayAction
                todaySelected={selected}
                onTodayAction={
                  selected || todayIds.length >= todayMax
                    ? undefined
                    : () => {
                        void addToToday(recipe.id);
                      }
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

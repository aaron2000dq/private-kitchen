"use client";

import * as React from "react";
import Link from "next/link";
import type { Recipe } from "@/lib/recipes/types";
import { useRecipes } from "@/lib/recipes/useRecipes";
import { RecipeRepository } from "@/lib/recipes/repository";
import { reclassifyRecipe, RecipeCategories, type RecipeCategory } from "@/lib/recipes/classify";
import { formatRecipeIngredientsPreview } from "@/lib/recipes/formatIngredientsPreview";
import { recipeImageThumbUrl, recipeImageUrl } from "@/lib/recipes/recipeImageUrl";
import { recipeDetailHref } from "@/lib/recipes/recipeRoutes";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useTodayCookbook } from "@/lib/today/useTodayCookbook";
import { RecipeCard } from "@/components/recipes/RecipeCard";
import { VisuallyLosslessThumb } from "@/components/recipes/VisuallyLosslessThumb";

type CategoryCount = {
  name: RecipeCategory;
  count: number;
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function isRecipeCategory(value: string): value is RecipeCategory {
  return (RecipeCategories as readonly string[]).includes(value);
}

function searchRecipes(recipes: Recipe[], rawQuery: string) {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return recipes;

  return recipes.filter((recipe) => {
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
}

function randomItem<T>(items: T[]) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

function categoryMark(category: RecipeCategory) {
  const marks: Record<RecipeCategory, string> = {
    家常菜: "家",
    煎炸烧烤: "烤",
    煲仔: "煲",
    粥面粉: "粉",
    素菜: "蔬",
    汤羹: "汤",
    海鲜: "鲜",
    西餐: "西",
    火锅: "锅",
  };
  return marks[category];
}

function RatingStars({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={rating ? `评分 ${rating}` : "未评分"}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className={cn(
            "text-[11px] leading-none",
            index < rounded ? "text-[color:var(--accent-2)]" : "text-black/15 dark:text-white/18",
          )}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isDesktop;
}

export function CategoriesClientSelect() {
  const { recipes, hydrated, update, refresh } = useRecipes();
  const isDesktop = useIsDesktop();
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState<string>("全部");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const {
    hydrated: todayHydrated,
    ids: todayIds,
    has: isTodaySelected,
    add: addToToday,
    max: todayMax,
  } = useTodayCookbook();

  const searchFiltered = React.useMemo(() => searchRecipes(recipes, q), [q, recipes]);

  const categories = React.useMemo<CategoryCount[]>(() => {
    const counts = new Map<RecipeCategory, number>();
    for (const recipe of searchFiltered) {
      const c = recipe.category?.trim();
      if (!isRecipeCategory(c)) continue;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return RecipeCategories.map((name) => ({ name, count: counts.get(name) ?? 0 })).filter(
      (category) => category.count > 0,
    );
  }, [searchFiltered]);

  React.useEffect(() => {
    if (active === "全部") return;
    if (!categories.length) return;
    if (!categories.some((category) => category.name === active)) {
      setActive("全部");
    }
  }, [active, categories]);

  const filtered = React.useMemo(() => {
    if (active === "全部") return searchFiltered;
    return searchFiltered.filter((recipe) => recipe.category === active);
  }, [active, searchFiltered]);

  const shelfActiveCategory = React.useMemo<RecipeCategory | null>(() => {
    if (isRecipeCategory(active) && categories.some((category) => category.name === active)) {
      return active;
    }
    return categories[0]?.name ?? null;
  }, [active, categories]);

  const shelfRecipes = React.useMemo(() => {
    if (!shelfActiveCategory) return [];
    return searchFiltered.filter((recipe) => recipe.category === shelfActiveCategory);
  }, [searchFiltered, shelfActiveCategory]);

  const onReclassify = async () => {
    setMsg(null);
    setBusy(true);
    try {
      const next = recipes.map(reclassifyRecipe);
      await RecipeRepository.replaceMany(next);
      await refresh();
      setMsg("已按新分类规则重新整理。");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "重新分类失败");
    } finally {
      setBusy(false);
    }
  };

  const onCategoryChange = async (recipeId: string, nextCat: RecipeCategory) => {
    try {
      await update(recipeId, { category: nextCat });
      setMsg(`已移动到 ${nextCat}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "修改分类失败");
    }
  };

  const onRandomPick = async () => {
    if (!todayHydrated || todayIds.length >= todayMax) return;
    const pick = randomItem(shelfRecipes.filter((recipe) => !isTodaySelected(recipe.id)));
    if (!pick) return;
    await addToToday(pick.id);
  };

  return (
    <div className="space-y-8">
      {!isDesktop ? (
        <MobileCategoryShelf
          hydrated={hydrated}
          recipes={recipes}
          q={q}
          setQ={setQ}
          categories={categories}
          shelfActiveCategory={shelfActiveCategory}
          shelfRecipes={shelfRecipes}
          msg={msg}
          busy={busy}
          todayHydrated={todayHydrated}
          todayCount={todayIds.length}
          todayMax={todayMax}
          canRandomPick={
            todayHydrated &&
            todayIds.length < todayMax &&
            shelfRecipes.some((recipe) => !isTodaySelected(recipe.id))
          }
          onCategorySelect={setActive}
          onReclassify={() => {
            void onReclassify();
          }}
          onRandomPick={() => {
            void onRandomPick();
          }}
          onAddRecipe={(id) => {
            void addToToday(id);
          }}
          onCategoryChange={(id, nextCat) => {
            void onCategoryChange(id, nextCat);
          }}
          isTodaySelected={isTodaySelected}
        />
      ) : null}

      {isDesktop ? (
        <div className="space-y-8">
          <DesktopCategoryHeader
            q={q}
            setQ={setQ}
          hydrated={hydrated}
          busy={busy}
          msg={msg}
          onReclassify={onReclassify}
        />

        <DesktopCategoryFilters
          active={active}
          setActive={setActive}
          categories={categories}
          resultCount={filtered.length}
          hydrated={hydrated}
        />

        <DesktopCategoryGrid
          hydrated={hydrated}
          recipes={filtered}
          todayIds={todayIds}
          todayMax={todayMax}
          isTodaySelected={isTodaySelected}
          onAddRecipe={(id) => {
            void addToToday(id);
          }}
          onCategoryChange={onCategoryChange}
          msgSetter={setMsg}
        />
      </div>
      ) : null}
    </div>
  );
}

function MobileCategoryShelf({
  hydrated,
  recipes,
  q,
  setQ,
  categories,
  shelfActiveCategory,
  shelfRecipes,
  msg,
  busy,
  todayHydrated,
  todayCount,
  todayMax,
  canRandomPick,
  onCategorySelect,
  onReclassify,
  onRandomPick,
  onAddRecipe,
  onCategoryChange,
  isTodaySelected,
}: {
  hydrated: boolean;
  recipes: Recipe[];
  q: string;
  setQ: (value: string) => void;
  categories: CategoryCount[];
  shelfActiveCategory: RecipeCategory | null;
  shelfRecipes: Recipe[];
  msg: string | null;
  busy: boolean;
  todayHydrated: boolean;
  todayCount: number;
  todayMax: number;
  canRandomPick: boolean;
  onCategorySelect: (category: RecipeCategory) => void;
  onReclassify: () => void;
  onRandomPick: () => void;
  onAddRecipe: (id: string) => void;
  onCategoryChange: (id: string, nextCat: RecipeCategory) => void;
  isTodaySelected: (id: string) => boolean;
}) {
  return (
    <div className="md:hidden">
      <section className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] top-14 z-20 flex flex-col overflow-hidden border-y border-[color:var(--line)] bg-[color:var(--paper)] shadow-[var(--shadow-soft)]">
        <div className="shrink-0 space-y-4 p-4">
          <div className="flex items-start gap-3">
            <div className="pk-serif grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-[color:var(--menu-line)] bg-[linear-gradient(135deg,rgba(63,111,85,0.10),rgba(185,148,75,0.16))] text-[16px] text-[color:var(--accent)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]">
              私厨
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <Badge tone="accent" className="shrink-0">
                  Lv.2
                </Badge>
                <h1 className="pk-serif truncate text-[22px] leading-8">
                  私人厨房
                </h1>
              </div>
              <p className="mt-1 text-[12px] leading-5 text-[color:var(--muted)]">
                {hydrated ? `共 ${recipes.length} 道 · 今日 ${todayCount}/${todayMax}` : "读取本地菜谱"}
              </p>
            </div>
            <Link
              href="/recipes/new"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-[color:rgba(63,111,85,0.32)] bg-[color:var(--paper-strong)] px-3 text-[13px] font-medium text-[color:var(--accent)] shadow-[0_1px_0_rgba(24,33,29,0.04)]"
            >
              添加
            </Link>
          </div>

          <div className="flex items-center justify-between border-b border-[color:var(--line)] pb-1">
            <div className="flex items-center gap-6">
              <span className="relative pb-2 text-[17px] font-semibold">
                点单
                <span className="absolute bottom-0 left-0 h-0.5 w-8 rounded-full bg-[color:var(--accent)]" />
              </span>
              <button
                type="button"
                className="min-h-9 rounded-lg px-2 pb-2 text-[15px] text-[color:var(--muted)] disabled:opacity-45"
                disabled={!hydrated || busy}
                onClick={onReclassify}
              >
                整理
              </button>
            </div>
            <span className="pb-2 text-[12px] text-[color:var(--muted-2)]">
              {hydrated ? `${categories.length} 类` : "读取中"}
            </span>
          </div>

          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索菜名、食材、标签"
            className="h-10 bg-[color:var(--wash)]/65"
          />

          {msg ? (
            <div className="rounded-lg border border-[color:rgba(63,111,85,0.18)] bg-[color:rgba(63,111,85,0.08)] px-3 py-2 text-[12px] text-[color:var(--muted)]">
              {msg}
            </div>
          ) : null}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[104px_minmax(0,1fr)] overflow-hidden border-t border-[color:var(--line)]">
          <aside className="min-h-0 overflow-y-auto border-r border-[color:var(--line)] bg-[color:var(--wash)]/50 pb-28">
            {categories.length ? (
              categories.map((category) => {
                const active = shelfActiveCategory === category.name;
                return (
                  <button
                    key={category.name}
                    type="button"
                    className={cn(
                      "relative block w-full px-3 py-3 text-left transition-colors",
                      active
                        ? "bg-[color:var(--paper-strong)] text-[color:var(--foreground)]"
                        : "text-[color:var(--muted)] hover:bg-[color:var(--paper)]/70",
                    )}
                    onClick={() => onCategorySelect(category.name)}
                  >
                    {active ? (
                      <span className="absolute left-0 top-3 h-9 w-1 rounded-r-full bg-[color:var(--accent)]" />
                    ) : null}
                    <span
                      className={cn(
                        "mb-1 inline-grid h-7 w-7 place-items-center rounded-md border text-[12px] font-semibold",
                        active
                          ? "border-[color:rgba(63,111,85,0.28)] bg-[color:rgba(63,111,85,0.12)] text-[color:var(--accent)]"
                          : "border-[color:var(--line)] bg-[color:var(--paper)] text-[color:var(--muted)]",
                      )}
                      aria-hidden
                    >
                      {categoryMark(category.name)}
                    </span>
                    <span className="pk-serif block truncate text-[14px] leading-5">
                      {category.name}
                    </span>
                    <span className="block text-[11px] leading-4 text-[color:var(--muted-2)]">
                      {category.count} 道
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-[12px] leading-5 text-[color:var(--muted-2)]">暂无分类</div>
            )}
            <Link
              href="/categories"
              className="mx-3 mt-2 block rounded-lg border border-[color:rgba(63,111,85,0.24)] bg-[color:var(--paper)] px-2.5 py-2 text-[12px] text-[color:var(--accent)]"
            >
              分类管理
            </Link>
          </aside>

          <main className="min-h-0 overflow-y-auto bg-[color:var(--paper-strong)] pb-28">
            <div className="sticky top-0 z-10 border-b border-[color:var(--line)] bg-[color:var(--paper-strong)]/95 px-3 py-3 backdrop-blur">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="pk-serif truncate text-[20px] leading-7">
                    {shelfActiveCategory ?? "暂无分类"}
                  </h2>
                  <p className="text-[11px] leading-4 text-[color:var(--muted-2)]">
                    {hydrated ? `${shelfRecipes.length} 道可选` : "读取中"}
                  </p>
                </div>
                {q.trim() ? (
                  <button
                    type="button"
                    className="shrink-0 rounded-md px-2 py-1 text-[12px] text-[color:var(--accent)]"
                    onClick={() => setQ("")}
                  >
                    清除
                  </button>
                ) : null}
              </div>
            </div>

            {!hydrated ? (
              <div className="divide-y divide-[color:var(--line)] px-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="flex animate-pulse gap-3 py-3">
                    <div className="h-[76px] w-[76px] rounded-lg bg-black/[0.06] dark:bg-white/[0.08]" />
                    <div className="min-w-0 flex-1 space-y-2 py-1">
                      <div className="h-4 w-28 rounded bg-black/[0.06] dark:bg-white/[0.08]" />
                      <div className="h-3 w-20 rounded bg-black/[0.05] dark:bg-white/[0.07]" />
                      <div className="h-3 w-full rounded bg-black/[0.05] dark:bg-white/[0.07]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : shelfRecipes.length ? (
              <div className="divide-y divide-[color:var(--line)] px-3">
                {shelfRecipes.map((recipe) => (
                  <ShelfRecipeRow
                    key={recipe.id}
                    recipe={recipe}
                    selected={isTodaySelected(recipe.id)}
                    canAdd={todayHydrated && todayCount < todayMax}
                    onAdd={() => onAddRecipe(recipe.id)}
                    onCategoryChange={(nextCat) => onCategoryChange(recipe.id, nextCat)}
                  />
                ))}
              </div>
            ) : (
              <div className="px-5 py-14 text-center">
                <Badge tone="muted">空</Badge>
                <p className="mt-3 text-[13px] leading-6 text-[color:var(--muted)]">
                  这个分类暂时没有内容。
                </p>
                <Link
                  href="/recipes/new"
                  className="mt-3 inline-flex h-10 items-center justify-center rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)] px-4 text-[13px]"
                >
                  新增菜谱
                </Link>
              </div>
            )}
          </main>
        </div>
      </section>

      <div className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 md:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-2 rounded-lg border border-[color:var(--menu-line-soft)] bg-[color:var(--paper)]/96 p-2 shadow-[0_12px_28px_rgba(24,33,29,0.16)] backdrop-blur">
          <Link
            href="/"
            className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 text-left text-[13px] text-[color:var(--foreground)]"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:rgba(63,111,85,0.12)] text-[color:var(--accent)]">
              菜
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium">今日菜单</span>
              <span className="block text-[11px] text-[color:var(--muted-2)]">
                {todayHydrated ? `${todayCount}/${todayMax} 道` : "读取中"}
              </span>
            </span>
          </Link>
          <button
            type="button"
            className="h-10 shrink-0 rounded-lg border border-[color:rgba(63,111,85,0.32)] px-3 text-[13px] font-medium text-[color:var(--accent)] disabled:opacity-45"
            disabled={!canRandomPick || busy}
            onClick={onRandomPick}
          >
            随机选菜
          </button>
          <Link
            href="/"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-[color:var(--foreground)] px-4 text-[13px] font-medium text-[color:var(--background)]"
          >
            查看
          </Link>
        </div>
      </div>
    </div>
  );
}

function ShelfRecipeRow({
  recipe,
  selected,
  canAdd,
  onAdd,
  onCategoryChange,
}: {
  recipe: Recipe;
  selected: boolean;
  canAdd: boolean;
  onAdd: () => void;
  onCategoryChange: (nextCat: RecipeCategory) => void;
}) {
  const image = recipe.images?.[0];
  const ingredientsPreview = formatRecipeIngredientsPreview(recipe, 2, 1);

  return (
    <article className="flex items-center gap-2 py-3">
      <Link
        href={recipeDetailHref(recipe.id)}
        className="flex min-w-0 flex-1 gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
      >
        <div className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-lg bg-[color:var(--wash)]">
          {image ? (
            <VisuallyLosslessThumb
              src={recipeImageThumbUrl(image)}
              fallbackSrc={recipeImageUrl(image)}
              alt={recipe.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] text-[color:var(--muted-2)]">
              无图
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 py-0.5">
          <h3 className="truncate text-[15px] font-semibold leading-5 text-[color:var(--foreground)]">
            {recipe.name}
          </h3>
          <div className="mt-1 flex items-center gap-1.5">
            <RatingStars rating={recipe.rating} />
            <span className="text-[12px] text-[color:var(--muted)]">
              {recipe.rating ? recipe.rating.toFixed(1) : "新菜"}
            </span>
          </div>
          {ingredientsPreview ? (
            <p className="mt-1 line-clamp-1 text-[11px] leading-4 text-[color:var(--muted-2)]">
              {ingredientsPreview}
            </p>
          ) : (
            <p className="mt-1 text-[11px] leading-4 text-[color:var(--muted-2)]">待补充食材</p>
          )}
          <p className="mt-1 text-[10px] leading-4 text-[color:var(--muted-2)]">
            更新 {formatDate(recipe.updatedAt)}
          </p>
        </div>
      </Link>

      <div className="flex w-[48px] shrink-0 flex-col items-end gap-2">
        <button
          type="button"
          className={cn(
            "grid h-9 w-9 place-items-center rounded-full text-[16px] font-semibold leading-none transition-colors",
            selected
              ? "border border-[color:rgba(63,111,85,0.28)] bg-[color:rgba(63,111,85,0.12)] text-[color:var(--accent)]"
              : "bg-[color:var(--accent)] text-white shadow-[var(--shadow-soft)]",
            !selected && !canAdd ? "opacity-45" : "",
          )}
          disabled={selected || !canAdd}
          aria-label={selected ? "已加入今日菜单" : `加入今日菜单：${recipe.name}`}
          onClick={onAdd}
        >
          {selected ? "已" : "+"}
        </button>
        <label className="sr-only" htmlFor={`category-${recipe.id}`}>
          修改分类
        </label>
        <select
          id={`category-${recipe.id}`}
          value={recipe.category}
          className="h-9 w-12 rounded-md border border-[color:var(--line)] bg-[color:var(--paper)] px-1 text-[11px] text-[color:var(--muted)]"
          onChange={(e) => {
            const next = e.target.value;
            if (!isRecipeCategory(next)) return;
            if (next === recipe.category) return;
            onCategoryChange(next);
          }}
        >
          {RecipeCategories.map((category) => (
            <option key={category} value={category}>
              {categoryMark(category)}
            </option>
          ))}
        </select>
      </div>
    </article>
  );
}

function DesktopCategoryHeader({
  q,
  setQ,
  hydrated,
  busy,
  msg,
  onReclassify,
}: {
  q: string;
  setQ: (value: string) => void;
  hydrated: boolean;
  busy: boolean;
  msg: string | null;
  onReclassify: () => void;
}) {
  return (
    <div className="pk-panel p-5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <div className="pk-section-label">分类货架</div>
        <h1 className="pk-serif text-[28px] tracking-wide">分类</h1>
        <p className="text-[13px] leading-6 text-[color:var(--muted)]">
          按类别聚合，你会更容易找到想做的那一道。
        </p>
      </div>
      <div className="flex flex-col gap-2 md:items-end">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索：菜名 / 食材 / 标签"
          className="md:max-w-sm"
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onReclassify} disabled={!hydrated || busy}>
            {busy ? "整理中..." : "按新规则重新分类"}
          </Button>
          {msg ? <span className="text-[12px] text-[color:var(--muted-2)]">{msg}</span> : null}
        </div>
      </div>
      </div>
    </div>
  );
}

function DesktopCategoryFilters({
  active,
  setActive,
  categories,
  resultCount,
  hydrated,
}: {
  active: string;
  setActive: (value: string) => void;
  categories: CategoryCount[];
  resultCount: number;
  hydrated: boolean;
}) {
  return (
    <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)]/90 px-3 py-3 shadow-[var(--shadow-soft)] backdrop-blur">
      <button
        type="button"
        onClick={() => setActive("全部")}
        className={cn(
          "rounded-full border px-3 py-1.5 text-[12px] transition-colors",
          active === "全部"
            ? "border-[color:rgba(107,142,107,0.35)] bg-[color:rgba(107,142,107,0.10)] text-[color:var(--foreground)]"
            : "border-[color:var(--line)] text-[color:var(--muted)] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
        )}
      >
        全部
      </button>
      {categories.map((category) => (
        <button
          key={category.name}
          type="button"
          onClick={() => setActive(category.name)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-[12px] transition-colors",
            active === category.name
              ? "border-[color:rgba(107,142,107,0.35)] bg-[color:rgba(107,142,107,0.10)] text-[color:var(--foreground)]"
              : "border-[color:var(--line)] text-[color:var(--muted)] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
          )}
        >
          {category.name} {category.count}
        </button>
      ))}
      <div className="ml-auto text-[12px] text-[color:var(--muted-2)]">
        {hydrated ? `${resultCount} 道菜` : "读取中..."}
      </div>
    </div>
  );
}

function DesktopCategoryGrid({
  hydrated,
  recipes,
  todayIds,
  todayMax,
  isTodaySelected,
  onAddRecipe,
  onCategoryChange,
  msgSetter,
}: {
  hydrated: boolean;
  recipes: Recipe[];
  todayIds: string[];
  todayMax: number;
  isTodaySelected: (id: string) => boolean;
  onAddRecipe: (id: string) => void;
  onCategoryChange: (id: string, nextCat: RecipeCategory) => Promise<void>;
  msgSetter: (msg: string | null) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {hydrated && recipes.length === 0 ? (
        <div className="pk-panel-plain p-10 text-center md:col-span-2 xl:col-span-3">
          <Badge tone="muted">空</Badge>
          <p className="mt-3 text-[13px] leading-7 text-[color:var(--muted)]">
            这个分类暂时没有内容。
          </p>
        </div>
      ) : null}

      {recipes.map((recipe) => {
        const selected = isTodaySelected(recipe.id);
        const canAdd = !selected && todayIds.length < todayMax;
        return (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            showTodayAction
            todaySelected={selected}
            onTodayAction={canAdd ? () => onAddRecipe(recipe.id) : undefined}
            categoryEditable
            categoryOptions={[...RecipeCategories]}
            onCategoryChange={async (nextCat) => {
              if (!isRecipeCategory(nextCat)) return;
              try {
                await onCategoryChange(recipe.id, nextCat);
              } catch (e) {
                msgSetter(e instanceof Error ? e.message : "修改分类失败");
              }
            }}
          />
        );
      })}
    </div>
  );
}

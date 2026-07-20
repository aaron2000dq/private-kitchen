"use client";

import * as React from "react";
import { AppLink as Link } from "@/components/ui/AppLink";
import type { Recipe } from "@/lib/recipes/types";
import { useRecipes } from "@/lib/recipes/useRecipes";
import { useCookHistory } from "@/lib/today/useCookHistory";
import { useKitchenPrepProgress } from "@/lib/today/useKitchenPrepProgress";
import { useTodayCookbook } from "@/lib/today/useTodayCookbook";
import { exportTodayCookbookToPng } from "@/lib/today/exportTodayCookbookToImage";
import { recipeImageThumbUrl, recipeImageUrl } from "@/lib/recipes/recipeImageUrl";
import { MEAL_ROLE_META, mealRoleOf, type MealRole } from "@/lib/recipes/mealRole";
import { recipeDetailHref } from "@/lib/recipes/recipeRoutes";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { RecipeCard } from "@/components/recipes/RecipeCard";
import { VisuallyLosslessThumb } from "@/components/recipes/VisuallyLosslessThumb";
import {
  MENU_PLAN_PRESETS,
  MenuPlanScene,
  buildTodayMenuInsights,
  pickBalancedTodayMenu,
} from "@/lib/today/menuInsights";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type KitchenGuideMode = "shopping" | "prep";

const FILL_ROLE_PRIORITY: MealRole[] = ["main", "vegetable", "soup", "staple", "small"];

function formatCookedDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "最近";
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function fillSuggestionReason(role: MealRole): string {
  if (role === "main") return "补一道撑场面的主菜";
  if (role === "vegetable") return "给这桌留一口清爽";
  if (role === "soup") return "收住烟火气";
  if (role === "staple") return "把这一餐压稳";
  if (role === "small") return "添一点开胃小食";
  return "让菜单更完整";
}

function menuFillScore(
  candidate: Recipe,
  wantedRole: MealRole,
  selectedRecipes: Recipe[],
  recentIds: Set<string>,
): number {
  const role = mealRoleOf(candidate);
  const roleScore = role === wantedRole ? 90 : role === "home" ? 8 : 18;
  const imageScore = candidate.images?.length ? 5 : 0;
  const ratingScore = (candidate.rating ?? 0) * 2.5;
  const categoryScore = selectedRecipes.some((recipe) => recipe.category === candidate.category) ? 1 : 5;
  const recentPenalty = recentIds.has(candidate.id) ? -22 : 0;
  return roleScore + imageScore + ratingScore + categoryScore + recentPenalty;
}

function buildMenuFillSuggestions(
  recipes: Recipe[],
  selectedRecipes: Recipe[],
  recentRecipeIds: string[],
  max = 3,
): Recipe[] {
  const selectedIds = new Set(selectedRecipes.map((recipe) => recipe.id));
  const selectedRoles = new Set(selectedRecipes.map(mealRoleOf));
  const recentIds = new Set(recentRecipeIds);
  const missingRoles = FILL_ROLE_PRIORITY.filter((role) => !selectedRoles.has(role));
  const picked: Recipe[] = [];
  const pickedIds = new Set<string>();

  for (const role of missingRoles) {
    if (picked.length >= max) break;
    const best = recipes
      .filter((recipe) => !selectedIds.has(recipe.id) && !pickedIds.has(recipe.id) && mealRoleOf(recipe) === role)
      .sort((a, b) => menuFillScore(b, role, selectedRecipes, recentIds) - menuFillScore(a, role, selectedRecipes, recentIds))[0];
    if (!best) continue;
    picked.push(best);
    pickedIds.add(best.id);
  }

  for (const role of FILL_ROLE_PRIORITY) {
    if (picked.length >= max) break;
    const best = recipes
      .filter((recipe) => !selectedIds.has(recipe.id) && !pickedIds.has(recipe.id))
      .sort((a, b) => menuFillScore(b, role, selectedRecipes, recentIds) - menuFillScore(a, role, selectedRecipes, recentIds))[0];
    if (!best) continue;
    picked.push(best);
    pickedIds.add(best.id);
  }

  return picked.slice(0, max);
}

function menuSwapScore(
  candidate: Recipe,
  original: Recipe,
  selectedRecipes: Recipe[],
  recentIds: Set<string>,
): number {
  const candidateRole = mealRoleOf(candidate);
  const originalRole = mealRoleOf(original);
  const roleScore = candidateRole === originalRole ? 90 : candidateRole === "home" ? 6 : 22;
  const imageScore = candidate.images?.length ? 5 : 0;
  const ratingScore = (candidate.rating ?? 0) * 2.5;
  const categoryScore = candidate.category === original.category ? 2 : 5;
  const recentPenalty = recentIds.has(candidate.id) ? -22 : 0;
  const duplicateRolePenalty = selectedRecipes.some(
    (recipe) => recipe.id !== original.id && mealRoleOf(recipe) === candidateRole,
  )
    ? -4
    : 0;

  return roleScore + imageScore + ratingScore + categoryScore + recentPenalty + duplicateRolePenalty;
}

function pickSwapCandidate(
  recipes: Recipe[],
  selectedRecipes: Recipe[],
  original: Recipe,
  recentRecipeIds: string[],
): Recipe | null {
  const selectedIds = new Set(selectedRecipes.map((recipe) => recipe.id));
  const recentIds = new Set(recentRecipeIds);
  const originalRole = mealRoleOf(original);
  const candidates = recipes
    .filter((recipe) => !selectedIds.has(recipe.id))
    .map((recipe) => ({ recipe, score: menuSwapScore(recipe, original, selectedRecipes, recentIds) }))
    .sort((a, b) => b.score - a.score || a.recipe.name.localeCompare(b.recipe.name, "zh-CN"));

  const sameRoleTop = candidates.filter((entry) => mealRoleOf(entry.recipe) === originalRole).slice(0, 6);
  const pool = sameRoleTop.length ? sameRoleTop : candidates.slice(0, 6);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)]?.recipe ?? null;
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
    replace,
    clear,
    max: todayMax,
  } = useTodayCookbook();
  const {
    hydrated: historyHydrated,
    entries: historyEntries,
    recentRecipeIds,
    recentWindowDays,
    record: recordCooked,
  } = useCookHistory();
  const [q, setQ] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState("全部");
  const [busy, setBusy] = React.useState(false);
  const [recordBusy, setRecordBusy] = React.useState(false);
  const [fillBusyId, setFillBusyId] = React.useState<string | null>(null);
  const [swapBusyId, setSwapBusyId] = React.useState<string | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [menuTip, setMenuTip] = React.useState<string | null>(null);
  const [planScene, setPlanScene] = React.useState<MenuPlanScene>("balanced");
  const [guideMode, setGuideMode] = React.useState<KitchenGuideMode>("shopping");

  const planScenes = React.useMemo(
    () =>
      ([
        ["balanced", "家常", "6道"],
        ["quick", "快手", "4道"],
        ["banquet", "家宴", "8道"],
        ["light", "清爽", "5道"],
      ] as const).map(([key, shortLabel, count]) => ({
        key,
        shortLabel,
        count,
        label: MENU_PLAN_PRESETS[key].label,
      })),
    [],
  );

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

  const menuInsights = React.useMemo(
    () => buildTodayMenuInsights(selectedRecipes),
    [selectedRecipes],
  );
  const fillSuggestions = React.useMemo(() => {
    if (!selectedRecipes.length || selectedRecipes.length >= todayMax) return [];
    return buildMenuFillSuggestions(recipes, selectedRecipes, recentRecipeIds, Math.min(3, todayMax - selectedRecipes.length));
  }, [recipes, recentRecipeIds, selectedRecipes, todayMax]);
  const menuKey = React.useMemo(
    () => selectedRecipes.map((recipe) => recipe.id).join("|"),
    [selectedRecipes],
  );
  const prepProgress = useKitchenPrepProgress(menuKey, menuInsights.shoppingList);
  const latestHistory = historyEntries[0];
  const actionBusy = busy || recordBusy || fillBusyId != null || swapBusyId != null;
  const shoppingTotal = menuInsights.shoppingList.length;
  const shoppingPercent = shoppingTotal ? Math.round((prepProgress.doneCount / shoppingTotal) * 100) : 0;

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
    setMenuTip(null);
  };

  const onShuffleMenu = async () => {
    const picked = pickBalancedTodayMenu(recipes, todayMax, planScene, { recentRecipeIds });
    if (!picked.length) return;
    await replace(picked.map((recipe) => recipe.id));
    setExportError(null);
    setMenuTip(`已按「${MENU_PLAN_PRESETS[planScene].label}」${recentRecipeIds.length ? "避开近期重复，" : ""}配好 ${picked.length} 道：${picked.slice(0, 3).map((recipe) => recipe.name).join("、")}${picked.length > 3 ? "等" : ""}`);
  };

  const onRecordCooked = async () => {
    if (!selectedRecipes.length) return;
    setRecordBusy(true);
    setExportError(null);
    try {
      await recordCooked(selectedRecipes, planScene, menuInsights.score);
      setMenuTip(`已记入最近吃过：${selectedRecipes.slice(0, 3).map((recipe) => recipe.name).join("、")}${selectedRecipes.length > 3 ? "等" : ""}`);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "记录失败");
    } finally {
      setRecordBusy(false);
    }
  };

  const onCopyShoppingList = async () => {
    if (!menuInsights.shoppingList.length) return;
    setExportError(null);
    try {
      await navigator.clipboard.writeText(menuInsights.shoppingList.map((item) => `□ ${item}`).join("\n"));
      setMenuTip("采购清单已复制，可以直接发给家里人一起买。");
    } catch {
      setExportError("复制失败，可以直接截图这份采购清单。");
    }
  };

  const onAddFillSuggestion = async (recipe: Recipe) => {
    setFillBusyId(recipe.id);
    setExportError(null);
    try {
      const result = await addToToday(recipe.id);
      if (result.added) {
        setMenuTip(`已补上「${recipe.name}」：${fillSuggestionReason(mealRoleOf(recipe))}。`);
      } else if (result.ok) {
        setMenuTip(`「${recipe.name}」已经在今日菜单里。`);
      } else {
        setExportError("今日菜单已满，可以先移除一道再补。");
      }
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "加入失败");
    } finally {
      setFillBusyId(null);
    }
  };

  const onSwapRecipe = async (recipe: Recipe) => {
    const index = todayIds.indexOf(recipe.id);
    if (index < 0) return;

    setSwapBusyId(recipe.id);
    setExportError(null);
    try {
      const nextRecipe = pickSwapCandidate(recipes, selectedRecipes, recipe, recentRecipeIds);
      if (!nextRecipe) {
        setExportError("暂时没有可替换的菜。");
        return;
      }
      const nextIds = [...todayIds];
      nextIds[index] = nextRecipe.id;
      await replace(nextIds);
      setMenuTip(`已把「${recipe.name}」换成「${nextRecipe.name}」，仍然保留${MEAL_ROLE_META[mealRoleOf(nextRecipe)].label}位置。`);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "换菜失败");
    } finally {
      setSwapBusyId(null);
    }
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <Badge tone="warm">今日菜单</Badge>
              <div className="text-[13px] leading-6 text-[color:var(--muted)]">
                {todayHydrated ? `${selectedRecipes.length}/${todayMax} 道` : "读取中"}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
              <Button
                size="sm"
                variant="outline"
                onClick={onShuffleMenu}
                disabled={!todayHydrated || !hydrated || recipes.length === 0 || actionBusy}
              >
                配一桌
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onRecordCooked}
                disabled={!todayHydrated || selectedRecipes.length === 0 || actionBusy}
              >
                {recordBusy ? "记录中" : "记为吃过"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onClear}
                disabled={!todayHydrated || selectedRecipes.length === 0 || actionBusy}
              >
                清空
              </Button>
              <Button
                size="sm"
                onClick={onExport}
                disabled={!todayHydrated || selectedRecipes.length === 0 || actionBusy}
              >
                {busy ? "生成中" : "分享小票"}
              </Button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {planScenes.map((scene) => {
              const active = planScene === scene.key;
              return (
                <button
                  key={scene.key}
                  type="button"
                  aria-pressed={active}
                  className={cn(
                    "rounded-lg border px-2 py-2.5 text-left transition-[background-color,border-color,color,box-shadow]",
                    active
                      ? "border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)] shadow-[var(--shadow-soft)]"
                      : "border-[color:var(--menu-line-soft)] bg-[color:var(--paper)]/72 text-[color:var(--muted)]",
                  )}
                  title={scene.label}
                  onClick={() => {
                    setPlanScene(scene.key);
                    setMenuTip(null);
                  }}
                >
                  <span className="block text-[13px] font-medium leading-none">{scene.shortLabel}</span>
                  <span className="mt-1 block text-[11px] opacity-70">{scene.count}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[color:var(--menu-line-soft)] bg-[color:var(--paper)]/72 px-3 py-2.5">
            <div className="min-w-0">
              <div className="text-[11px] text-[color:var(--muted-2)]">最近吃过</div>
              <div className="mt-1 truncate text-[12px] text-[color:var(--muted)]">
                {historyHydrated && latestHistory
                  ? `${formatCookedDate(latestHistory.cookedAt)} · ${latestHistory.recipeNames.slice(0, 3).join("、")}${latestHistory.recipeNames.length > 3 ? "等" : ""}`
                  : "还没有记录"}
              </div>
            </div>
            <Badge tone={recentRecipeIds.length ? "accent" : "muted"}>
              {recentWindowDays}天避重 {recentRecipeIds.length}
            </Badge>
          </div>

          {exportError ? (
            <div className="mt-3 rounded-lg border border-[color:rgba(184,92,56,0.35)] bg-[color:rgba(184,92,56,0.10)] px-3 py-2 text-[12px] text-[color:var(--warm)]">
              {exportError}
            </div>
          ) : null}

          {menuTip ? (
            <div className="mt-3 rounded-lg border border-[color:rgba(63,111,85,0.24)] bg-[color:rgba(63,111,85,0.08)] px-3 py-2 text-[12px] leading-5 text-[color:var(--accent)]">
              {menuTip}
            </div>
          ) : null}

          <div className="mt-3 grid gap-2 sm:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--paper-strong)]/72 p-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-[11px] text-[color:var(--muted-2)]">菜单完成度</div>
                  <div className="pk-serif mt-1 text-[28px] leading-none text-[color:var(--accent)]">
                    {menuInsights.score}
                  </div>
                </div>
                <div className="text-right text-[12px] leading-5 text-[color:var(--muted)]">
                  {menuInsights.stats.map((stat) => (
                    <div key={stat.label}>
                      {stat.label} · {stat.value}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--paper-strong)]/72 p-3">
              <div className="flex flex-wrap gap-1.5">
                {menuInsights.missing.map((item) => (
                  <span
                    key={item}
                    className="rounded-md border border-[color:rgba(184,92,56,0.22)] bg-[color:rgba(184,92,56,0.07)] px-2 py-1 text-[11px] text-[color:var(--warm)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <div className="mt-2 line-clamp-1 text-[11px] text-[color:var(--muted-2)]">
                采购预览：
                {menuInsights.shoppingList.length
                  ? menuInsights.shoppingList.slice(0, 5).join("、")
                  : "选菜后自动整理"}
              </div>
            </div>
          </div>

          {fillSuggestions.length ? (
            <div className="mt-3 rounded-lg border border-[color:rgba(63,111,85,0.20)] bg-[color:rgba(63,111,85,0.06)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-[color:var(--muted-2)]">补齐建议</div>
                  <div className="pk-serif mt-1 text-[18px] leading-tight">让这桌更完整</div>
                </div>
                <Badge tone="accent">可补 {fillSuggestions.length}</Badge>
              </div>

              <div className="mt-3 grid gap-2">
                {fillSuggestions.map((recipe, index) => {
                  const image = recipe.images?.[0];
                  const role = mealRoleOf(recipe);
                  return (
                    <div
                      key={recipe.id}
                      className="grid grid-cols-[54px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)]/76 p-2"
                    >
                      <Link
                        href={recipeDetailHref(recipe.id)}
                        className="h-[54px] w-[54px] overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--wash)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                        aria-label={`打开菜谱：${recipe.name}`}
                      >
                        {image ? (
                          <VisuallyLosslessThumb
                            src={recipeImageThumbUrl(image)}
                            fallbackSrc={recipeImageUrl(image)}
                            alt={recipe.name}
                            loading={index === 0 ? "eager" : "lazy"}
                            fetchPriority={index === 0 ? "high" : "auto"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] text-[color:var(--muted-2)]">
                            无图
                          </div>
                        )}
                      </Link>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Badge tone={role === "vegetable" ? "accent" : "muted"} className="px-1.5 py-0.5 text-[10px]">
                            {MEAL_ROLE_META[role].label}
                          </Badge>
                          <span className="truncate text-[11px] text-[color:var(--muted-2)]">
                            {fillSuggestionReason(role)}
                          </span>
                        </div>
                        <Link
                          href={recipeDetailHref(recipe.id)}
                          className="pk-serif mt-1 block truncate text-[15px] leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                        >
                          {recipe.name}
                        </Link>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-[12px]"
                        disabled={!todayHydrated || actionBusy}
                        onClick={() => void onAddFillSuggestion(recipe)}
                      >
                        {fillBusyId === recipe.id ? "加入中" : "补上"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {selectedRecipes.length ? (
            <div className="mt-3 rounded-lg border border-[color:var(--line)] bg-[color:var(--paper-strong)]/76 p-3 shadow-[0_1px_0_rgba(24,33,29,0.04)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-[color:var(--muted-2)]">今晚执行台</div>
                  <div className="pk-serif mt-1 text-[18px] leading-tight">
                    {guideMode === "shopping" ? "采购清单" : "备菜节奏"}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[13px] font-medium text-[color:var(--accent)]">
                    {prepProgress.doneCount}/{shoppingTotal || 0}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[color:var(--muted-2)]">已备</div>
                </div>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color:rgba(24,33,29,0.08)]">
                <div
                  className="h-full rounded-full bg-[color:var(--accent)] transition-[width]"
                  style={{ width: `${shoppingPercent}%` }}
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {([
                  ["shopping", "采购", `${shoppingTotal || 0}项`],
                  ["prep", "备菜", `${menuInsights.timeline.length}步`],
                ] as const).map(([mode, label, meta]) => {
                  const active = guideMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={active}
                      className={cn(
                        "rounded-lg border px-3 py-2.5 text-left transition-colors",
                        active
                          ? "border-[color:rgba(63,111,85,0.34)] bg-[color:rgba(63,111,85,0.10)] text-[color:var(--accent)]"
                          : "border-[color:var(--menu-line-soft)] bg-[color:var(--paper)]/72 text-[color:var(--muted)]",
                      )}
                      onClick={() => setGuideMode(mode)}
                    >
                      <span className="block text-[13px] font-medium leading-none">{label}</span>
                      <span className="mt-1 block text-[11px] opacity-70">{meta}</span>
                    </button>
                  );
                })}
              </div>

              {guideMode === "shopping" ? (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="px-2 text-[12px]"
                      disabled={!shoppingTotal}
                      onClick={prepProgress.completeAll}
                    >
                      全备好
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="px-2 text-[12px]"
                      disabled={!shoppingTotal || prepProgress.doneCount === 0}
                      onClick={prepProgress.reset}
                    >
                      重置
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="px-2 text-[12px]"
                      disabled={!shoppingTotal}
                      onClick={onCopyShoppingList}
                    >
                      复制
                    </Button>
                  </div>

                  {menuInsights.shoppingList.length ? (
                    <div className="grid grid-cols-2 gap-2">
                      {menuInsights.shoppingList.map((item) => {
                        const checked = prepProgress.checkedItems.has(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            aria-label={`${checked ? "取消勾选" : "勾选"}${item}`}
                            aria-pressed={checked}
                            className={cn(
                              "flex min-h-12 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                              checked
                                ? "border-[color:rgba(63,111,85,0.30)] bg-[color:rgba(63,111,85,0.10)] text-[color:var(--accent)]"
                                : "border-[color:var(--menu-line-soft)] bg-[color:var(--paper)]/72 text-[color:var(--foreground)]",
                            )}
                            onClick={() => prepProgress.toggle(item)}
                          >
                            <span
                              className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none",
                                checked
                                  ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--background)]"
                                  : "border-[color:var(--menu-line)] text-transparent",
                              )}
                            >
                              {checked ? "✓" : ""}
                            </span>
                            <span className="line-clamp-2 min-w-0 text-[12px] leading-5">
                              {item}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-[color:var(--menu-line)] px-3 py-4 text-[12px] leading-5 text-[color:var(--muted)]">
                      这几道菜还没有整理出食材，编辑菜谱后会自动补进来。
                    </div>
                  )}
                </div>
              ) : (
                <ol className="mt-3 space-y-2">
                  {menuInsights.timeline.map((step) => (
                    <li
                      key={step.label}
                      className="grid grid-cols-[2.25rem_1fr] gap-2 rounded-lg border border-[color:var(--menu-line-soft)] bg-[color:var(--paper)]/72 px-3 py-3"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:rgba(185,148,75,0.42)] text-[11px] text-[color:var(--muted)]">
                        {step.label}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium leading-5">
                          {step.title}
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-5 text-[color:var(--muted)]">
                          {step.detail}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : null}

          {selectedRecipes.length ? (
            <div className="pk-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1">
              {selectedRecipes.map((recipe) => {
                const image = recipe.images?.[0];
                const role = mealRoleOf(recipe);
                return (
                  <div
                    key={recipe.id}
                    className="w-36 shrink-0 overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--paper-strong)] shadow-[0_1px_0_rgba(24,33,29,0.04)]"
                  >
                    <Link
                      href={recipeDetailHref(recipe.id)}
                      className="relative block aspect-[4/3] bg-[color:var(--wash)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                      aria-label={`打开菜谱：${recipe.name}`}
                    >
                      <span className="absolute left-2 top-2 z-10 rounded-md border border-[color:rgba(255,253,246,0.64)] bg-[color:var(--paper)]/88 px-1.5 py-0.5 text-[10px] leading-none text-[color:var(--foreground)] shadow-[0_6px_14px_rgba(24,33,29,0.10)] backdrop-blur">
                        {MEAL_ROLE_META[role].label}
                      </span>
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
                    </Link>
                    <div className="space-y-2 p-2.5">
                      <Link
                        href={recipeDetailHref(recipe.id)}
                        className="pk-serif line-clamp-2 min-h-[2rem] text-[13px] leading-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                      >
                        {recipe.name}
                      </Link>
                      <div className="grid grid-cols-2 gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 whitespace-nowrap px-1.5 text-[12px] leading-none"
                          disabled={actionBusy || !hydrated || recipes.length <= selectedRecipes.length}
                          onClick={() => void onSwapRecipe(recipe)}
                        >
                          {swapBusyId === recipe.id ? "换中" : "换一道"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 whitespace-nowrap px-1.5 text-[12px] leading-none"
                          disabled={actionBusy}
                          onClick={() => void removeFromToday(recipe.id)}
                        >
                          移除
                        </Button>
                      </div>
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

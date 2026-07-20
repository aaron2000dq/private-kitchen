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
  buildDinnerPrepPlan,
  buildTodayMenuInsights,
  pickBalancedTodayMenu,
} from "@/lib/today/menuInsights";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type KitchenGuideMode = "shopping" | "prep";
type TableMealRole = Exclude<MealRole, "home">;

const FILL_ROLE_PRIORITY: MealRole[] = ["main", "vegetable", "soup", "staple", "small"];
const TABLE_ROLE_ORDER: TableMealRole[] = ["main", "vegetable", "soup", "staple", "small"];
const LOCKED_MENU_KEY = "private-kitchen:locked-today-menu:v1";
const MENU_TEMPLATES_KEY = "private-kitchen:menu-templates:v1";
const DINNER_TIME_KEY = "private-kitchen:dinner-time:v1";
const MENU_TEMPLATE_LIMIT = 6;
const DINNER_TIME_OPTIONS = ["18:30", "19:00", "19:30", "20:00"];

const MENU_TABLE_SLOTS: Array<{
  key: TableMealRole;
  title: string;
  note: string;
  empty: string;
  tone: "accent" | "warm" | "muted";
}> = [
  { key: "main", title: "撑场主菜", note: "压住席面", empty: "缺一道硬菜", tone: "warm" },
  { key: "vegetable", title: "时蔬清口", note: "留一口清爽", empty: "缺一道蔬菜", tone: "accent" },
  { key: "soup", title: "汤羹暖碗", note: "收住烟火", empty: "缺一碗汤", tone: "muted" },
  { key: "staple", title: "主食点心", note: "把餐桌压稳", empty: "缺一道主食", tone: "muted" },
  { key: "small", title: "小食添兴", note: "让桌面更活", empty: "可添小食", tone: "muted" },
];

type MenuTemplate = {
  id: string;
  name: string;
  recipeIds: string[];
  recipeNames: string[];
  scene: MenuPlanScene;
  score: number;
  createdAt: string;
  updatedAt: string;
  usedAt?: string;
  useCount: number;
};

type MenuTemplateView = {
  template: MenuTemplate;
  validIds: string[];
  names: string[];
};

function templateSortValue(template: MenuTemplate) {
  return template.usedAt ?? template.updatedAt ?? template.createdAt;
}

function readLockedMenuIds(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(LOCKED_MENU_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function persistLockedMenuIds(ids: string[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(LOCKED_MENU_KEY, JSON.stringify(ids));
  } catch {
    // Locking is a convenience feature; menu actions should still work if storage is unavailable.
  }
}

function isMenuTemplate(value: unknown): value is MenuTemplate {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<MenuTemplate>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    Array.isArray(item.recipeIds) &&
    item.recipeIds.every((id) => typeof id === "string") &&
    Array.isArray(item.recipeNames) &&
    item.recipeNames.every((name) => typeof name === "string") &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  );
}

function readMenuTemplates(): MenuTemplate[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(MENU_TEMPLATES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isMenuTemplate)
      .map((template) => ({
        ...template,
        scene: template.scene in MENU_PLAN_PRESETS ? template.scene : "balanced",
        useCount: Number.isFinite(template.useCount) ? template.useCount : 0,
        score: Number.isFinite(template.score) ? template.score : 0,
      }))
      .sort((a, b) => templateSortValue(b).localeCompare(templateSortValue(a)))
      .slice(0, MENU_TEMPLATE_LIMIT);
  } catch {
    return [];
  }
}

function persistMenuTemplates(templates: MenuTemplate[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(MENU_TEMPLATES_KEY, JSON.stringify(templates.slice(0, MENU_TEMPLATE_LIMIT)));
  } catch {
    // Templates are local convenience data; the live menu should keep working if storage is unavailable.
  }
}

function readDinnerTime(): string {
  if (typeof window === "undefined") return "19:00";

  try {
    const raw = window.localStorage.getItem(DINNER_TIME_KEY);
    return raw && /^\d{1,2}:\d{2}$/.test(raw) ? raw : "19:00";
  } catch {
    return "19:00";
  }
}

function persistDinnerTime(time: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(DINNER_TIME_KEY, time);
  } catch {
    // Dinner time is only used for local planning; the menu remains usable without storage.
  }
}

function sameStringSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

function sameOrderedIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function tableRoleOf(recipe: Recipe): TableMealRole {
  const role = mealRoleOf(recipe);
  return role === "home" ? "small" : role;
}

function makeTemplateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `template_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function templateName(recipes: Recipe[], date = new Date()) {
  const first = recipes[0]?.name ?? "私房家宴";
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${first}一桌`;
}

function formatMenuTemplateScore(score: number) {
  return score > 0 ? `${score}分` : "未评分";
}

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

function buildRoleSlotSuggestions(
  recipes: Recipe[],
  selectedRecipes: Recipe[],
  recentRecipeIds: string[],
): Partial<Record<TableMealRole, Recipe>> {
  const selectedIds = new Set(selectedRecipes.map((recipe) => recipe.id));
  const selectedRoles = new Set(selectedRecipes.map(tableRoleOf));
  const recentIds = new Set(recentRecipeIds);
  const suggestions: Partial<Record<TableMealRole, Recipe>> = {};
  const suggestionIds = new Set<string>();

  for (const role of TABLE_ROLE_ORDER) {
    if (selectedRoles.has(role)) continue;
    const best = recipes
      .filter((recipe) => !selectedIds.has(recipe.id) && !suggestionIds.has(recipe.id) && tableRoleOf(recipe) === role)
      .sort((a, b) => menuFillScore(b, role, selectedRecipes, recentIds) - menuFillScore(a, role, selectedRecipes, recentIds))[0];
    if (!best) continue;
    suggestions[role] = best;
    suggestionIds.add(best.id);
  }

  return suggestions;
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

function buildMenuWithLockedRecipes(
  recipes: Recipe[],
  selectedRecipes: Recipe[],
  lockedIds: Set<string>,
  max: number,
  scene: MenuPlanScene,
  recentRecipeIds: string[],
): Recipe[] {
  const lockedRecipes = selectedRecipes.filter((recipe) => lockedIds.has(recipe.id));
  const targetCount = Math.min(
    max,
    recipes.length,
    Math.max(MENU_PLAN_PRESETS[scene].targetCount, lockedRecipes.length),
  );
  const kept = lockedRecipes.slice(0, targetCount);
  const keptIds = new Set(kept.map((recipe) => recipe.id));
  const remaining = recipes.filter((recipe) => !keptIds.has(recipe.id));
  const fillCount = Math.max(0, targetCount - kept.length);
  const picked = fillCount
    ? pickBalancedTodayMenu(remaining, fillCount, scene, {
        recentRecipeIds: recentRecipeIds.filter((id) => !keptIds.has(id)),
      })
    : [];

  return [...kept, ...picked].slice(0, max);
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
  const [templateBusyId, setTemplateBusyId] = React.useState<string | null>(null);
  const [lockedIds, setLockedIds] = React.useState<Set<string>>(() => new Set());
  const [locksHydrated, setLocksHydrated] = React.useState(false);
  const [menuTemplates, setMenuTemplates] = React.useState<MenuTemplate[]>([]);
  const [templatesHydrated, setTemplatesHydrated] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [menuTip, setMenuTip] = React.useState<string | null>(null);
  const [planScene, setPlanScene] = React.useState<MenuPlanScene>("balanced");
  const [guideMode, setGuideMode] = React.useState<KitchenGuideMode>("shopping");
  const [dinnerTime, setDinnerTime] = React.useState("19:00");
  const [dinnerTimeHydrated, setDinnerTimeHydrated] = React.useState(false);

  React.useEffect(() => {
    setLockedIds(new Set(readLockedMenuIds()));
    setLocksHydrated(true);
  }, []);

  React.useEffect(() => {
    setMenuTemplates(readMenuTemplates());
    setTemplatesHydrated(true);
  }, []);

  React.useEffect(() => {
    setDinnerTime(readDinnerTime());
    setDinnerTimeHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!locksHydrated) return;
    persistLockedMenuIds(Array.from(lockedIds));
  }, [lockedIds, locksHydrated]);

  React.useEffect(() => {
    if (!templatesHydrated) return;
    persistMenuTemplates(menuTemplates);
  }, [menuTemplates, templatesHydrated]);

  React.useEffect(() => {
    if (!dinnerTimeHydrated) return;
    persistDinnerTime(dinnerTime);
  }, [dinnerTime, dinnerTimeHydrated]);

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
  const recipeById = React.useMemo(
    () => new Map(recipes.map((recipe) => [recipe.id, recipe])),
    [recipes],
  );
  const lockedSelectedRecipes = React.useMemo(
    () => selectedRecipes.filter((recipe) => lockedIds.has(recipe.id)),
    [lockedIds, selectedRecipes],
  );
  const lockedSelectedCount = lockedSelectedRecipes.length;
  const menuTemplateViews = React.useMemo<MenuTemplateView[]>(
    () =>
      menuTemplates
        .map((template) => {
          const validIds = template.recipeIds.filter((id) => recipeById.has(id));
          const names = validIds.map((id) => recipeById.get(id)?.name ?? "").filter(Boolean);
          return { template, validIds, names };
        })
        .filter((view) => view.validIds.length > 0),
    [menuTemplates, recipeById],
  );

  React.useEffect(() => {
    if (!locksHydrated) return;
    setLockedIds((current) => {
      if (!current.size) return current;
      const valid = new Set(todayIds);
      const next = new Set(Array.from(current).filter((id) => valid.has(id)));
      return sameStringSet(current, next) ? current : next;
    });
  }, [locksHydrated, todayIds]);

  const menuInsights = React.useMemo(
    () => buildTodayMenuInsights(selectedRecipes),
    [selectedRecipes],
  );
  const dinnerPrepPlan = React.useMemo(
    () => buildDinnerPrepPlan(selectedRecipes, dinnerTime),
    [dinnerTime, selectedRecipes],
  );
  const fillSuggestions = React.useMemo(() => {
    if (!selectedRecipes.length || selectedRecipes.length >= todayMax) return [];
    return buildMenuFillSuggestions(recipes, selectedRecipes, recentRecipeIds, Math.min(3, todayMax - selectedRecipes.length));
  }, [recipes, recentRecipeIds, selectedRecipes, todayMax]);
  const roleSlotSuggestions = React.useMemo(
    () => buildRoleSlotSuggestions(recipes, selectedRecipes, recentRecipeIds),
    [recipes, recentRecipeIds, selectedRecipes],
  );
  const roleSlotSuggestionIds = React.useMemo(
    () =>
      new Set(
        Object.values(roleSlotSuggestions)
          .filter((recipe): recipe is Recipe => Boolean(recipe))
          .map((recipe) => recipe.id),
      ),
    [roleSlotSuggestions],
  );
  const visibleFillSuggestions = React.useMemo(
    () => fillSuggestions.filter((recipe) => !roleSlotSuggestionIds.has(recipe.id)),
    [fillSuggestions, roleSlotSuggestionIds],
  );
  const menuTableSlots = React.useMemo(
    () =>
      MENU_TABLE_SLOTS.map((slot) => ({
        ...slot,
        recipes: selectedRecipes.filter((recipe) => tableRoleOf(recipe) === slot.key),
        suggestion: roleSlotSuggestions[slot.key],
      })),
    [roleSlotSuggestions, selectedRecipes],
  );
  const menuKey = React.useMemo(
    () => selectedRecipes.map((recipe) => recipe.id).join("|"),
    [selectedRecipes],
  );
  const prepProgress = useKitchenPrepProgress(menuKey, menuInsights.shoppingList);
  const latestHistory = historyEntries[0];
  const actionBusy = busy || recordBusy || fillBusyId != null || swapBusyId != null || templateBusyId != null;
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
    setLockedIds(new Set());
    await clear();
    setMenuTip(null);
  };

  const onShuffleMenu = async () => {
    const picked = buildMenuWithLockedRecipes(recipes, selectedRecipes, lockedIds, todayMax, planScene, recentRecipeIds);
    if (!picked.length) return;
    await replace(picked.map((recipe) => recipe.id));
    setExportError(null);
    setMenuTip(
      lockedSelectedCount
        ? `已保留 ${lockedSelectedCount} 道锁定菜，并按「${MENU_PLAN_PRESETS[planScene].label}」补齐到 ${picked.length} 道。`
        : `已按「${MENU_PLAN_PRESETS[planScene].label}」${recentRecipeIds.length ? "避开近期重复，" : ""}配好 ${picked.length} 道：${picked.slice(0, 3).map((recipe) => recipe.name).join("、")}${picked.length > 3 ? "等" : ""}`,
    );
  };

  const onToggleLockRecipe = (recipe: Recipe) => {
    setLockedIds((current) => {
      const next = new Set(current);
      if (next.has(recipe.id)) {
        next.delete(recipe.id);
        setMenuTip(`已取消锁定「${recipe.name}」。`);
      } else {
        next.add(recipe.id);
        setMenuTip(`已锁定「${recipe.name}」，重配时会保留它。`);
      }
      return next;
    });
    setExportError(null);
  };

  const onRemoveSelectedRecipe = async (recipe: Recipe) => {
    setLockedIds((current) => {
      if (!current.has(recipe.id)) return current;
      const next = new Set(current);
      next.delete(recipe.id);
      return next;
    });
    await removeFromToday(recipe.id);
  };

  const onSaveMenuTemplate = () => {
    if (!selectedRecipes.length || !templatesHydrated) return;

    const ids = selectedRecipes.map((recipe) => recipe.id);
    const names = selectedRecipes.map((recipe) => recipe.name);
    const now = new Date().toISOString();
    const existing = menuTemplates.find((template) => sameOrderedIds(template.recipeIds, ids));
    const name = existing?.name ?? templateName(selectedRecipes);
    const nextTemplate: MenuTemplate = {
      id: existing?.id ?? makeTemplateId(),
      name,
      recipeIds: ids,
      recipeNames: names,
      scene: planScene,
      score: menuInsights.score,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      usedAt: existing?.usedAt,
      useCount: existing?.useCount ?? 0,
    };
    const next = [nextTemplate, ...menuTemplates.filter((template) => template.id !== nextTemplate.id)]
      .sort((a, b) => templateSortValue(b).localeCompare(templateSortValue(a)))
      .slice(0, MENU_TEMPLATE_LIMIT);

    setMenuTemplates(next);
    setExportError(null);
    setMenuTip(existing ? `已更新模板「${name}」。` : `已保存为模板「${name}」，以后可以一键复用。`);
  };

  const onApplyMenuTemplate = async (view: MenuTemplateView) => {
    const ids = view.validIds.slice(0, todayMax);
    if (!ids.length) {
      setExportError("这个模板里的菜谱暂时不可用。");
      return;
    }

    setTemplateBusyId(view.template.id);
    setExportError(null);
    try {
      await replace(ids);
      setLockedIds(new Set());
      const now = new Date().toISOString();
      setMenuTemplates((current) =>
        current
          .map((template) =>
            template.id === view.template.id
              ? {
                  ...template,
                  usedAt: now,
                  useCount: (template.useCount ?? 0) + 1,
                }
              : template,
          )
          .sort((a, b) => templateSortValue(b).localeCompare(templateSortValue(a)))
          .slice(0, MENU_TEMPLATE_LIMIT),
      );
      setMenuTip(`已复用「${view.template.name}」：${view.names.slice(0, 3).join("、")}${view.names.length > 3 ? "等" : ""}。`);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "复用模板失败");
    } finally {
      setTemplateBusyId(null);
    }
  };

  const onDeleteMenuTemplate = (template: MenuTemplate) => {
    setMenuTemplates((current) => current.filter((item) => item.id !== template.id));
    setMenuTip(`已删除模板「${template.name}」。`);
    setExportError(null);
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
    if (lockedIds.has(recipe.id)) {
      setMenuTip(`「${recipe.name}」已锁定，先取消锁定再换一道。`);
      return;
    }

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
                {todayHydrated
                  ? `${selectedRecipes.length}/${todayMax} 道${lockedSelectedCount ? ` · 已锁 ${lockedSelectedCount}` : ""}`
                  : "读取中"}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
              <Button
                size="sm"
                variant="outline"
                onClick={onShuffleMenu}
                disabled={!todayHydrated || !hydrated || !locksHydrated || recipes.length === 0 || actionBusy}
              >
                {lockedSelectedCount ? "保留重配" : "配一桌"}
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

          {templatesHydrated && (selectedRecipes.length || menuTemplateViews.length) ? (
            <div className="mt-3 rounded-lg border border-[color:rgba(185,148,75,0.24)] bg-[color:rgba(185,148,75,0.06)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-[color:var(--muted-2)]">家宴模板</div>
                  <div className="pk-serif mt-1 text-[18px] leading-tight">
                    {menuTemplateViews.length ? "常用桌面" : "保存满意搭配"}
                  </div>
                  <div className="mt-1 line-clamp-1 text-[11px] text-[color:var(--muted)]">
                    {menuTemplateViews.length
                      ? `已存 ${menuTemplateViews.length} 套，可直接复用整桌菜单。`
                      : "把今天这桌留下来，下次不用重新搭。"}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 px-2.5 text-[12px]"
                  disabled={!selectedRecipes.length || actionBusy}
                  onClick={onSaveMenuTemplate}
                >
                  存为模板
                </Button>
              </div>

              {menuTemplateViews.length ? (
                <div className="mt-3 grid gap-2">
                  {menuTemplateViews.slice(0, 3).map((view) => (
                    <div
                      key={view.template.id}
                      className="rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)]/78 p-2.5 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <div className="pk-serif truncate text-[15px] leading-tight">
                            {view.template.name}
                          </div>
                          <Badge tone="muted" className="shrink-0 px-1.5 py-0.5 text-[10px]">
                            {view.validIds.length}道
                          </Badge>
                        </div>
                        <div className="mt-1 line-clamp-1 text-[11px] text-[color:var(--muted)]">
                          {view.names.slice(0, 4).join("、")}
                          {view.names.length > 4 ? "等" : ""}
                        </div>
                        <div className="mt-1 text-[10px] text-[color:var(--muted-2)]">
                          {MENU_PLAN_PRESETS[view.template.scene].label} · {formatMenuTemplateScore(view.template.score)}
                          {view.template.useCount ? ` · 复用 ${view.template.useCount} 次` : ""}
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:mt-0 sm:flex sm:shrink-0 sm:items-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-[12px]"
                          disabled={actionBusy}
                          onClick={() => void onApplyMenuTemplate(view)}
                        >
                          {templateBusyId === view.template.id ? "复用中" : "复用"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-[12px]"
                          disabled={actionBusy}
                          onClick={() => onDeleteMenuTemplate(view.template)}
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-dashed border-[color:rgba(185,148,75,0.36)] bg-[color:var(--paper)]/54 px-3 py-3 text-[12px] leading-5 text-[color:var(--muted)]">
                  选好一桌菜后点“存为模板”，它会保存在本机浏览器里。
                </div>
              )}
            </div>
          ) : null}

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

          {selectedRecipes.length ? (
            <div className="mt-3 rounded-lg border border-[color:rgba(63,111,85,0.20)] bg-[linear-gradient(180deg,rgba(63,111,85,0.075),rgba(185,148,75,0.045))] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-[color:var(--muted-2)]">宴席台面</div>
                  <div className="pk-serif mt-1 text-[18px] leading-tight">按席位看这一桌</div>
                  <div className="mt-1 line-clamp-1 text-[11px] text-[color:var(--muted)]">
                    主菜、时蔬、汤羹、主食和小食齐一些，开饭更稳。
                  </div>
                </div>
                <Badge tone="accent" className="shrink-0">
                  {menuTableSlots.filter((slot) => slot.recipes.length).length}/{menuTableSlots.length}席
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {menuTableSlots.map((slot) => {
                  const hasRecipes = slot.recipes.length > 0;
                  const suggestion = slot.suggestion;
                  return (
                    <div
                      key={slot.key}
                      className={cn(
                        "min-h-[128px] rounded-lg border p-2.5 transition-colors",
                        hasRecipes
                          ? "border-[color:var(--line)] bg-[color:var(--paper)]/80"
                          : "border-dashed border-[color:rgba(185,148,75,0.42)] bg-[color:var(--paper)]/50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="pk-serif truncate text-[14px] leading-tight">{slot.title}</div>
                          <div className="mt-0.5 truncate text-[10px] text-[color:var(--muted-2)]">{slot.note}</div>
                        </div>
                        <Badge tone={hasRecipes ? slot.tone : "muted"} className="shrink-0 px-1.5 py-0.5 text-[10px]">
                          {hasRecipes ? `${slot.recipes.length}道` : "空位"}
                        </Badge>
                      </div>

                      {hasRecipes ? (
                        <div className="mt-2 space-y-1.5">
                          {slot.recipes.slice(0, 2).map((recipe, index) => {
                            const image = recipe.images?.[0];
                            return (
                              <Link
                                key={recipe.id}
                                href={recipeDetailHref(recipe.id)}
                                className="grid grid-cols-[34px_minmax(0,1fr)] items-center gap-2 rounded-md border border-[color:rgba(24,33,29,0.08)] bg-[color:var(--paper-strong)]/70 p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                              >
                                <span className="h-[34px] w-[34px] overflow-hidden rounded-md border border-[color:var(--line)] bg-[color:var(--wash)]">
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
                                    <span className="flex h-full items-center justify-center text-[9px] text-[color:var(--muted-2)]">
                                      无图
                                    </span>
                                  )}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-[12px] leading-4">{recipe.name}</span>
                                  <span className="mt-0.5 block truncate text-[10px] text-[color:var(--muted-2)]">
                                    {lockedIds.has(recipe.id) ? "已锁定" : "可换可移"}
                                  </span>
                                </span>
                              </Link>
                            );
                          })}
                          {slot.recipes.length > 2 ? (
                            <div className="rounded-md border border-[color:var(--menu-line-soft)] px-2 py-1 text-[10px] text-[color:var(--muted)]">
                              还有 {slot.recipes.length - 2} 道在这一席
                            </div>
                          ) : null}
                        </div>
                      ) : suggestion ? (
                        <button
                          type="button"
                          className="mt-2 flex min-h-[58px] w-full flex-col justify-center rounded-md border border-[color:rgba(63,111,85,0.24)] bg-[color:rgba(63,111,85,0.08)] px-2.5 py-2 text-left text-[color:var(--accent)] transition-colors hover:bg-[color:rgba(63,111,85,0.12)] disabled:opacity-50"
                          disabled={!todayHydrated || actionBusy}
                          onClick={() => void onAddFillSuggestion(suggestion)}
                        >
                          <span className="text-[10px] text-[color:var(--muted-2)]">{slot.empty}</span>
                          <span className="mt-0.5 line-clamp-2 text-[12px] leading-4">
                            补上「{suggestion.name}」
                          </span>
                        </button>
                      ) : (
                        <div className="mt-2 flex min-h-[58px] items-center rounded-md border border-dashed border-[color:var(--menu-line-soft)] px-2.5 text-[11px] leading-5 text-[color:var(--muted)]">
                          {slot.empty}，可以从下方菜谱库挑一道。
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {visibleFillSuggestions.length ? (
            <div className="mt-3 rounded-lg border border-[color:rgba(63,111,85,0.20)] bg-[color:rgba(63,111,85,0.06)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-[color:var(--muted-2)]">补齐建议</div>
                  <div className="pk-serif mt-1 text-[18px] leading-tight">让这桌更完整</div>
                </div>
                <Badge tone="accent">可补 {visibleFillSuggestions.length}</Badge>
              </div>

              <div className="mt-3 grid gap-2">
                {visibleFillSuggestions.map((recipe, index) => {
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
                    {guideMode === "shopping" ? `${prepProgress.doneCount}/${shoppingTotal || 0}` : dinnerPrepPlan.startTime}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[color:var(--muted-2)]">
                    {guideMode === "shopping" ? "已备" : "开工"}
                  </div>
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
                  ["prep", "备菜", `${dinnerPrepPlan.steps.length}步`],
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
                <div className="mt-3 space-y-3">
                  <div className="rounded-lg border border-[color:rgba(185,148,75,0.24)] bg-[color:rgba(185,148,75,0.06)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] text-[color:var(--muted-2)]">开饭时间</div>
                        <div className="pk-serif mt-1 text-[18px] leading-tight">{dinnerPrepPlan.serveTime}</div>
                      </div>
                      <Badge tone="warm" className="shrink-0">
                        {dinnerPrepPlan.intensity}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-1.5">
                      {DINNER_TIME_OPTIONS.map((time) => {
                        const active = dinnerTime === time;
                        return (
                          <button
                            key={time}
                            type="button"
                            aria-pressed={active}
                            className={cn(
                              "h-8 rounded-md border text-[12px] transition-colors",
                              active
                                ? "border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]"
                                : "border-[color:var(--menu-line-soft)] bg-[color:var(--paper)]/72 text-[color:var(--muted)]",
                            )}
                            onClick={() => setDinnerTime(time)}
                          >
                            {time}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 rounded-md border border-[color:rgba(63,111,85,0.18)] bg-[color:rgba(63,111,85,0.07)] px-3 py-2 text-[12px] leading-5 text-[color:var(--accent)]">
                      {dinnerPrepPlan.headline}
                    </div>
                  </div>

                  <ol className="space-y-2">
                    {dinnerPrepPlan.steps.map((step) => (
                      <li
                        key={`${step.label}-${step.time}`}
                        className="grid grid-cols-[3.25rem_1fr] gap-2 rounded-lg border border-[color:var(--menu-line-soft)] bg-[color:var(--paper)]/72 px-3 py-3"
                      >
                        <span
                          className={cn(
                            "flex min-h-10 flex-col items-center justify-center rounded-md border text-center leading-none",
                            step.tone === "warm" &&
                              "border-[color:rgba(184,92,56,0.24)] bg-[color:rgba(184,92,56,0.08)] text-[color:var(--warm)]",
                            step.tone === "accent" &&
                              "border-[color:rgba(63,111,85,0.24)] bg-[color:rgba(63,111,85,0.08)] text-[color:var(--accent)]",
                            step.tone === "muted" &&
                              "border-[color:rgba(185,148,75,0.30)] bg-[color:var(--paper-strong)]/70 text-[color:var(--muted)]",
                          )}
                        >
                          <span className="text-[11px] font-medium">{step.time}</span>
                          <span className="mt-1 text-[9px] opacity-70">{step.label}</span>
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
                </div>
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
                    <div className="relative aspect-[4/3] bg-[color:var(--wash)]">
                      <Link
                        href={recipeDetailHref(recipe.id)}
                        className="absolute inset-0 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
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
                      <button
                        type="button"
                        aria-pressed={lockedIds.has(recipe.id)}
                        className={cn(
                          "absolute right-2 top-2 z-20 rounded-md border px-1.5 py-0.5 text-[10px] leading-none shadow-[0_6px_14px_rgba(24,33,29,0.10)] backdrop-blur transition-colors",
                          lockedIds.has(recipe.id)
                            ? "border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]"
                            : "border-[color:rgba(255,253,246,0.64)] bg-[color:var(--paper)]/88 text-[color:var(--foreground)]",
                        )}
                        disabled={!locksHydrated || actionBusy}
                        onClick={() => onToggleLockRecipe(recipe)}
                      >
                        {lockedIds.has(recipe.id) ? "已锁" : "锁定"}
                      </button>
                    </div>
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
                          disabled={actionBusy || lockedIds.has(recipe.id) || !hydrated || recipes.length <= selectedRecipes.length}
                          onClick={() => void onSwapRecipe(recipe)}
                        >
                          {swapBusyId === recipe.id ? "换中" : "换一道"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 whitespace-nowrap px-1.5 text-[12px] leading-none"
                          disabled={actionBusy}
                          onClick={() => void onRemoveSelectedRecipe(recipe)}
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

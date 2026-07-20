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
import {
  GUEST_CONSTRAINT_OPTIONS,
  buildGuestFitPlan,
  createGuestProfile,
  filterGuestSafeRecipes,
  guestConstraintLabels,
  persistGuestProfile,
  readGuestProfile,
  type GuestConstraintKey,
  type GuestProfile,
} from "@/lib/today/guestProfile";
import { buildPantryCoverage } from "@/lib/today/pantry";
import { usePantry } from "@/lib/today/usePantry";
import { buildDinnerConfirmationText, buildDinnerInvitationText } from "@/lib/today/dinnerInvitation";
import {
  DISH_FEEDBACK_META,
  buildDishFeedbackSummary,
  feedbackEntryFor,
  feedbackScoreFor,
  type DishFeedbackEntry,
  type DishFeedbackTone,
} from "@/lib/today/dishFeedback";
import { useDishFeedback } from "@/lib/today/useDishFeedback";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type KitchenGuideMode = "shopping" | "prep" | "crew";
type TableMealRole = Exclude<MealRole, "home">;

const FILL_ROLE_PRIORITY: MealRole[] = ["main", "vegetable", "soup", "staple", "small"];
const TABLE_ROLE_ORDER: TableMealRole[] = ["main", "vegetable", "soup", "staple", "small"];
const LOCKED_MENU_KEY = "private-kitchen:locked-today-menu:v1";
const MENU_TEMPLATES_KEY = "private-kitchen:menu-templates:v1";
const DINNER_TIME_KEY = "private-kitchen:dinner-time:v1";
const DINER_COUNT_KEY = "private-kitchen:diner-count:v1";
const MENU_TEMPLATE_LIMIT = 6;
const DINNER_TIME_OPTIONS = ["18:30", "19:00", "19:30", "20:00"];
const DINER_COUNT_OPTIONS = [2, 3, 4, 6, 8];

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

function persistDinerCount(count: number) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(DINER_COUNT_KEY, String(normalizeDinerCount(count)));
  } catch {
    // Diner count is a planning preference; menus can still work without storage.
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

function mergeUniqueRecipes(...lists: Recipe[][]): Recipe[] {
  const seen = new Set<string>();
  const merged: Recipe[] = [];
  for (const list of lists) {
    for (const recipe of list) {
      if (seen.has(recipe.id)) continue;
      seen.add(recipe.id);
      merged.push(recipe);
    }
  }
  return merged;
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

function budgetTone(label: string): "warm" | "accent" | "muted" {
  if (label === "家宴级" || label === "硬菜拉满") return "warm";
  if (label === "省心家常" || label === "舒适一桌") return "accent";
  return "muted";
}

function palateTone(label: string): "warm" | "accent" | "muted" {
  if (label === "辣味上头" || label === "浓香偏重") return "warm";
  if (label === "节奏完整" || label === "清爽一桌") return "accent";
  return "muted";
}

function menuFillScore(
  candidate: Recipe,
  wantedRole: MealRole,
  selectedRecipes: Recipe[],
  recentIds: Set<string>,
  feedbackEntries: DishFeedbackEntry[] = [],
): number {
  const role = mealRoleOf(candidate);
  const roleScore = role === wantedRole ? 90 : role === "home" ? 8 : 18;
  const imageScore = candidate.images?.length ? 5 : 0;
  const ratingScore = (candidate.rating ?? 0) * 2.5;
  const categoryScore = selectedRecipes.some((recipe) => recipe.category === candidate.category) ? 1 : 5;
  const recentPenalty = recentIds.has(candidate.id) ? -22 : 0;
  return roleScore + imageScore + ratingScore + categoryScore + recentPenalty + feedbackScoreFor(candidate.id, feedbackEntries);
}

function buildMenuFillSuggestions(
  recipes: Recipe[],
  selectedRecipes: Recipe[],
  recentRecipeIds: string[],
  feedbackEntries: DishFeedbackEntry[] = [],
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
      .sort((a, b) => menuFillScore(b, role, selectedRecipes, recentIds, feedbackEntries) - menuFillScore(a, role, selectedRecipes, recentIds, feedbackEntries))[0];
    if (!best) continue;
    picked.push(best);
    pickedIds.add(best.id);
  }

  for (const role of FILL_ROLE_PRIORITY) {
    if (picked.length >= max) break;
    const best = recipes
      .filter((recipe) => !selectedIds.has(recipe.id) && !pickedIds.has(recipe.id))
      .sort((a, b) => menuFillScore(b, role, selectedRecipes, recentIds, feedbackEntries) - menuFillScore(a, role, selectedRecipes, recentIds, feedbackEntries))[0];
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
  feedbackEntries: DishFeedbackEntry[] = [],
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
      .sort((a, b) => menuFillScore(b, role, selectedRecipes, recentIds, feedbackEntries) - menuFillScore(a, role, selectedRecipes, recentIds, feedbackEntries))[0];
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
  feedbackEntries: DishFeedbackEntry[] = [],
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

  return roleScore + imageScore + ratingScore + categoryScore + recentPenalty + duplicateRolePenalty + feedbackScoreFor(candidate.id, feedbackEntries);
}

function pickSwapCandidate(
  recipes: Recipe[],
  selectedRecipes: Recipe[],
  original: Recipe,
  recentRecipeIds: string[],
  feedbackEntries: DishFeedbackEntry[] = [],
): Recipe | null {
  const selectedIds = new Set(selectedRecipes.map((recipe) => recipe.id));
  const recentIds = new Set(recentRecipeIds);
  const originalRole = mealRoleOf(original);
  const candidates = recipes
    .filter((recipe) => !selectedIds.has(recipe.id))
    .map((recipe) => ({ recipe, score: menuSwapScore(recipe, original, selectedRecipes, recentIds, feedbackEntries) }))
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
  const pantry = usePantry();
  const dishFeedback = useDishFeedback();
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
  const [dinerCount, setDinerCount] = React.useState(2);
  const [dinerCountHydrated, setDinerCountHydrated] = React.useState(false);
  const [guestProfile, setGuestProfile] = React.useState<GuestProfile>(() => createGuestProfile());
  const [guestHydrated, setGuestHydrated] = React.useState(false);

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
    setDinerCount(readDinerCount());
    setDinerCountHydrated(true);
  }, []);

  React.useEffect(() => {
    setGuestProfile(readGuestProfile());
    setGuestHydrated(true);
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

  React.useEffect(() => {
    if (!dinerCountHydrated) return;
    persistDinerCount(dinerCount);
  }, [dinerCount, dinerCountHydrated]);

  React.useEffect(() => {
    if (!guestHydrated) return;
    persistGuestProfile(guestProfile);
  }, [guestHydrated, guestProfile]);

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
    () => buildTodayMenuInsights(selectedRecipes, dinerCount),
    [dinerCount, selectedRecipes],
  );
  const guestFit = React.useMemo(
    () => buildGuestFitPlan(selectedRecipes, guestProfile),
    [guestProfile, selectedRecipes],
  );
  const guestSafeRecipes = React.useMemo(
    () => filterGuestSafeRecipes(recipes, guestProfile),
    [guestProfile, recipes],
  );
  const hasGuestConstraints = guestProfile.constraintKeys.length > 0;
  const guestAwareRecipePool = React.useMemo(
    () => (hasGuestConstraints && guestSafeRecipes.length ? guestSafeRecipes : recipes),
    [guestSafeRecipes, hasGuestConstraints, recipes],
  );
  const dinnerPrepPlan = React.useMemo(
    () => buildDinnerPrepPlan(selectedRecipes, dinnerTime),
    [dinnerTime, selectedRecipes],
  );
  const fillSuggestions = React.useMemo(() => {
    if (!selectedRecipes.length || selectedRecipes.length >= todayMax) return [];
    return buildMenuFillSuggestions(
      guestAwareRecipePool,
      selectedRecipes,
      recentRecipeIds,
      dishFeedback.entries,
      Math.min(3, todayMax - selectedRecipes.length),
    );
  }, [dishFeedback.entries, guestAwareRecipePool, recentRecipeIds, selectedRecipes, todayMax]);
  const roleSlotSuggestions = React.useMemo(
    () => buildRoleSlotSuggestions(guestAwareRecipePool, selectedRecipes, recentRecipeIds, dishFeedback.entries),
    [dishFeedback.entries, guestAwareRecipePool, recentRecipeIds, selectedRecipes],
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
  const pantryCoverage = React.useMemo(
    () => buildPantryCoverage(menuInsights.shoppingList, pantry.items),
    [menuInsights.shoppingList, pantry.items],
  );
  const feedbackSummary = React.useMemo(
    () => buildDishFeedbackSummary(selectedRecipes, dishFeedback.entries),
    [dishFeedback.entries, selectedRecipes],
  );
  const latestHistory = historyEntries[0];
  const actionBusy = busy || recordBusy || fillBusyId != null || swapBusyId != null || templateBusyId != null;
  const shoppingTotal = menuInsights.shoppingList.length;
  const shoppingPercent = shoppingTotal ? Math.round((prepProgress.doneCount / shoppingTotal) * 100) : 0;
  const shoppingGroupCount = menuInsights.shoppingGroups.length;
  const guideProgressPercent =
    guideMode === "shopping"
      ? shoppingPercent
      : guideMode === "prep"
        ? Math.min(100, dinnerPrepPlan.steps.length * 20)
        : Math.min(100, menuInsights.crew.assignments.length * 25);
  const guideMetric =
    guideMode === "shopping"
      ? `缺${pantryCoverage.missing.length}`
      : guideMode === "prep"
        ? dinnerPrepPlan.startTime
        : `${menuInsights.crew.assignments.length}组`;
  const guideMetricLabel = guideMode === "shopping" ? "待买" : guideMode === "prep" ? "开工" : "分工";

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
    const targetCount = Math.min(
      todayMax,
      recipes.length,
      Math.max(MENU_PLAN_PRESETS[planScene].targetCount, lockedSelectedRecipes.length),
    );
    const safeNeeded = Math.max(1, targetCount - lockedSelectedRecipes.length);
    const useGuestPool = hasGuestConstraints && guestSafeRecipes.length >= safeNeeded;
    const shufflePool = useGuestPool ? mergeUniqueRecipes(guestSafeRecipes, lockedSelectedRecipes) : recipes;
    const picked = buildMenuWithLockedRecipes(shufflePool, selectedRecipes, lockedIds, todayMax, planScene, recentRecipeIds);
    if (!picked.length) return;
    await replace(picked.map((recipe) => recipe.id));
    setExportError(null);
    const guestPrefix = hasGuestConstraints
      ? useGuestPool
        ? `已按「${guestConstraintLabels(guestProfile.constraintKeys, 3).join("、")}」避开忌口，`
        : "客人档案限制较多，已优先匹配可用菜，"
      : "";
    setMenuTip(
      lockedSelectedCount
        ? `${guestPrefix}已保留 ${lockedSelectedCount} 道锁定菜，并按「${MENU_PLAN_PRESETS[planScene].label}」补齐到 ${picked.length} 道。`
        : `${guestPrefix}已按「${MENU_PLAN_PRESETS[planScene].label}」${recentRecipeIds.length ? "避开近期重复，" : ""}配好 ${picked.length} 道：${picked.slice(0, 3).map((recipe) => recipe.name).join("、")}${picked.length > 3 ? "等" : ""}`,
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

  const onChangeDinerCount = (nextCount: number) => {
    const normalized = normalizeDinerCount(nextCount);
    setDinerCount(normalized);
    setMenuTip(`已按 ${normalized} 人份更新菜量和采购提示。`);
    setExportError(null);
  };

  const onChangeGuestName = (name: string) => {
    setGuestProfile((current) => ({
      ...current,
      name: name.slice(0, 18),
      updatedAt: new Date().toISOString(),
    }));
  };

  const onChangeGuestNote = (note: string) => {
    setGuestProfile((current) => ({
      ...current,
      note: note.slice(0, 48),
      updatedAt: new Date().toISOString(),
    }));
  };

  const onToggleGuestConstraint = (key: GuestConstraintKey) => {
    setGuestProfile((current) => {
      const nextKeys = current.constraintKeys.includes(key)
        ? current.constraintKeys.filter((item) => item !== key)
        : [...current.constraintKeys, key];
      return {
        ...current,
        constraintKeys: nextKeys,
        updatedAt: new Date().toISOString(),
      };
    });
    setMenuTip(null);
    setExportError(null);
  };

  const onClearGuestProfile = () => {
    setGuestProfile(createGuestProfile());
    setMenuTip("已清空宴客档案。");
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
      const lines = [
        `${menuInsights.serving.diners}人份 · 菜场路线`,
        `菜场预算：${menuInsights.budget.range} · ${menuInsights.budget.perPerson}`,
        `口味节奏：${menuInsights.palate.label} · ${menuInsights.palate.score}分`,
        `客人档案：${guestFit.label}${guestFit.activeLabels.length ? ` · ${guestFit.activeLabels.join("、")}` : ""}`,
        ...(guestProfile.note.trim() ? [`客人备注：${guestProfile.note.trim()}`] : []),
        ...guestFit.warnings.map((warning) => `提醒：${warning}`),
        pantryCoverage.inStock.length ? `家里已有：${pantryCoverage.inStock.join("、")}` : "",
        pantryCoverage.missing.length ? `还要采购：${pantryCoverage.missing.join("、")}` : "",
        ...menuInsights.shoppingGroups.flatMap((group) => [
          `【${group.label}】`,
          ...group.items.map((item) => `□ ${item}`),
        ]),
      ].filter(Boolean);
      await navigator.clipboard.writeText(lines.join("\n"));
      setMenuTip("分区采购清单已复制，可以直接发给家里人一起买。");
    } catch {
      setExportError("复制失败，可以直接截图这份采购清单。");
    }
  };

  const onCopyCrewPlan = async () => {
    if (!menuInsights.crew.assignments.length) return;
    setExportError(null);
    try {
      const lines = [
        `${menuInsights.serving.diners}人份 · 厨房分工`,
        menuInsights.crew.summary,
        ...menuInsights.crew.assignments.flatMap((assignment, index) => [
          `【${String(index + 1).padStart(2, "0")} ${assignment.label}】${assignment.title}`,
          ...assignment.tasks.map((task) => `□ ${task}`),
        ]),
      ];
      await navigator.clipboard.writeText(lines.join("\n"));
      setMenuTip("厨房分工已复制，可以直接发给家里人认领。");
    } catch {
      setExportError("复制失败，可以直接截图这份分工。");
    }
  };

  const onCopyDinnerInvitation = async () => {
    if (!selectedRecipes.length) return;
    setExportError(null);
    try {
      await navigator.clipboard.writeText(
        buildDinnerInvitationText({
          recipes: selectedRecipes,
          insights: menuInsights,
          guestFit,
          pantryCoverage,
          dinnerTime,
        }),
      );
      setMenuTip("家宴邀请已复制，可以直接发给家里人。");
    } catch {
      setExportError("复制失败，可以直接截图这张邀请卡。");
    }
  };

  const onCopyDinnerConfirmation = async () => {
    if (!selectedRecipes.length) return;
    setExportError(null);
    try {
      await navigator.clipboard.writeText(
        buildDinnerConfirmationText({
          recipes: selectedRecipes,
          insights: menuInsights,
          guestFit,
          pantryCoverage,
          dinnerTime,
        }),
      );
      setMenuTip("菜单确认单已复制，可以发出去确认口味。");
    } catch {
      setExportError("复制失败，可以直接截图这张确认卡。");
    }
  };

  const onSetDishFeedback = (recipe: Recipe, tone: DishFeedbackTone) => {
    dishFeedback.setFeedback(recipe, tone);
    setMenuTip(`已记录「${recipe.name}」：${DISH_FEEDBACK_META[tone].label}。`);
    setExportError(null);
  };

  const onCopyDinnerReview = async () => {
    if (!selectedRecipes.length) return;
    setExportError(null);
    try {
      const lines = [
        "私房家宴 · 宴后复盘",
        `已复盘：${feedbackSummary.reviewedCount}/${selectedRecipes.length} 道`,
        ...selectedRecipes.map((recipe) => {
          const entry = feedbackEntryFor(recipe.id, dishFeedback.entries);
          return `${entry ? DISH_FEEDBACK_META[entry.tone].shortLabel : "未评"} · ${recipe.name}`;
        }),
        ...feedbackSummary.notes.map((note) => `提示：${note}`),
      ];
      await navigator.clipboard.writeText(lines.join("\n"));
      setMenuTip("宴后复盘已复制。");
    } catch {
      setExportError("复制失败，可以直接截图复盘卡。");
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
      let nextRecipe = pickSwapCandidate(guestAwareRecipePool, selectedRecipes, recipe, recentRecipeIds, dishFeedback.entries);
      if (!nextRecipe) {
        nextRecipe = pickSwapCandidate(recipes, selectedRecipes, recipe, recentRecipeIds, dishFeedback.entries);
        if (!nextRecipe) {
          setExportError("暂时没有可替换的菜。");
          return;
        }
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

          <div className="mt-3 rounded-lg border border-[color:rgba(185,148,75,0.24)] bg-[color:var(--paper)]/72 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] text-[color:var(--muted-2)]">宴客人数</div>
                <div className="pk-serif mt-1 text-[22px] leading-none">
                  {menuInsights.serving.diners} 人份
                </div>
                <div className="mt-1 line-clamp-1 text-[11px] text-[color:var(--muted)]">
                  {menuInsights.serving.summary}
                </div>
              </div>
              <div className="grid shrink-0 grid-cols-[2.25rem_2.7rem_2.25rem] overflow-hidden rounded-lg border border-[color:var(--menu-line-soft)] bg-[color:var(--paper-strong)]/78">
                <button
                  type="button"
                  className="h-9 border-r border-[color:var(--menu-line-soft)] text-[17px] leading-none text-[color:var(--muted)] disabled:opacity-35"
                  aria-label="减少用餐人数"
                  disabled={!dinerCountHydrated || menuInsights.serving.diners <= 1}
                  onClick={() => onChangeDinerCount(menuInsights.serving.diners - 1)}
                >
                  -
                </button>
                <div className="grid h-9 place-items-center text-[13px] font-medium text-[color:var(--foreground)]">
                  {menuInsights.serving.diners}
                </div>
                <button
                  type="button"
                  className="h-9 border-l border-[color:var(--menu-line-soft)] text-[17px] leading-none text-[color:var(--muted)] disabled:opacity-35"
                  aria-label="增加用餐人数"
                  disabled={!dinerCountHydrated || menuInsights.serving.diners >= 10}
                  onClick={() => onChangeDinerCount(menuInsights.serving.diners + 1)}
                >
                  +
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {DINER_COUNT_OPTIONS.map((count) => {
                const active = menuInsights.serving.diners === count;
                return (
                  <button
                    key={count}
                    type="button"
                    aria-pressed={active}
                    className={cn(
                      "h-8 rounded-md border text-[12px] transition-colors",
                      active
                        ? "border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]"
                        : "border-[color:var(--menu-line-soft)] bg-[color:var(--paper)]/76 text-[color:var(--muted)]",
                    )}
                    disabled={!dinerCountHydrated}
                    onClick={() => onChangeDinerCount(count)}
                  >
                    {count}人
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-[color:rgba(63,111,85,0.22)] bg-[linear-gradient(180deg,rgba(63,111,85,0.07),rgba(255,253,246,0.55))] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] text-[color:var(--muted-2)]">宴客档案</div>
                <div className="pk-serif mt-1 text-[18px] leading-tight">
                  {guestFit.headline}
                </div>
                <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-[color:var(--muted)]">
                  {guestFit.summary}
                </div>
              </div>
              <Badge
                tone={guestFit.riskRecipes.length ? "warm" : guestProfile.constraintKeys.length ? "accent" : "muted"}
                className="shrink-0"
              >
                {guestFit.score}
              </Badge>
            </div>

            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <Input
                value={guestProfile.name}
                onChange={(event) => onChangeGuestName(event.target.value)}
                placeholder="这桌客人"
                className="h-10 text-[13px]"
                disabled={!guestHydrated}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-10 px-2.5 text-[12px]"
                disabled={!guestHydrated || (!guestProfile.name && !guestProfile.constraintKeys.length && !guestProfile.note)}
                onClick={onClearGuestProfile}
              >
                清空
              </Button>
            </div>
            <Input
              value={guestProfile.note}
              onChange={(event) => onChangeGuestNote(event.target.value)}
              placeholder="备注：少盐、孩子一起吃"
              className="mt-2 h-10 text-[13px]"
              disabled={!guestHydrated}
            />

            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {GUEST_CONSTRAINT_OPTIONS.map((option) => {
                const active = guestProfile.constraintKeys.includes(option.key);
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={active}
                    className={cn(
                      "min-h-12 rounded-md border px-2 py-2 text-left transition-colors",
                      active
                        ? "border-[color:rgba(63,111,85,0.38)] bg-[color:rgba(63,111,85,0.12)] text-[color:var(--accent)]"
                        : "border-[color:var(--menu-line-soft)] bg-[color:var(--paper)]/70 text-[color:var(--muted)]",
                    )}
                    title={option.detail}
                    disabled={!guestHydrated}
                    onClick={() => onToggleGuestConstraint(option.key)}
                  >
                    <span className="block text-[12px] font-medium leading-none">{option.shortLabel}</span>
                    <span className="mt-1 block truncate text-[10px] opacity-70">{option.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {guestFit.notes.map((note) => (
                <span
                  key={note}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[11px] leading-none",
                    guestFit.riskRecipes.length
                      ? "border-[color:rgba(184,92,56,0.20)] bg-[color:rgba(184,92,56,0.07)] text-[color:var(--warm)]"
                      : "border-[color:rgba(63,111,85,0.18)] bg-[color:rgba(63,111,85,0.07)] text-[color:var(--accent)]",
                  )}
                >
                  {note}
                </span>
              ))}
            </div>

            {guestFit.warnings.length ? (
              <div className="mt-3 grid gap-1.5">
                {guestFit.warnings.map((warning) => (
                  <div
                    key={warning}
                    className="rounded-md border border-[color:rgba(184,92,56,0.22)] bg-[color:rgba(184,92,56,0.07)] px-2.5 py-2 text-[11px] leading-5 text-[color:var(--warm)]"
                  >
                    {warning}
                  </div>
                ))}
              </div>
            ) : null}
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

          {selectedRecipes.length ? (
            <div className="mt-3 rounded-lg border border-[color:rgba(185,148,75,0.26)] bg-[linear-gradient(180deg,rgba(185,148,75,0.08),rgba(63,111,85,0.045))] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-[color:var(--muted-2)]">家宴邀请</div>
                  <div className="pk-serif mt-1 text-[18px] leading-tight">
                    {dinnerTime} 开饭 · {selectedRecipes.length} 道菜
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-[color:var(--muted)]">
                    {selectedRecipes.slice(0, 4).map((recipe) => recipe.name).join("、")}
                    {selectedRecipes.length > 4 ? "等" : ""}，{guestFit.label}，冰箱还买 {pantryCoverage.missing.length} 项。
                  </div>
                </div>
                <Badge tone="warm" className="shrink-0">
                  可发送
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-md border border-[color:var(--menu-line-soft)] bg-[color:var(--paper)]/72 px-2.5 py-2">
                  <div className="text-[10px] text-[color:var(--muted-2)]">开饭</div>
                  <div className="mt-1 text-[12px] font-medium text-[color:var(--foreground)]">{dinnerTime}</div>
                </div>
                <div className="rounded-md border border-[color:var(--menu-line-soft)] bg-[color:var(--paper)]/72 px-2.5 py-2">
                  <div className="text-[10px] text-[color:var(--muted-2)]">客人</div>
                  <div className="mt-1 truncate text-[12px] font-medium text-[color:var(--accent)]">{guestFit.label}</div>
                </div>
                <div className="rounded-md border border-[color:var(--menu-line-soft)] bg-[color:var(--paper)]/72 px-2.5 py-2">
                  <div className="text-[10px] text-[color:var(--muted-2)]">采购</div>
                  <div className="mt-1 text-[12px] font-medium text-[color:var(--warm)]">缺 {pantryCoverage.missing.length}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-[12px]"
                  disabled={actionBusy}
                  onClick={onCopyDinnerInvitation}
                >
                  复制邀请
                </Button>
                <Button
                  size="sm"
                  className="h-9 text-[12px]"
                  disabled={actionBusy}
                  onClick={onCopyDinnerConfirmation}
                >
                  确认菜单
                </Button>
              </div>
            </div>
          ) : null}

          {selectedRecipes.length ? (
            <div className="mt-3 rounded-lg border border-[color:rgba(63,111,85,0.22)] bg-[linear-gradient(180deg,rgba(63,111,85,0.07),rgba(255,253,246,0.52))] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-[color:var(--muted-2)]">宴后复盘</div>
                  <div className="pk-serif mt-1 text-[18px] leading-tight">
                    {feedbackSummary.headline}
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-[color:var(--muted)]">
                    {feedbackSummary.notes.join("；")}
                  </div>
                </div>
                <Badge
                  tone={feedbackSummary.avoidCount ? "warm" : feedbackSummary.reviewedCount ? "accent" : "muted"}
                  className="shrink-0"
                >
                  {feedbackSummary.label}
                </Badge>
              </div>

              <div className="mt-3 grid gap-2">
                {selectedRecipes.slice(0, 6).map((recipe) => {
                  const entry = feedbackEntryFor(recipe.id, dishFeedback.entries);
                  return (
                    <div
                      key={recipe.id}
                      className="rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)]/72 p-2.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] text-[color:var(--foreground)]">{recipe.name}</div>
                          <div className="mt-0.5 text-[10px] text-[color:var(--muted-2)]">
                            {entry ? `${DISH_FEEDBACK_META[entry.tone].label} · ${entry.count} 次` : "还没记录"}
                          </div>
                        </div>
                        {entry ? (
                          <button
                            type="button"
                            className="h-7 shrink-0 rounded-md border border-[color:var(--menu-line-soft)] px-2 text-[11px] text-[color:var(--muted)]"
                            onClick={() => dishFeedback.removeFeedback(recipe.id)}
                          >
                            重置
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-1.5">
                        {(["love", "again", "avoid"] as const).map((tone) => {
                          const active = entry?.tone === tone;
                          return (
                            <button
                              key={tone}
                              type="button"
                              aria-pressed={active}
                              className={cn(
                                "h-8 rounded-md border px-2 text-[11px] transition-colors",
                                active
                                  ? tone === "avoid"
                                    ? "border-[color:rgba(184,92,56,0.30)] bg-[color:rgba(184,92,56,0.09)] text-[color:var(--warm)]"
                                    : "border-[color:rgba(63,111,85,0.30)] bg-[color:rgba(63,111,85,0.09)] text-[color:var(--accent)]"
                                  : "border-[color:var(--menu-line-soft)] bg-[color:var(--paper-strong)]/60 text-[color:var(--muted)]",
                              )}
                              disabled={!dishFeedback.hydrated}
                              onClick={() => onSetDishFeedback(recipe, tone)}
                            >
                              {DISH_FEEDBACK_META[tone].shortLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-[12px]"
                  disabled={!feedbackSummary.reviewedCount}
                  onClick={onCopyDinnerReview}
                >
                  复制复盘
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-[12px]"
                  disabled={!feedbackSummary.reviewedCount || actionBusy}
                  onClick={onRecordCooked}
                >
                  {recordBusy ? "记录中" : "记为吃过"}
                </Button>
              </div>
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

          <div className="mt-3 rounded-lg border border-[color:rgba(63,111,85,0.20)] bg-[linear-gradient(180deg,rgba(63,111,85,0.065),rgba(185,148,75,0.045))] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] text-[color:var(--muted-2)]">口味罗盘</div>
                <div className="pk-serif mt-1 text-[18px] leading-tight">
                  {menuInsights.palate.headline}
                </div>
                <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-[color:var(--muted)]">
                  {menuInsights.palate.summary}
                </div>
              </div>
              <Badge tone={palateTone(menuInsights.palate.label)} className="shrink-0">
                {menuInsights.palate.label}
              </Badge>
            </div>

            <div className="mt-3 space-y-2">
              {menuInsights.palate.axes.map((axis) => (
                <div
                  key={axis.key}
                  className="rounded-md border border-[color:var(--menu-line-soft)] bg-[color:var(--paper)]/72 px-2.5 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium leading-none text-[color:var(--foreground)]">
                        {axis.label}
                      </div>
                      <div className="mt-1 truncate text-[10px] text-[color:var(--muted-2)]">{axis.hint}</div>
                    </div>
                    <div
                      className={cn(
                        "shrink-0 text-[12px] font-medium",
                        axis.tone === "warm" && "text-[color:var(--warm)]",
                        axis.tone === "accent" && "text-[color:var(--accent)]",
                        axis.tone === "muted" && "text-[color:var(--muted)]",
                      )}
                    >
                      {axis.value}
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:rgba(24,33,29,0.08)]">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width]",
                        axis.tone === "warm" && "bg-[color:var(--warm)]",
                        axis.tone === "accent" && "bg-[color:var(--accent)]",
                        axis.tone === "muted" && "bg-[color:var(--accent-2)]",
                      )}
                      style={{ width: `${axis.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {menuInsights.palate.notes.map((note) => (
                <span
                  key={note}
                  className="rounded-md border border-[color:rgba(63,111,85,0.18)] bg-[color:rgba(63,111,85,0.07)] px-2 py-1 text-[11px] leading-none text-[color:var(--accent)]"
                >
                  {note}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-[color:rgba(63,111,85,0.20)] bg-[linear-gradient(180deg,rgba(63,111,85,0.07),rgba(255,253,246,0.52))] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] text-[color:var(--muted-2)]">份量小台</div>
                <div className="pk-serif mt-1 text-[18px] leading-tight">
                  {menuInsights.serving.scaleLabel}
                </div>
              </div>
              <Badge tone={menuInsights.serving.status === "很稳" ? "accent" : menuInsights.serving.status === "略紧" ? "warm" : "muted"} className="shrink-0">
                {menuInsights.serving.status}
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {menuInsights.serving.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-md border border-[color:var(--menu-line-soft)] bg-[color:var(--paper)]/72 px-2 py-2 text-center"
                >
                  <div className="text-[10px] text-[color:var(--muted-2)]">{stat.label}</div>
                  <div
                    className={cn(
                      "mt-1 truncate text-[12px] font-medium",
                      stat.tone === "accent" && "text-[color:var(--accent)]",
                      stat.tone === "warm" && "text-[color:var(--warm)]",
                      stat.tone === "muted" && "text-[color:var(--muted)]",
                    )}
                  >
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {menuInsights.serving.notes.map((note) => (
                <span
                  key={note}
                  className="rounded-md border border-[color:rgba(63,111,85,0.18)] bg-[color:rgba(63,111,85,0.07)] px-2 py-1 text-[11px] leading-none text-[color:var(--accent)]"
                >
                  {note}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-[color:rgba(184,92,56,0.18)] bg-[linear-gradient(180deg,rgba(184,92,56,0.065),rgba(255,253,246,0.50))] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] text-[color:var(--muted-2)]">菜场预算</div>
                <div className="pk-serif mt-1 text-[18px] leading-tight">
                  {menuInsights.budget.headline}
                </div>
              </div>
              <Badge tone={budgetTone(menuInsights.budget.label)} className="shrink-0">
                {menuInsights.budget.label}
              </Badge>
            </div>

            <div className="mt-3 flex items-end justify-between gap-3 rounded-lg border border-[color:rgba(184,92,56,0.18)] bg-[color:var(--paper)]/70 px-3 py-3">
              <div>
                <div className="text-[10px] text-[color:var(--muted-2)]">估算总额</div>
                <div className="pk-serif mt-1 text-[24px] leading-none text-[color:var(--warm)]">
                  {menuInsights.budget.range}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[12px] font-medium text-[color:var(--foreground)]">
                  {menuInsights.budget.perPerson}
                </div>
                <div className="mt-1 text-[10px] text-[color:var(--muted-2)]">规则估算</div>
              </div>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color:rgba(24,33,29,0.08)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--warm))] transition-[width]"
                style={{ width: `${menuInsights.budget.meter}%` }}
              />
            </div>

            {menuInsights.budget.bands.length ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {menuInsights.budget.bands.map((band) => (
                  <div
                    key={band.label}
                    className="rounded-md border border-[color:var(--menu-line-soft)] bg-[color:var(--paper)]/72 px-2.5 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] text-[color:var(--muted-2)]">{band.label}</span>
                      <span
                        className={cn(
                          "shrink-0 text-[12px] font-medium",
                          band.tone === "warm" && "text-[color:var(--warm)]",
                          band.tone === "accent" && "text-[color:var(--accent)]",
                          band.tone === "muted" && "text-[color:var(--muted)]",
                        )}
                      >
                        {band.value}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-[10px] text-[color:var(--muted-2)]">{band.hint}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-md border border-dashed border-[color:var(--menu-line-soft)] bg-[color:var(--paper)]/52 px-3 py-3 text-[12px] leading-5 text-[color:var(--muted)]">
                先配一桌菜，预算会自动拆成主料、时蔬、汤羹和主食。
              </div>
            )}

            <div className="mt-2 flex flex-wrap gap-1.5">
              {menuInsights.budget.notes.map((note) => (
                <span
                  key={note}
                  className="rounded-md border border-[color:rgba(184,92,56,0.18)] bg-[color:rgba(184,92,56,0.07)] px-2 py-1 text-[11px] leading-none text-[color:var(--warm)]"
                >
                  {note}
                </span>
              ))}
            </div>
            <div className="mt-2 text-[10px] leading-4 text-[color:var(--muted-2)]">
              {menuInsights.budget.detail}
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
                    {guideMode === "shopping" ? "采购清单" : guideMode === "prep" ? "备菜节奏" : "厨房分工"}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[13px] font-medium text-[color:var(--accent)]">
                    {guideMetric}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[color:var(--muted-2)]">
                    {guideMetricLabel}
                  </div>
                </div>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color:rgba(24,33,29,0.08)]">
                <div
                  className="h-full rounded-full bg-[color:var(--accent)] transition-[width]"
                  style={{ width: `${guideProgressPercent}%` }}
                />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {([
                  ["shopping", "采购", `${shoppingTotal || 0}项`],
                  ["prep", "备菜", `${dinnerPrepPlan.steps.length}步`],
                  ["crew", "分工", `${menuInsights.crew.assignments.length}组`],
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

                  {shoppingTotal ? (
                    <div className="rounded-lg border border-[color:rgba(63,111,85,0.20)] bg-[color:rgba(63,111,85,0.06)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] text-[color:var(--muted-2)]">冰箱核对</div>
                          <div className="pk-serif mt-1 text-[17px] leading-tight">
                            已有 {pantryCoverage.inStock.length} 项，还买 {pantryCoverage.missing.length} 项
                          </div>
                        </div>
                        <ButtonLink href="/pantry" size="sm" variant="outline" className="h-8 shrink-0 px-2.5 text-[12px]">
                          管理
                        </ButtonLink>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color:rgba(24,33,29,0.08)]">
                        <div
                          className="h-full rounded-full bg-[color:var(--accent)] transition-[width]"
                          style={{ width: `${pantryCoverage.ratio}%` }}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {pantryCoverage.inStock.slice(0, 5).map((item) => (
                          <span
                            key={item}
                            className="rounded-md border border-[color:rgba(63,111,85,0.18)] bg-[color:var(--paper)]/70 px-2 py-1 text-[11px] text-[color:var(--accent)]"
                          >
                            有 {item}
                          </span>
                        ))}
                        {pantryCoverage.missing.slice(0, 5).map((item) => (
                          <span
                            key={item}
                            className="rounded-md border border-[color:rgba(184,92,56,0.18)] bg-[color:var(--paper)]/70 px-2 py-1 text-[11px] text-[color:var(--warm)]"
                          >
                            买 {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {menuInsights.shoppingList.length ? (
                    <div className="space-y-2.5">
                      <div className="rounded-lg border border-[color:rgba(185,148,75,0.24)] bg-[color:rgba(185,148,75,0.06)] px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] text-[color:var(--muted-2)]">菜场路线</div>
                            <div className="mt-0.5 truncate text-[12px] text-[color:var(--muted)]">
                              {menuInsights.serving.diners} 人份 · {shoppingGroupCount} 区 · {shoppingTotal} 项
                            </div>
                          </div>
                          <Badge tone="accent" className="shrink-0">
                            {shoppingPercent}%
                          </Badge>
                        </div>
                      </div>

                      {menuInsights.shoppingGroups.map((group, groupIndex) => {
                        const done = group.items.filter((item) => prepProgress.checkedItems.has(item)).length;
                        return (
                          <div
                            key={group.key}
                            className="rounded-lg border border-[color:var(--menu-line-soft)] bg-[color:var(--paper)]/72 p-2.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[color:rgba(185,148,75,0.28)] bg-[color:var(--paper-strong)]/70 text-[10px] text-[color:var(--muted)]">
                                    {String(groupIndex + 1).padStart(2, "0")}
                                  </span>
                                  <span className="pk-serif truncate text-[15px] leading-tight">{group.label}</span>
                                </div>
                                <div className="mt-1 truncate text-[11px] text-[color:var(--muted-2)]">
                                  {group.hint}
                                </div>
                              </div>
                              <Badge tone={done === group.items.length ? "accent" : "muted"} className="shrink-0 px-1.5 py-0.5 text-[10px]">
                                {done}/{group.items.length}
                              </Badge>
                            </div>

                            <div className="mt-2 grid grid-cols-2 gap-1.5">
                              {group.items.map((item) => {
                                const checked = prepProgress.checkedItems.has(item);
                                return (
                                  <button
                                    key={item}
                                    type="button"
                                    aria-label={`${checked ? "取消勾选" : "勾选"}${item}`}
                                    aria-pressed={checked}
                                    className={cn(
                                      "flex min-h-11 items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors",
                                      checked
                                        ? "border-[color:rgba(63,111,85,0.30)] bg-[color:rgba(63,111,85,0.10)] text-[color:var(--accent)]"
                                        : "border-[color:var(--line)] bg-[color:var(--paper-strong)]/58 text-[color:var(--foreground)]",
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
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-[color:var(--menu-line)] px-3 py-4 text-[12px] leading-5 text-[color:var(--muted)]">
                      这几道菜还没有整理出食材，编辑菜谱后会自动补进来。
                    </div>
                  )}
                </div>
              ) : guideMode === "prep" ? (
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
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="rounded-lg border border-[color:rgba(63,111,85,0.22)] bg-[linear-gradient(180deg,rgba(63,111,85,0.08),rgba(185,148,75,0.05))] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] text-[color:var(--muted-2)]">厨房分工</div>
                        <div className="pk-serif mt-1 text-[18px] leading-tight">
                          {menuInsights.crew.headline}
                        </div>
                        <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-[color:var(--muted)]">
                          {menuInsights.crew.summary}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0 px-2.5 text-[12px]"
                        disabled={!menuInsights.crew.assignments.length}
                        onClick={onCopyCrewPlan}
                      >
                        复制分工
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    {menuInsights.crew.assignments.map((assignment, index) => (
                      <div
                        key={assignment.key}
                        className="rounded-lg border border-[color:var(--menu-line-soft)] bg-[color:var(--paper)]/74 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[10px] font-medium",
                                  assignment.tone === "warm" &&
                                    "border-[color:rgba(184,92,56,0.24)] bg-[color:rgba(184,92,56,0.08)] text-[color:var(--warm)]",
                                  assignment.tone === "accent" &&
                                    "border-[color:rgba(63,111,85,0.24)] bg-[color:rgba(63,111,85,0.08)] text-[color:var(--accent)]",
                                  assignment.tone === "muted" &&
                                    "border-[color:rgba(185,148,75,0.30)] bg-[color:var(--paper-strong)]/70 text-[color:var(--muted)]",
                                )}
                              >
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <div className="min-w-0">
                                <div className="pk-serif truncate text-[15px] leading-tight">
                                  {assignment.label}
                                </div>
                                <div className="mt-0.5 truncate text-[10px] text-[color:var(--muted-2)]">
                                  {assignment.title}
                                </div>
                              </div>
                            </div>
                          </div>
                          <Badge tone={assignment.tone} className="shrink-0 px-1.5 py-0.5 text-[10px]">
                            {assignment.badge}
                          </Badge>
                        </div>

                        <div className="mt-2 rounded-md border border-[color:rgba(24,33,29,0.08)] bg-[color:var(--paper-strong)]/54 px-2.5 py-2 text-[11px] leading-5 text-[color:var(--muted)]">
                          {assignment.detail}
                        </div>

                        <div className="mt-2 space-y-1.5">
                          {assignment.tasks.map((task) => (
                            <div
                              key={task}
                              className="grid grid-cols-[1rem_minmax(0,1fr)] gap-2 rounded-md border border-[color:var(--line)] bg-[color:var(--paper-strong)]/56 px-2.5 py-2"
                            >
                              <span className="mt-1 h-2 w-2 rounded-sm border border-[color:var(--menu-line)]" />
                              <span className="min-w-0 text-[12px] leading-5 text-[color:var(--foreground)]">
                                {task}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
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
                memoryEntry={feedbackEntryFor(recipe.id, dishFeedback.entries)}
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

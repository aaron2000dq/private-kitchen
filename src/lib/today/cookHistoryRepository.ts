import type { Recipe } from "@/lib/recipes/types";
import type { MenuPlanScene } from "./menuInsights";

export type CookHistoryEntry = {
  id: string;
  cookedAt: string;
  recipeIds: string[];
  recipeNames: string[];
  scene: MenuPlanScene;
  score: number;
};

const KEY = "private-kitchen:cook-history:v1";
const MAX_ENTRIES = 36;
export const RECENT_COOKED_DAYS = 14;

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readEntries(): CookHistoryEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is CookHistoryEntry => {
        return (
          typeof entry?.id === "string" &&
          typeof entry?.cookedAt === "string" &&
          Array.isArray(entry?.recipeIds) &&
          Array.isArray(entry?.recipeNames)
        );
      })
      .sort((a, b) => (a.cookedAt < b.cookedAt ? 1 : -1));
  } catch {
    return [];
  }
}

function writeEntries(entries: CookHistoryEntry[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export function getRecentCookedRecipeIds(entries: CookHistoryEntry[], days = RECENT_COOKED_DAYS): string[] {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const ids = new Set<string>();
  for (const entry of entries) {
    const time = new Date(entry.cookedAt).getTime();
    if (!Number.isFinite(time) || time < since) continue;
    for (const id of entry.recipeIds) ids.add(id);
  }
  return Array.from(ids);
}

export const CookHistoryRepository = {
  async list(): Promise<CookHistoryEntry[]> {
    return readEntries();
  },

  async add({
    recipes,
    scene,
    score,
  }: {
    recipes: Recipe[];
    scene: MenuPlanScene;
    score: number;
  }): Promise<CookHistoryEntry> {
    if (!isBrowser()) throw new Error("Not in browser");
    const cookedAt = new Date().toISOString();
    const entry: CookHistoryEntry = {
      id: `meal_${Date.now().toString(36)}`,
      cookedAt,
      recipeIds: recipes.map((recipe) => recipe.id),
      recipeNames: recipes.map((recipe) => recipe.name),
      scene,
      score,
    };
    const entries = readEntries();
    writeEntries([entry, ...entries]);
    return entry;
  },

  async clear(): Promise<void> {
    if (!isBrowser()) return;
    window.localStorage.removeItem(KEY);
  },
};

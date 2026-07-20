import type { Recipe } from "@/lib/recipes/types";

export type DishFeedbackTone = "love" | "again" | "avoid";

export type DishFeedbackEntry = {
  recipeId: string;
  recipeName: string;
  tone: DishFeedbackTone;
  count: number;
  updatedAt: string;
};

export type DishFeedbackSummary = {
  reviewedCount: number;
  loveCount: number;
  againCount: number;
  avoidCount: number;
  label: string;
  headline: string;
  notes: string[];
};

export const DISH_FEEDBACK_KEY = "private-kitchen:dish-feedback:v1";

export const DISH_FEEDBACK_META: Record<
  DishFeedbackTone,
  {
    label: string;
    shortLabel: string;
    hint: string;
    score: number;
  }
> = {
  love: { label: "很喜欢", shortLabel: "喜欢", hint: "下次优先安排", score: 16 },
  again: { label: "可常做", shortLabel: "常做", hint: "适合放入日常菜单", score: 8 },
  avoid: { label: "不合口", shortLabel: "避开", hint: "下次降低推荐", score: -28 },
};

const VALID_TONES = new Set<DishFeedbackTone>(["love", "again", "avoid"]);

export function isDishFeedbackEntry(value: unknown): value is DishFeedbackEntry {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DishFeedbackEntry>;
  return (
    typeof item.recipeId === "string" &&
    typeof item.recipeName === "string" &&
    typeof item.count === "number" &&
    typeof item.updatedAt === "string" &&
    typeof item.tone === "string" &&
    VALID_TONES.has(item.tone as DishFeedbackTone)
  );
}

export function normalizeDishFeedback(value: unknown): DishFeedbackEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter(isDishFeedbackEntry)
    .map((entry) => ({
      ...entry,
      recipeName: entry.recipeName.slice(0, 24),
      count: Math.max(1, Math.min(99, Math.round(entry.count))),
    }))
    .filter((entry) => {
      if (seen.has(entry.recipeId)) return false;
      seen.add(entry.recipeId);
      return true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 160);
}

export function readDishFeedback(): DishFeedbackEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(DISH_FEEDBACK_KEY);
    return normalizeDishFeedback(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

export function persistDishFeedback(entries: DishFeedbackEntry[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(DISH_FEEDBACK_KEY, JSON.stringify(normalizeDishFeedback(entries)));
  } catch {
    // Feedback is local learning data; the menu remains usable without storage.
  }
}

export function feedbackScoreFor(recipeId: string, entries: DishFeedbackEntry[]): number {
  const entry = entries.find((item) => item.recipeId === recipeId);
  if (!entry) return 0;
  return DISH_FEEDBACK_META[entry.tone].score + Math.min(8, entry.count - 1);
}

export function feedbackEntryFor(recipeId: string, entries: DishFeedbackEntry[]): DishFeedbackEntry | null {
  return entries.find((entry) => entry.recipeId === recipeId) ?? null;
}

export function buildDishFeedbackSummary(recipes: Recipe[], entries: DishFeedbackEntry[]): DishFeedbackSummary {
  const selected = recipes
    .map((recipe) => feedbackEntryFor(recipe.id, entries))
    .filter((entry): entry is DishFeedbackEntry => Boolean(entry));
  const loveCount = selected.filter((entry) => entry.tone === "love").length;
  const againCount = selected.filter((entry) => entry.tone === "again").length;
  const avoidCount = selected.filter((entry) => entry.tone === "avoid").length;
  const reviewedCount = selected.length;
  const label =
    reviewedCount === 0
      ? "待复盘"
      : avoidCount
        ? "有争议"
        : loveCount + againCount >= Math.max(1, reviewedCount)
          ? "值得常做"
          : "已复盘";
  const likedNames = selected
    .filter((entry) => entry.tone === "love" || entry.tone === "again")
    .map((entry) => entry.recipeName)
    .slice(0, 3);
  const avoidNames = selected
    .filter((entry) => entry.tone === "avoid")
    .map((entry) => entry.recipeName)
    .slice(0, 2);

  return {
    reviewedCount,
    loveCount,
    againCount,
    avoidCount,
    label,
    headline: recipes.length ? `${reviewedCount}/${recipes.length} 道已复盘` : "先定菜单再复盘",
    notes: [
      likedNames.length ? `可常做：${likedNames.join("、")}` : "吃完后点一下反馈",
      avoidNames.length ? `下次少排：${avoidNames.join("、")}` : "喜欢的菜会提高补菜优先级",
    ],
  };
}


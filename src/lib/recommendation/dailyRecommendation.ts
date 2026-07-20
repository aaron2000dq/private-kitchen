import type { Recipe } from "@/lib/recipes/types";
import {
  DISH_FEEDBACK_META,
  feedbackEntryFor,
  feedbackScoreFor,
  type DishFeedbackEntry,
} from "@/lib/today/dishFeedback";
import { todayLocalIso } from "./recommendationDb";
import { getSeasonName } from "./seasonal";

export type DayRecommendation = {
  recommendedRecipeIds: string[];
  reason: string;
};

type RecipeRole = "protein" | "vegetable" | "soup" | "staple" | "snack" | "balanced";

const ROLE_LABEL: Record<RecipeRole, string> = {
  protein: "下饭主菜",
  vegetable: "清爽蔬菜",
  soup: "汤羹",
  staple: "主食",
  snack: "小食",
  balanced: "家常菜",
};

const SEASONAL_KEYWORDS: Record<"春" | "夏" | "秋" | "冬", string[]> = {
  春: ["春", "笋", "芽", "荠菜", "豆苗", "河鲜", "虾", "鱼", "鲜"],
  夏: ["瓜", "凉", "拌", "绿豆", "苦瓜", "藕", "茄", "番茄", "清", "汤"],
  秋: ["梨", "藕", "山药", "栗", "蟹", "菌", "菇", "蒸", "炖"],
  冬: ["炖", "锅", "汤", "萝卜", "白菜", "羊", "牛腩", "猪蹄", "暖"],
};

function hashUnit(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

function textOf(recipe: Recipe): string {
  return `${recipe.name} ${recipe.category} ${(recipe.tags ?? []).join(" ")} ${recipe.description}`.toLowerCase();
}

function roleOf(recipe: Recipe): RecipeRole {
  const text = textOf(recipe);
  if (/(汤|羹|粥|煲|炖)/.test(text)) return "soup";
  if (/(饭|面|粉|河粉|米粉|炒饭|煲仔饭|拌面)/.test(text)) return "staple";
  if (/(青菜|白菜|菠菜|生菜|油麦菜|空心菜|丝瓜|豆角|西兰花|包菜|茄子|苦瓜)/.test(text)) {
    return "vegetable";
  }
  if (/(鸡|鸭|鱼|虾|蟹|牛|羊|猪|肉|排骨|鸡翅|牛蛙|蛋|豆腐)/.test(text)) {
    return "protein";
  }
  if (/(炸|烤|卤|拼盘|火腿肠|小食|套餐)/.test(text)) return "snack";
  return "balanced";
}

function seasonScore(recipe: Recipe, date: Date): number {
  const season = getSeasonName(date.getMonth() + 1);
  const text = textOf(recipe);
  return SEASONAL_KEYWORDS[season].reduce((sum, keyword) => {
    return text.includes(keyword.toLowerCase()) ? sum + 0.65 : sum;
  }, 0);
}

function tagOverlap(a: Recipe, picked: Recipe[]): number {
  const tags = new Set((a.tags ?? []).map((x) => x.toLowerCase()));
  if (tags.size === 0) return 0;
  let overlap = 0;
  for (const recipe of picked) {
    for (const tag of recipe.tags ?? []) {
      if (tags.has(tag.toLowerCase())) overlap++;
    }
  }
  return overlap;
}

function feedbackMemoryScore(recipe: Recipe, feedbackEntries: DishFeedbackEntry[]): number {
  return feedbackScoreFor(recipe.id, feedbackEntries) * 0.12;
}

function reasonFor(date: Date, picked: Recipe[], feedbackEntries: DishFeedbackEntry[] = []): string {
  if (picked.length === 0) {
    return "先收进几道常做的菜，今天的菜单就会自动搭起来。";
  }

  const season = getSeasonName(date.getMonth() + 1);
  const roles = Array.from(new Set(picked.map((recipe) => ROLE_LABEL[roleOf(recipe)]))).slice(0, 3);
  const names = picked.map((recipe) => recipe.name).join("、");
  const memoryNames = picked
    .map((recipe) => feedbackEntryFor(recipe.id, feedbackEntries))
    .filter((entry): entry is DishFeedbackEntry => entry !== null && entry.tone !== "avoid")
    .map((entry) => `${entry.recipeName}（${DISH_FEEDBACK_META[entry.tone].shortLabel}）`)
    .slice(0, 2);
  const memoryLine = memoryNames.length ? `也回访了家里反馈好的：${memoryNames.join("、")}。` : "";
  return `${season}天适合吃得有层次些：${names}。${roles.join("、")}都照顾到，今天这餐会比较顺。${memoryLine}`;
}

export function recommendRecipesForDay(
  recipes: Recipe[],
  date: Date = new Date(),
  count = 3,
  feedbackEntries: DishFeedbackEntry[] = [],
): DayRecommendation {
  const target = Math.min(count, recipes.length);
  if (target <= 0) {
    return {
      recommendedRecipeIds: [],
      reason: reasonFor(date, [], feedbackEntries),
    };
  }

  const dateKey = todayLocalIso(date);
  const picked: Recipe[] = [];
  const pickedIds = new Set<string>();

  while (picked.length < target) {
    let best: { recipe: Recipe; score: number } | null = null;
    const pickedCategories = new Set(picked.map((recipe) => recipe.category));
    const pickedRoles = new Set(picked.map(roleOf));

    for (const recipe of recipes) {
      if (pickedIds.has(recipe.id)) continue;

      const role = roleOf(recipe);
      const random = hashUnit(`${dateKey}:${recipe.id}:${picked.length}`);
      let score =
        random * 2.8 +
        (recipe.rating ?? 0) * 0.18 +
        seasonScore(recipe, date) +
        feedbackMemoryScore(recipe, feedbackEntries);

      if (pickedCategories.has(recipe.category)) score -= 0.8;
      if (pickedRoles.has(role)) score -= 0.55;
      score -= tagOverlap(recipe, picked) * 0.18;

      if (!best || score > best.score || (score === best.score && recipe.id < best.recipe.id)) {
        best = { recipe, score };
      }
    }

    if (!best) break;
    picked.push(best.recipe);
    pickedIds.add(best.recipe.id);
  }

  return {
    recommendedRecipeIds: picked.map((recipe) => recipe.id),
    reason: reasonFor(date, picked, feedbackEntries),
  };
}

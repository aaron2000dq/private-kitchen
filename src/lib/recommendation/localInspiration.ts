import type { Recipe } from "@/lib/recipes/types";
import { getSeasonName } from "./seasonal";

const SEASONAL_KEYWORDS: Record<"春" | "夏" | "秋" | "冬", string[]> = {
  春: ["春", "笋", "芽", "野", "荠菜", "艾草", "青", "鲜", "豆苗", "河鲜", "虾", "鱼"],
  夏: ["夏", "瓜", "凉", "拌", "绿豆", "苦", "藕", "茄", "番茄", "冷", "清"],
  秋: ["秋", "梨", "菌", "菇", "山药", "栗", "蟹", "润燥", "炖", "蒸"],
  冬: ["冬", "炖", "锅", "汤", "萝卜", "白菜", "羊肉", "暖", "补", "根茎"],
};

function seasonFromDate(d: Date): "春" | "夏" | "秋" | "冬" {
  return getSeasonName(d.getMonth() + 1);
}

function scoreRecipe(r: Recipe, season: "春" | "夏" | "秋" | "冬"): number {
  const text = `${r.name} ${r.category} ${(r.tags ?? []).join(" ")}`.toLowerCase();
  const kws = SEASONAL_KEYWORDS[season];
  let s = (r.rating ?? 0) * 0.15;
  for (const k of kws) {
    if (text.includes(k)) s += 1.2;
  }
  return s;
}

/** 本地「灵感」排序：应季关键词 + 评分，稳定次要键 id */
export function rankRecipesForInspiration(recipes: Recipe[], d: Date = new Date()): Recipe[] {
  if (recipes.length === 0) return [];
  const season = seasonFromDate(d);
  return [...recipes].sort((a, b) => {
    const ds = scoreRecipe(b, season) - scoreRecipe(a, season);
    if (ds !== 0) return ds;
    return a.id.localeCompare(b.id);
  });
}

/** 简单字符串哈希 → [0,1) */
function hashUnit(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

/** 按周种子打乱，保证同周顺序稳定 */
export function shuffleRecipesForWeek(recipes: Recipe[], weekStart: string): Recipe[] {
  if (recipes.length <= 1) return recipes;
  const arr = [...recipes];
  for (let i = arr.length - 1; i > 0; i--) {
    const u = hashUnit(`${weekStart}:${arr[i]!.id}:${i}`);
    const j = Math.floor(u * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function inspirationDeck(recipes: Recipe[], weekStart: string, d: Date = new Date()): Recipe[] {
  const ranked = rankRecipesForInspiration(recipes, d);
  return shuffleRecipesForWeek(ranked, weekStart);
}

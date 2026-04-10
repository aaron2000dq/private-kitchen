import type { Recipe, RecipeIngredient } from "./types";

function rowNames(rows: RecipeIngredient[] | undefined, max: number): string[] {
  if (!rows?.length) return [];
  return rows
    .map((i) => i.name?.trim())
    .filter(Boolean)
    .slice(0, max) as string[];
}

/** 列表/首页：主料为主，必要时带辅料摘要 */
export function formatRecipeIngredientsPreview(recipe: Recipe, mainMax = 3, auxMax = 2): string | null {
  const main = rowNames(recipe.mainIngredients, mainMax);
  const aux = rowNames(recipe.auxiliaryIngredients, auxMax);
  const mainMore = (recipe.mainIngredients ?? []).filter((i) => i.name?.trim()).length > mainMax;
  const auxMore = (recipe.auxiliaryIngredients ?? []).filter((i) => i.name?.trim()).length > auxMax;

  if (!main.length && !aux.length) return null;

  const parts: string[] = [];
  if (main.length) {
    parts.push(`主料：${main.join("、")}${mainMore ? " 等" : ""}`);
  }
  if (aux.length) {
    parts.push(`辅料：${aux.join("、")}${auxMore ? " 等" : ""}`);
  }
  return parts.join(" · ");
}

import type { RecipeIngredient } from "./types";

/** 列表/首页用：展示前几项食材名，过长加「等」 */
export function formatRecipeIngredientsPreview(
  ingredients: RecipeIngredient[] | undefined,
  maxItems = 4,
): string | null {
  if (!ingredients?.length) return null;
  const named = ingredients.map((i) => i.name?.trim()).filter(Boolean) as string[];
  if (!named.length) return null;
  const head = named.slice(0, maxItems);
  const more = named.length > maxItems;
  return more ? `${head.join("、")} 等` : head.join("、");
}

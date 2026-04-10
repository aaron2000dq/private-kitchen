import data from "../../../generated/recipes.json";

type GeneratedRecipe = {
  name: string;
  category?: string;
  rating?: number;
  difficulty?: string;
  description?: string;
  tags?: string[];
  /** @deprecated 仅旧数据；新数据用 mainIngredients + auxiliaryIngredients */
  ingredients?: unknown[];
  mainIngredients?: unknown[];
  auxiliaryIngredients?: unknown[];
  steps?: unknown[];
  images?: unknown[];
};

export function getGeneratedRecipes(): GeneratedRecipe[] {
  const recipes = (data as any)?.recipes;
  return Array.isArray(recipes) ? (recipes as GeneratedRecipe[]) : [];
}

function hash32(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function ingredientRowsSig(rows: unknown[] | undefined): string {
  if (!Array.isArray(rows) || !rows.length) return "";
  return rows
    .slice(0, 20)
    .map((x: any) => `${String(x?.name ?? "").trim()}:${String(x?.amount ?? "").trim()}`)
    .join(";");
}

function ingredientsSignaturePart(r: GeneratedRecipe): string {
  const main = ingredientRowsSig(r.mainIngredients as unknown[]);
  const aux = ingredientRowsSig(r.auxiliaryIngredients as unknown[]);
  if (main || aux) return `M:${main}|A:${aux}`;
  return ingredientRowsSig(r.ingredients as unknown[]);
}

export function getGeneratedRecipesSignature(): string {
  const LOGIC_VERSION = 6;
  const recipes = getGeneratedRecipes();
  if (!recipes.length) return `v${LOGIC_VERSION}:empty`;
  const sample = recipes
    .slice(0, 60)
    .map(
      (r) =>
        `${String(r.name ?? "").trim()}|${String(r.description ?? "").trim()}|${(r.tags ?? []).join(",")}|${ingredientsSignaturePart(r)}`,
    )
    .join("\n");
  return `v${LOGIC_VERSION}:${recipes.length}:${hash32(sample).toString(16)}`;
}

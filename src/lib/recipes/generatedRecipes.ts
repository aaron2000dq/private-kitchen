import data from "../../../generated/recipes.json";

type GeneratedRecipe = {
  name: string;
  category?: string;
  rating?: number;
  difficulty?: string;
  description?: string;
  tags?: string[];
  ingredients?: unknown[];
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

/**
 * A small signature for deciding whether we should re-sync generated content
 * into IndexedDB. Changes when recipe names/descriptions/tags change.
 */
function ingredientsSignaturePart(r: GeneratedRecipe): string {
  const ing = r.ingredients;
  if (!Array.isArray(ing) || !ing.length) return "";
  return ing
    .slice(0, 24)
    .map((x: any) => `${String(x?.name ?? "").trim()}:${String(x?.amount ?? "").trim()}`)
    .join(";");
}

export function getGeneratedRecipesSignature(): string {
  const LOGIC_VERSION = 5;
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


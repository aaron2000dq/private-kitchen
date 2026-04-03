/** Deterministic id from dish name (stable across devices / static export). */
function hash32(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function stableRecipeIdFromName(name: string): string {
  const n = String(name ?? "").trim();
  if (!n) return "recipe_unnamed";
  const h = hash32(n);
  return `r_${h.toString(16).padStart(8, "0")}`;
}

/** 静态托管（GitHub Pages）下可用：不依赖为每个 id 预生成 HTML。 */
export function recipeDetailHref(id: string): string {
  return `/recipes/detail?id=${encodeURIComponent(id)}`;
}

export function recipeEditHref(id: string): string {
  return `/recipes/edit?id=${encodeURIComponent(id)}`;
}

/**
 * Resolve recipe image src for static hosting (GitHub Pages basePath) and dev.
 * Blob/data/http URLs are returned as-is; bare filenames map to /images/<name>.
 */
export function recipeImageUrl(src: string | undefined | null): string {
  if (src == null) return "";
  const s = String(src).trim();
  if (!s) return "";
  if (/^(https?:|blob:|data:)/i.test(s)) return s;
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const pathPart = s.startsWith("/") ? s : `/images/${s}`;
  return `${base}${pathPart}`;
}

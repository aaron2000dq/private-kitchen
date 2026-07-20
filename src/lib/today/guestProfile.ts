import type { Recipe } from "@/lib/recipes/types";

export type GuestConstraintKey =
  | "no-spicy"
  | "no-seafood"
  | "no-beef-lamb"
  | "less-oil"
  | "vegetarian"
  | "no-cilantro";

export type GuestProfile = {
  name: string;
  constraintKeys: GuestConstraintKey[];
  note: string;
  updatedAt?: string;
};

export type GuestFitPlan = {
  score: number;
  label: string;
  headline: string;
  summary: string;
  activeLabels: string[];
  notes: string[];
  warnings: string[];
  riskRecipes: Array<{
    recipeId: string;
    name: string;
    labels: string[];
  }>;
};

export const GUEST_PROFILE_KEY = "private-kitchen:guest-profile:v1";

export const GUEST_CONSTRAINT_OPTIONS: Array<{
  key: GuestConstraintKey;
  label: string;
  shortLabel: string;
  detail: string;
  pattern: RegExp;
  scope: "full" | "base";
}> = [
  {
    key: "no-spicy",
    label: "少辣不辣",
    shortLabel: "少辣",
    detail: "避开明显辣味、麻辣和重椒",
    pattern: /(辣|小米椒|小米辣|泡椒|剁椒|豆瓣|麻辣|酸辣|香辣|辣椒|花椒|藤椒|杭椒|青椒)/,
    scope: "full",
  },
  {
    key: "no-seafood",
    label: "不吃海鲜",
    shortLabel: "海鲜",
    detail: "鱼虾蟹贝类会被标记",
    pattern: /(海鲜|鱼|虾|蟹|贝|蛤|鲈|鲫|带鱼|鳕|鱿|墨鱼|蛏|扇贝|鲍)/,
    scope: "full",
  },
  {
    key: "no-beef-lamb",
    label: "避牛羊",
    shortLabel: "牛羊",
    detail: "牛羊肉和肥牛羊肉会被标记",
    pattern: /(牛|羊|肥牛|牛腩|羊肉|羊排)/,
    scope: "full",
  },
  {
    key: "less-oil",
    label: "少油清爽",
    shortLabel: "少油",
    detail: "油炸、干锅和肥腻菜会被标记",
    pattern: /(油炸|炸|煎|干锅|红烧|回锅|五花|肥|腊|酥|烤)/,
    scope: "base",
  },
  {
    key: "vegetarian",
    label: "素食友好",
    shortLabel: "素食",
    detail: "肉蛋水产会被标记",
    pattern: /(鸡|鸭|鱼|虾|蟹|牛|羊|猪|肉|排骨|鸡翅|牛蛙|蛋|小肠|五花|牛腩|猪蹄|腊肠|腊肉|火腿|午餐肉)/,
    scope: "full",
  },
  {
    key: "no-cilantro",
    label: "不放香菜",
    shortLabel: "香菜",
    detail: "香菜和芫荽会被标记",
    pattern: /(香菜|芫荽)/,
    scope: "full",
  },
];

const VALID_KEYS = new Set<GuestConstraintKey>(GUEST_CONSTRAINT_OPTIONS.map((option) => option.key));

export function createGuestProfile(): GuestProfile {
  return {
    name: "",
    constraintKeys: [],
    note: "",
  };
}

export function normalizeGuestProfile(value: unknown): GuestProfile {
  if (!value || typeof value !== "object") return createGuestProfile();
  const item = value as Partial<GuestProfile>;
  const constraintKeys = Array.isArray(item.constraintKeys)
    ? Array.from(
        new Set(
          item.constraintKeys.filter(
            (key): key is GuestConstraintKey => typeof key === "string" && VALID_KEYS.has(key as GuestConstraintKey),
          ),
        ),
      )
    : [];

  return {
    name: typeof item.name === "string" ? item.name.slice(0, 18) : "",
    constraintKeys,
    note: typeof item.note === "string" ? item.note.slice(0, 48) : "",
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : undefined,
  };
}

export function readGuestProfile(): GuestProfile {
  if (typeof window === "undefined") return createGuestProfile();

  try {
    const raw = window.localStorage.getItem(GUEST_PROFILE_KEY);
    return normalizeGuestProfile(raw ? JSON.parse(raw) : null);
  } catch {
    return createGuestProfile();
  }
}

export function persistGuestProfile(profile: GuestProfile) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(normalizeGuestProfile(profile)));
  } catch {
    // Guest profile is local planning data; menus remain usable without storage.
  }
}

export function guestConstraintLabels(keys: GuestConstraintKey[], max = 4): string[] {
  const labels = keys
    .map((key) => GUEST_CONSTRAINT_OPTIONS.find((option) => option.key === key)?.shortLabel)
    .filter((label): label is string => Boolean(label));
  return labels.slice(0, max);
}

function recipeGuestText(recipe: Recipe): { base: string; full: string } {
  const mainIngredients = (recipe.mainIngredients ?? []).map((item) => item.name).join(" ");
  const auxiliaryIngredients = (recipe.auxiliaryIngredients ?? []).map((item) => item.name).join(" ");
  const base = `${recipe.name} ${recipe.category} ${recipe.description} ${(recipe.tags ?? []).join(" ")} ${mainIngredients}`;
  return {
    base,
    full: `${base} ${auxiliaryIngredients}`,
  };
}

export function guestConstraintViolations(recipe: Recipe, keys: GuestConstraintKey[]): GuestConstraintKey[] {
  if (!keys.length) return [];
  const text = recipeGuestText(recipe);
  return GUEST_CONSTRAINT_OPTIONS.filter((option) => keys.includes(option.key) && option.pattern.test(text[option.scope])).map(
    (option) => option.key,
  );
}

export function isRecipeGuestSafe(recipe: Recipe, profile: GuestProfile): boolean {
  return guestConstraintViolations(recipe, profile.constraintKeys).length === 0;
}

export function filterGuestSafeRecipes(recipes: Recipe[], profile: GuestProfile): Recipe[] {
  if (!profile.constraintKeys.length) return recipes;
  return recipes.filter((recipe) => isRecipeGuestSafe(recipe, profile));
}

export function buildGuestFitPlan(recipes: Recipe[], profileInput: GuestProfile): GuestFitPlan {
  const profile = normalizeGuestProfile(profileInput);
  const activeLabels = guestConstraintLabels(profile.constraintKeys, 6);

  if (!profile.constraintKeys.length) {
    return {
      score: 100,
      label: "未设置",
      headline: profile.name ? `${profile.name} · 暂无忌口` : "暂无客人忌口",
      summary: "设置客人的口味边界后，配菜和分享简报会同步提示。",
      activeLabels,
      notes: [profile.name ? `${profile.name}暂无忌口` : "客人档案未设置", "可在菜谱页按这一桌保存偏好"],
      warnings: [],
      riskRecipes: [],
    };
  }

  const riskRecipes = recipes
    .map((recipe) => {
      const violations = guestConstraintViolations(recipe, profile.constraintKeys);
      return {
        recipeId: recipe.id,
        name: recipe.name,
        labels: guestConstraintLabels(violations, 3),
      };
    })
    .filter((item) => item.labels.length > 0);
  const warningCount = riskRecipes.reduce((sum, item) => sum + item.labels.length, 0);
  const score = recipes.length
    ? Math.max(35, Math.round(100 - (warningCount / Math.max(1, recipes.length + profile.constraintKeys.length)) * 72))
    : 100;
  const label = !recipes.length ? "待配菜" : warningCount === 0 ? "客人安心" : warningCount <= 2 ? "少量提醒" : "需要调整";
  const warnings = riskRecipes.slice(0, 3).map((item) => `${item.name}：${item.labels.join("、")}`);
  const guestName = profile.name.trim() || "这桌客人";
  const notes = [
    profile.name.trim() ? `${profile.name.trim()}已匹配` : "",
    warningCount === 0 ? "当前菜单没有明显冲突" : `${warningCount} 处需要留意`,
    profile.note.trim() ? profile.note.trim() : "",
    `${activeLabels.join("、")} 已纳入配菜判断`,
  ].filter(Boolean);

  return {
    score,
    label,
    headline: `${guestName} · ${label}`,
    summary: warningCount
      ? `有 ${riskRecipes.length} 道菜碰到客人口味边界，重配时会优先避开。`
      : recipes.length
        ? "这桌菜和客人档案匹配度很好，可以放心推进采购和备菜。"
        : "还没定菜单，配一桌时会优先避开客人忌口。",
    activeLabels,
    notes: notes.slice(0, 3),
    warnings,
    riskRecipes,
  };
}

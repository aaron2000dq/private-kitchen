import type { Recipe } from "@/lib/recipes/types";

type MenuRole = "主菜" | "蔬菜" | "汤羹" | "主食" | "小食" | "家常";
export type MenuPlanScene = "balanced" | "quick" | "banquet" | "light";

type MenuPlanPreset = {
  label: string;
  targetCount: number;
  requiredRoles: MenuRole[];
  prefer: RegExp;
  avoid?: RegExp;
};

export const MENU_PLAN_PRESETS: Record<MenuPlanScene, MenuPlanPreset> = {
  balanced: {
    label: "家常一桌",
    targetCount: 6,
    requiredRoles: ["主菜", "蔬菜", "汤羹", "主食"],
    prefer: /(家常|炒|炖|汤|饭|面|粉|豆腐|鸡|肉|青菜)/,
  },
  quick: {
    label: "快手晚餐",
    targetCount: 4,
    requiredRoles: ["主菜", "蔬菜", "主食"],
    prefer: /(快手|炒|拌|煎|清炒|面|粉|饭|蛋|豆腐)/,
    avoid: /(牛腩|排骨|鸡汤|砂锅|煲|炖|卤|烤)/,
  },
  banquet: {
    label: "私房家宴",
    targetCount: 8,
    requiredRoles: ["主菜", "蔬菜", "汤羹", "主食", "小食"],
    prefer: /(排骨|牛|鸡|鱼|虾|蟹|汤|煲|蒸|红烧|砂锅|香|宴)/,
  },
  light: {
    label: "清爽少油",
    targetCount: 5,
    requiredRoles: ["蔬菜", "汤羹", "主食", "主菜"],
    prefer: /(清|蒸|汤|粥|蔬|豆腐|丝瓜|冬瓜|白菜|凉拌|番茄|菌菇)/,
    avoid: /(炸|烤|红烧|肥|腊|小肠|五花|油炸)/,
  },
};

export type TodayMenuInsights = {
  count: number;
  score: number;
  headline: string;
  summary: string;
  roleLabels: string[];
  missing: string[];
  shoppingList: string[];
  timeline: Array<{
    label: string;
    title: string;
    detail: string;
  }>;
  stats: Array<{
    label: string;
    value: string;
  }>;
};

function recipeText(recipe: Recipe): string {
  return `${recipe.name} ${recipe.category} ${recipe.description} ${(recipe.tags ?? []).join(" ")}`;
}

function sceneWeight(recipe: Recipe, preset: MenuPlanPreset): number {
  const text = recipeText(recipe);
  const base = recipe.rating + (recipe.images.length ? 2 : 0) + 1;
  const preferBonus = preset.prefer.test(text) ? 5 : 0;
  const avoidPenalty = preset.avoid?.test(text) ? -4 : 0;
  return base + preferBonus + avoidPenalty;
}

function roleOf(recipe: Recipe): MenuRole {
  const text = recipeText(recipe);
  if (/(汤|羹|粥|煲|炖)/.test(text)) return "汤羹";
  if (/(饭|面|粉|米粉|河粉|炒饭|拌面|烩饭)/.test(text)) return "主食";
  if (/(青菜|白菜|菠菜|生菜|油麦菜|空心菜|丝瓜|豆角|西兰花|包菜|茄子|苦瓜|莴笋)/.test(text)) {
    return "蔬菜";
  }
  if (/(鸡|鸭|鱼|虾|蟹|牛|羊|猪|肉|排骨|鸡翅|牛蛙|蛋|豆腐)/.test(text)) {
    return "主菜";
  }
  if (/(炸|烤|卤|拼盘|点心|小食|烧烤)/.test(text)) return "小食";
  return "家常";
}

function weightedRandom<T>(items: T[], weightOf: (item: T) => number): T | null {
  if (!items.length) return null;
  const weighted = items.map((item) => ({
    item,
    weight: Math.max(1, weightOf(item)),
  }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = Math.random() * total;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.item;
  }
  return weighted[weighted.length - 1]?.item ?? null;
}

function pickFromRole(
  recipes: Recipe[],
  role: MenuRole,
  pickedIds: Set<string>,
  preset: MenuPlanPreset,
): Recipe | null {
  const candidates = recipes.filter((recipe) => !pickedIds.has(recipe.id) && roleOf(recipe) === role);
  return weightedRandom(candidates, (recipe) => sceneWeight(recipe, preset));
}

export function pickBalancedTodayMenu(
  recipes: Recipe[],
  max = 10,
  scene: MenuPlanScene = "balanced",
): Recipe[] {
  const preset = MENU_PLAN_PRESETS[scene];
  const targetCount = Math.min(max, recipes.length, preset.targetCount);
  const picked: Recipe[] = [];
  const pickedIds = new Set<string>();

  for (const role of preset.requiredRoles) {
    if (picked.length >= targetCount) break;
    const recipe = pickFromRole(recipes, role, pickedIds, preset);
    if (!recipe) continue;
    picked.push(recipe);
    pickedIds.add(recipe.id);
  }

  while (picked.length < targetCount) {
    const remaining = recipes.filter((recipe) => !pickedIds.has(recipe.id));
    const recipe = weightedRandom(remaining, (item) => {
      const roleBonus = picked.some((pickedRecipe) => roleOf(pickedRecipe) === roleOf(item)) ? 1 : 3;
      const categoryBonus = picked.some((pickedRecipe) => pickedRecipe.category === item.category) ? 1 : 2;
      return sceneWeight(item, preset) + roleBonus + categoryBonus;
    });
    if (!recipe) break;
    picked.push(recipe);
    pickedIds.add(recipe.id);
  }

  return picked;
}

function cookingWeight(recipe: Recipe): number {
  const text = recipeText(recipe);
  if (/(炖|煲|汤|粥|牛腩|排骨|鸡汤|砂锅)/.test(text)) return 3;
  if (/(蒸|烤|卤|焖|烧)/.test(text)) return 2;
  return 1;
}

function cleanIngredientName(name: string): string {
  return name
    .replace(/[：:，,。；;、]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildShoppingList(recipes: Recipe[]): string[] {
  const counts = new Map<string, number>();
  for (const recipe of recipes) {
    for (const ingredient of [...recipe.mainIngredients, ...recipe.auxiliaryIngredients.slice(0, 3)]) {
      const name = cleanIngredientName(ingredient.name);
      if (!name || /^(适量|少许|等|盐|水)$/.test(name)) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
    .map(([name, count]) => (count > 1 ? `${name} x${count}` : name))
    .slice(0, 12);
}

function scoreMenu(count: number, roles: Set<MenuRole>, totalWeight: number): number {
  if (count === 0) return 0;
  const countScore = Math.min(34, count * 8.5);
  const structureScore =
    (roles.has("主菜") ? 18 : 0) +
    (roles.has("蔬菜") ? 14 : 0) +
    (roles.has("汤羹") ? 12 : 0) +
    (roles.has("主食") ? 8 : 0);
  const effortScore = totalWeight <= 6 ? 14 : totalWeight <= 9 ? 10 : 6;
  return Math.min(98, Math.round(countScore + structureScore + effortScore));
}

function missingRoles(roles: Set<MenuRole>, count: number): string[] {
  const missing: string[] = [];
  if (!roles.has("主菜")) missing.push("补一道撑场面的主菜");
  if (!roles.has("蔬菜")) missing.push("加一道清爽蔬菜");
  if (!roles.has("汤羹")) missing.push("配一碗汤或粥");
  if (count < 3) missing.push("至少凑够三道更像一餐");
  if (missing.length === 0 && count < 5) missing.push("再添一道小食会更像家宴");
  if (missing.length === 0) missing.push("结构已经很完整，可以准备小票分享");
  return missing.slice(0, 3);
}

function buildTimeline(recipes: Recipe[]): TodayMenuInsights["timeline"] {
  if (recipes.length === 0) {
    return [
      { label: "01", title: "先选菜单", detail: "挑 3-5 道菜后，管家会自动拆出采购和备菜顺序。" },
      { label: "02", title: "再看结构", detail: "主菜、蔬菜、汤羹和主食齐一些，会更像一桌完整家宴。" },
      { label: "03", title: "最后分享", detail: "定好以后导出小票图，发出去就有仪式感。" },
    ];
  }

  const slow = recipes.filter((recipe) => cookingWeight(recipe) >= 3).map((recipe) => recipe.name);
  const medium = recipes.filter((recipe) => cookingWeight(recipe) === 2).map((recipe) => recipe.name);
  const quick = recipes.filter((recipe) => cookingWeight(recipe) === 1).map((recipe) => recipe.name);

  return [
    {
      label: "01",
      title: "先开火",
      detail: slow.length ? `${slow.slice(0, 2).join("、")} 这类先上炉。` : "没有长时间菜，可以先洗切备料。",
    },
    {
      label: "02",
      title: "中段处理",
      detail: medium.length ? `${medium.slice(0, 2).join("、")} 适合中段接上。` : "把酱汁、葱姜蒜和配菜提前分好。",
    },
    {
      label: "03",
      title: "临出锅",
      detail: quick.length ? `${quick.slice(0, 2).join("、")} 最后快炒或装盘。` : "最后留 10 分钟做摆盘和小票分享。",
    },
  ];
}

export function buildTodayMenuInsights(recipes: Recipe[]): TodayMenuInsights {
  const roles = new Set(recipes.map(roleOf));
  const roleLabels = Array.from(roles);
  const totalWeight = recipes.reduce((sum, recipe) => sum + cookingWeight(recipe), 0);
  const score = scoreMenu(recipes.length, roles, totalWeight);
  const missing = missingRoles(roles, recipes.length);
  const shoppingList = buildShoppingList(recipes);
  const mainNames = recipes.slice(0, 3).map((recipe) => recipe.name);

  return {
    count: recipes.length,
    score,
    headline: recipes.length ? "这桌菜已经有样子了" : "先搭一桌像样的家宴",
    summary: recipes.length
      ? `${mainNames.join("、")} ${recipes.length > 3 ? "等" : ""}已进入今日菜单，当前结构评分 ${score}/100。`
      : "选好几道菜后，这里会自动给出结构评分、采购清单和备菜节奏。",
    roleLabels,
    missing,
    shoppingList,
    timeline: buildTimeline(recipes),
    stats: [
      { label: "菜量", value: recipes.length ? `${recipes.length} 道` : "待定" },
      { label: "结构", value: roleLabels.length ? `${roleLabels.length} 类` : "待补" },
      { label: "备菜", value: totalWeight <= 6 ? "轻松" : totalWeight <= 9 ? "适中" : "偏忙" },
    ],
  };
}

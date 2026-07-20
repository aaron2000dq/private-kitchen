import type { Recipe } from "@/lib/recipes/types";
import { mealRoleOf, recipeSearchText } from "@/lib/recipes/mealRole";

type MenuRole = "主菜" | "蔬菜" | "汤羹" | "主食" | "小食" | "家常";
export type MenuPlanScene = "balanced" | "quick" | "banquet" | "light";

type MenuPlanPreset = {
  label: string;
  targetCount: number;
  requiredRoles: MenuRole[];
  prefer: RegExp;
  avoid?: RegExp;
};

type MenuPlanOptions = {
  recentRecipeIds?: Iterable<string>;
};

type ShoppingGroupKey = "protein" | "produce" | "staple" | "seasoning" | "other";

export type ShoppingGroup = {
  key: ShoppingGroupKey;
  label: string;
  hint: string;
  items: string[];
};

const SHOPPING_GROUP_META: Array<{
  key: ShoppingGroupKey;
  label: string;
  hint: string;
}> = [
  { key: "protein", label: "肉蛋水产", hint: "先买耐放主料" },
  { key: "produce", label: "时蔬菌菇", hint: "蔬菜最后挑新鲜" },
  { key: "staple", label: "主食豆制", hint: "面饭豆腐别漏" },
  { key: "seasoning", label: "调味干货", hint: "回家前补齐小料" },
  { key: "other", label: "其他", hint: "顺手确认" },
];

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
  serving: {
    diners: number;
    status: string;
    scaleLabel: string;
    summary: string;
    notes: string[];
    stats: Array<{
      label: string;
      value: string;
      tone: "warm" | "accent" | "muted";
    }>;
  };
  roleLabels: string[];
  missing: string[];
  shoppingList: string[];
  shoppingGroups: ShoppingGroup[];
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

export type DinnerPrepPlanStep = {
  label: string;
  time: string;
  title: string;
  detail: string;
  tone: "warm" | "accent" | "muted";
};

export type DinnerPrepPlan = {
  serveTime: string;
  startTime: string;
  totalMinutes: number;
  intensity: string;
  headline: string;
  steps: DinnerPrepPlanStep[];
};

function recipeText(recipe: Recipe): string {
  return recipeSearchText(recipe);
}

function sceneWeight(recipe: Recipe, preset: MenuPlanPreset, recentIds: Set<string>): number {
  const text = recipeText(recipe);
  const base = recipe.rating + (recipe.images.length ? 2 : 0) + 1;
  const preferBonus = preset.prefer.test(text) ? 5 : 0;
  const avoidPenalty = preset.avoid?.test(text) ? -4 : 0;
  const recentPenalty = recentIds.has(recipe.id) ? -8 : 0;
  return base + preferBonus + avoidPenalty + recentPenalty;
}

function roleOf(recipe: Recipe): MenuRole {
  const role = mealRoleOf(recipe);
  if (role === "main") return "主菜";
  if (role === "vegetable") return "蔬菜";
  if (role === "soup") return "汤羹";
  if (role === "staple") return "主食";
  if (role === "small") return "小食";
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
  recentIds: Set<string>,
): Recipe | null {
  const candidates = recipes.filter((recipe) => !pickedIds.has(recipe.id) && roleOf(recipe) === role);
  const fresh = candidates.filter((recipe) => !recentIds.has(recipe.id));
  const pool = fresh.length ? fresh : candidates;
  return weightedRandom(pool, (recipe) => sceneWeight(recipe, preset, recentIds));
}

export function pickBalancedTodayMenu(
  recipes: Recipe[],
  max = 10,
  scene: MenuPlanScene = "balanced",
  options: MenuPlanOptions = {},
): Recipe[] {
  const preset = MENU_PLAN_PRESETS[scene];
  const recentIds = new Set(options.recentRecipeIds ?? []);
  const targetCount = Math.min(max, recipes.length, preset.targetCount);
  const picked: Recipe[] = [];
  const pickedIds = new Set<string>();

  for (const role of preset.requiredRoles) {
    if (picked.length >= targetCount) break;
    const recipe = pickFromRole(recipes, role, pickedIds, preset, recentIds);
    if (!recipe) continue;
    picked.push(recipe);
    pickedIds.add(recipe.id);
  }

  while (picked.length < targetCount) {
    const remaining = recipes.filter((recipe) => !pickedIds.has(recipe.id));
    const freshRemaining = remaining.filter((recipe) => !recentIds.has(recipe.id));
    const pool = freshRemaining.length >= targetCount - picked.length ? freshRemaining : remaining;
    const recipe = weightedRandom(pool, (item) => {
      const roleBonus = picked.some((pickedRecipe) => roleOf(pickedRecipe) === roleOf(item)) ? 1 : 3;
      const categoryBonus = picked.some((pickedRecipe) => pickedRecipe.category === item.category) ? 1 : 2;
      return sceneWeight(item, preset, recentIds) + roleBonus + categoryBonus;
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

function estimateRecipeMinutes(recipe: Recipe): number {
  const text = recipeText(recipe);
  const role = mealRoleOf(recipe);
  if (/(牛腩|猪蹄|排骨|老鸭|鸡汤|砂锅|煲|炖|卤|粥)/.test(text)) return 52;
  if (/(蒸|焖|红烧|烤|煎|汤|羹)/.test(text)) return role === "soup" ? 42 : 32;
  if (role === "staple") return 24;
  if (role === "vegetable") return 14;
  return 20;
}

function parseTimeMinutes(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return 19 * 60;
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return hour * 60 + minute;
}

function formatClock(totalMinutes: number): string {
  const minutesInDay = 24 * 60;
  const rounded = Math.round(totalMinutes / 5) * 5;
  const normalized = ((rounded % minutesInDay) + minutesInDay) % minutesInDay;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function roundUpToFive(minutes: number): number {
  return Math.ceil(minutes / 5) * 5;
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

function shoppingItemName(item: string): string {
  return item.replace(/\s+x\d+$/i, "").trim();
}

function shoppingGroupKeyOf(item: string): ShoppingGroupKey {
  const name = shoppingItemName(item);
  if (/(油|盐|糖|酱|醋|料酒|生抽|老抽|蚝油|淀粉|胡椒|花椒|八角|桂皮|香叶|孜然|辣椒粉|豆瓣|火锅底料|芝麻|香油|蜂蜜|鸡精|味精)/.test(name)) {
    return "seasoning";
  }
  if (/(鸡|鸭|鱼|虾|蟹|牛|羊|猪|肉|排骨|鸡翅|牛蛙|蛋|小肠|五花|牛腩|猪蹄|腊肠|腊肉|肥牛)/.test(name)) {
    return "protein";
  }
  if (/(青菜|白菜|菠菜|生菜|油麦菜|空心菜|丝瓜|豆角|西兰花|包菜|茄子|苦瓜|莴笋|蒲菜|菜苔|萝卜|芹菜|莴苣|冬瓜|南瓜|土豆|番茄|西红柿|蘑菇|香菇|菌|葱|姜|蒜|青椒|辣椒|蔬)/.test(name)) {
    return "produce";
  }
  if (/(米|饭|面|粉|河粉|米粉|粉丝|饼|豆腐|豆皮|腐竹|年糕|馒头|面包|土司)/.test(name)) {
    return "staple";
  }
  return "other";
}

function buildShoppingGroups(items: string[]): ShoppingGroup[] {
  const grouped = new Map<ShoppingGroupKey, string[]>();
  for (const item of items) {
    const key = shoppingGroupKeyOf(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return SHOPPING_GROUP_META.map((meta) => ({
    ...meta,
    items: grouped.get(meta.key) ?? [],
  })).filter((group) => group.items.length > 0);
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

function clampDiners(diners: number): number {
  if (!Number.isFinite(diners)) return 2;
  return Math.min(10, Math.max(1, Math.round(diners)));
}

function servingScaleLabel(diners: number): string {
  if (diners <= 2) return "基础份量";
  if (diners <= 4) return "适中加量";
  if (diners <= 6) return "主菜加量";
  return "家宴大份";
}

function buildServingPlan(recipes: Recipe[], dinersInput: number, roles: Set<MenuRole>): TodayMenuInsights["serving"] {
  const diners = clampDiners(dinersInput);
  const count = recipes.length;
  const mainCount = recipes.filter((recipe) => roleOf(recipe) === "主菜").length;
  const vegetableCount = recipes.filter((recipe) => roleOf(recipe) === "蔬菜").length;
  const soupCount = recipes.filter((recipe) => roleOf(recipe) === "汤羹").length;
  const targetDishCount = diners <= 2 ? 3 : diners <= 4 ? 5 : diners <= 6 ? 7 : 8;
  const targetMainCount = diners <= 3 ? 1 : diners <= 6 ? 2 : 3;
  const perPerson = count ? count / diners : 0;
  const notes: string[] = [];

  if (!count) {
    notes.push(`先按 ${diners} 人挑菜`);
    notes.push("主菜、时蔬、汤羹先配齐");
  } else {
    if (count < targetDishCount) {
      notes.push(`再补 ${targetDishCount - count} 道更从容`);
    } else {
      notes.push("菜量够摆一桌");
    }

    if (mainCount < targetMainCount) {
      notes.push(`主菜建议到 ${targetMainCount} 道`);
    } else {
      notes.push("主菜压得住席面");
    }

    if (!vegetableCount && diners >= 3) {
      notes.push("加一道青菜解腻");
    } else if (!soupCount && diners >= 4) {
      notes.push("配一碗汤更完整");
    }
  }

  const status =
    !count
      ? "待配桌"
      : count < targetDishCount
        ? "略紧"
        : mainCount < targetMainCount
          ? "需硬菜"
          : roles.has("蔬菜") && (roles.has("汤羹") || diners <= 3)
            ? "很稳"
            : "可优化";

  const summary =
    count === 0
      ? `${diners} 人份菜单会同步影响采购和备菜提示。`
      : `${diners} 人吃，当前约 ${perPerson.toFixed(1)} 道/人，${servingScaleLabel(diners)}。`;

  return {
    diners,
    status,
    scaleLabel: servingScaleLabel(diners),
    summary,
    notes: notes.slice(0, 3),
    stats: [
      { label: "人数", value: `${diners} 人`, tone: "warm" },
      { label: "菜量", value: count ? `${count}/${targetDishCount} 道` : `目标 ${targetDishCount} 道`, tone: count >= targetDishCount ? "accent" : "muted" },
      { label: "硬菜", value: `${mainCount}/${targetMainCount} 道`, tone: mainCount >= targetMainCount ? "accent" : "warm" },
    ],
  };
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

export function buildDinnerPrepPlan(recipes: Recipe[], serveTime = "19:00"): DinnerPrepPlan {
  const normalizedServeTime = formatClock(parseTimeMinutes(serveTime));

  if (recipes.length === 0) {
    return {
      serveTime: normalizedServeTime,
      startTime: normalizedServeTime,
      totalMinutes: 0,
      intensity: "待定",
      headline: "选好菜单后生成开饭排程",
      steps: [
        {
          label: "01",
          time: normalizedServeTime,
          title: "先定开饭时间",
          detail: "选好菜以后，这里会按开饭时间倒推备料、开火和出锅顺序。",
          tone: "muted",
        },
      ],
    };
  }

  const weightedRecipes = recipes
    .map((recipe) => ({
      recipe,
      minutes: estimateRecipeMinutes(recipe),
      weight: cookingWeight(recipe),
    }))
    .sort((a, b) => b.minutes - a.minutes || b.weight - a.weight || a.recipe.name.localeCompare(b.recipe.name, "zh-CN"));
  const slow = weightedRecipes.filter((entry) => entry.minutes >= 42);
  const medium = weightedRecipes.filter((entry) => entry.minutes >= 24 && entry.minutes < 42);
  const quick = weightedRecipes.filter((entry) => entry.minutes < 24);
  const longest = weightedRecipes[0]?.minutes ?? 0;
  const prepOverhead = Math.min(34, 8 + recipes.length * 4);
  const parallelSaving = Math.max(0, recipes.length - 3) * 4;
  const totalMinutes = Math.min(125, Math.max(30, roundUpToFive(longest + prepOverhead - parallelSaving)));
  const serveMinutes = parseTimeMinutes(normalizedServeTime);
  const startMinutes = serveMinutes - totalMinutes;
  const intensity =
    totalMinutes <= 45 ? "轻松" : totalMinutes <= 75 ? "稳妥" : totalMinutes <= 100 ? "偏忙" : "家宴级";
  const slowNames = slow.map((entry) => entry.recipe.name);
  const mediumNames = medium.map((entry) => entry.recipe.name);
  const quickNames = quick.map((entry) => entry.recipe.name);

  const steps: DinnerPrepPlanStep[] = [
    {
      label: "01",
      time: formatClock(startMinutes),
      title: "开始备料",
      detail: `先洗切、分装调料和主辅料，${recipes.length} 道菜预计留 ${totalMinutes} 分钟更从容。`,
      tone: "muted",
    },
    {
      label: "02",
      time: formatClock(serveMinutes - Math.min(56, Math.max(34, longest))),
      title: slow.length ? "慢菜先上炉" : "先处理耐放菜",
      detail: slow.length
        ? `${slowNames.slice(0, 2).join("、")} 先炖/煲/焖，避免临开饭时占火。`
        : "没有明显慢菜，可以先做主食、汤底或需要提前入味的菜。",
      tone: slow.length ? "warm" : "muted",
    },
    {
      label: "03",
      time: formatClock(serveMinutes - 26),
      title: medium.length ? "中段接热菜" : "中段整理台面",
      detail: medium.length
        ? `${mediumNames.slice(0, 3).join("、")} 这一段接上，留出最后调味和装盘时间。`
        : "把盘子、汤碗和配菜摆好，快手菜先别急着下锅。",
      tone: "accent",
    },
    {
      label: "04",
      time: formatClock(serveMinutes - 12),
      title: quick.length ? "最后快炒装盘" : "最后收汁摆盘",
      detail: quick.length
        ? `${quickNames.slice(0, 3).join("、")} 最后做，热气和口感最稳。`
        : "最后检查咸淡、收汁和摆盘，热菜按出锅顺序上桌。",
      tone: "accent",
    },
    {
      label: "05",
      time: normalizedServeTime,
      title: "开饭上桌",
      detail: "汤羹先落位，热菜接上，主食和小食补齐桌面节奏。",
      tone: "warm",
    },
  ];

  return {
    serveTime: normalizedServeTime,
    startTime: formatClock(startMinutes),
    totalMinutes,
    intensity,
    headline: `${formatClock(startMinutes)} 开始更稳，${normalizedServeTime} 开饭。`,
    steps,
  };
}

export function buildTodayMenuInsights(recipes: Recipe[], dinersInput = 2): TodayMenuInsights {
  const roles = new Set(recipes.map(roleOf));
  const roleLabels = Array.from(roles);
  const totalWeight = recipes.reduce((sum, recipe) => sum + cookingWeight(recipe), 0);
  const score = scoreMenu(recipes.length, roles, totalWeight);
  const missing = missingRoles(roles, recipes.length);
  const shoppingList = buildShoppingList(recipes);
  const shoppingGroups = buildShoppingGroups(shoppingList);
  const mainNames = recipes.slice(0, 3).map((recipe) => recipe.name);
  const serving = buildServingPlan(recipes, dinersInput, roles);

  return {
    count: recipes.length,
    score,
    headline: recipes.length ? "这桌菜已经有样子了" : "先搭一桌像样的家宴",
    summary: recipes.length
      ? `${mainNames.join("、")} ${recipes.length > 3 ? "等" : ""}已进入今日菜单，当前结构评分 ${score}/100，${serving.diners} 人份。`
      : "选好几道菜后，这里会自动给出结构评分、采购清单和备菜节奏。",
    serving,
    roleLabels,
    missing,
    shoppingList,
    shoppingGroups,
    timeline: buildTimeline(recipes),
    stats: [
      { label: "菜量", value: recipes.length ? `${recipes.length} 道` : "待定" },
      { label: "结构", value: roleLabels.length ? `${roleLabels.length} 类` : "待补" },
      { label: "备菜", value: totalWeight <= 6 ? "轻松" : totalWeight <= 9 ? "适中" : "偏忙" },
    ],
  };
}

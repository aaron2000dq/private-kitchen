export type PantryCategoryKey = "protein" | "produce" | "staple" | "seasoning" | "other";

export type PantryItem = {
  id: string;
  name: string;
  category: PantryCategoryKey;
  amount: string;
  updatedAt: string;
};

export type PantryCoverage = {
  total: number;
  inStock: string[];
  missing: string[];
  ratio: number;
};

export const PANTRY_KEY = "private-kitchen:pantry:v1";

export const PANTRY_CATEGORIES: Array<{
  key: PantryCategoryKey;
  label: string;
  hint: string;
}> = [
  { key: "protein", label: "肉蛋水产", hint: "冷冻、鸡蛋、豆制品" },
  { key: "produce", label: "时蔬菌菇", hint: "叶菜、根茎、菌菇" },
  { key: "staple", label: "主食豆制", hint: "米面粉、豆腐、粉丝" },
  { key: "seasoning", label: "调味干货", hint: "油盐酱醋、葱姜蒜" },
  { key: "other", label: "其他", hint: "临时补充" },
];

const DEFAULT_PANTRY_NAMES = [
  ["鸡蛋", "6枚"],
  ["大米", "半袋"],
  ["挂面", "1把"],
  ["豆腐", "1盒"],
  ["生抽", "半瓶"],
  ["食用油", "足量"],
  ["盐", "足量"],
  ["糖", "少量"],
  ["葱", "少许"],
  ["姜", "少许"],
  ["蒜", "少许"],
] as const;

export function createPantryItem(name: string, amount = "有"): PantryItem {
  const trimmed = name.trim().slice(0, 18);
  const safeName = trimmed || "未命名食材";
  return {
    id: `pantry_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: safeName,
    category: categorizePantryItem(safeName),
    amount: amount.trim().slice(0, 16) || "有",
    updatedAt: new Date().toISOString(),
  };
}

export function createDefaultPantryItems(): PantryItem[] {
  return DEFAULT_PANTRY_NAMES.map(([name, amount], index) => ({
    id: `default_${index}_${name}`,
    name,
    category: categorizePantryItem(name),
    amount,
    updatedAt: new Date().toISOString(),
  }));
}

export function categorizePantryItem(name: string): PantryCategoryKey {
  if (/(油|盐|糖|酱|醋|料酒|生抽|老抽|蚝油|淀粉|胡椒|花椒|八角|桂皮|香叶|孜然|辣椒|豆瓣|芝麻|香油|鸡精|味精|葱|姜|蒜)/.test(name)) {
    return "seasoning";
  }
  if (/(鸡|鸭|鱼|虾|蟹|牛|羊|猪|肉|排骨|鸡翅|牛蛙|蛋|小肠|五花|牛腩|猪蹄|腊肠|腊肉|肥牛)/.test(name)) {
    return "protein";
  }
  if (/(青菜|白菜|菠菜|生菜|油麦菜|空心菜|丝瓜|豆角|西兰花|包菜|茄子|苦瓜|莴笋|萝卜|芹菜|冬瓜|南瓜|土豆|番茄|西红柿|蘑菇|香菇|菌|青椒|蔬)/.test(name)) {
    return "produce";
  }
  if (/(米|饭|面|粉|河粉|米粉|粉丝|饼|豆腐|豆皮|腐竹|年糕|馒头|面包|土司)/.test(name)) {
    return "staple";
  }
  return "other";
}

export function normalizePantryItemName(value: string): string {
  return value
    .replace(/\s*x\d+$/i, "")
    .replace(/[，,。；;：:（）()【】[\]\s]/g, "")
    .trim()
    .toLowerCase();
}

export function isPantryItem(value: unknown): value is PantryItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<PantryItem>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.amount === "string" &&
    typeof item.updatedAt === "string" &&
    PANTRY_CATEGORIES.some((category) => category.key === item.category)
  );
}

export function normalizePantryItems(value: unknown): PantryItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter(isPantryItem)
    .map((item) => ({
      ...item,
      name: item.name.trim().slice(0, 18),
      amount: item.amount.trim().slice(0, 16) || "有",
      category: categorizePantryItem(item.name),
    }))
    .filter((item) => {
      const key = normalizePantryItemName(item.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 80);
}

export function readPantryItems(): PantryItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(PANTRY_KEY);
    return normalizePantryItems(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

export function persistPantryItems(items: PantryItem[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(PANTRY_KEY, JSON.stringify(normalizePantryItems(items)));
  } catch {
    // Pantry is local planning data; shopping lists stay usable without storage.
  }
}

export function pantryHasShoppingItem(shoppingItem: string, pantryItems: PantryItem[]): boolean {
  const target = normalizePantryItemName(shoppingItem);
  if (!target) return false;

  return pantryItems.some((item) => {
    const stocked = normalizePantryItemName(item.name);
    if (!stocked) return false;
    return target === stocked || target.includes(stocked) || stocked.includes(target);
  });
}

export function buildPantryCoverage(shoppingList: string[], pantryItems: PantryItem[]): PantryCoverage {
  const inStock: string[] = [];
  const missing: string[] = [];

  for (const item of shoppingList) {
    if (pantryHasShoppingItem(item, pantryItems)) {
      inStock.push(item);
    } else {
      missing.push(item);
    }
  }

  const total = shoppingList.length;
  return {
    total,
    inStock,
    missing,
    ratio: total ? Math.round((inStock.length / total) * 100) : 0,
  };
}


import type { Recipe } from "./types";

export const RecipeCategories = [
  "家常菜",
  "煎炸烧烤",
  "煲仔",
  "粥面粉",
  "素菜",
  "汤羹",
  "海鲜",
  "西餐",
  "火锅",
] as const;

export type RecipeCategory = (typeof RecipeCategories)[number];

export const RECIPE_CATEGORY_RULE_VERSION = 3;

function hasAny(s: string, patterns: RegExp[]) {
  return patterns.some((p) => p.test(s));
}

const meatLike = [
  /牛腩|牛肉|肥牛|牛排|猪蹄|五花肉|扣肉|排骨|鸡|鸡翅|鸡腿|鸭|腊肉|腊肠|香肠|培根|肉丸|卤肉/,
];
const seafoodLike = [/虾|蟹|鱼|鲈鱼|鱿鱼|海鲜/];
const vegLike = [
  /豆腐|青菜|菠菜|生菜|空心菜|白菜|丝瓜|南瓜|菜苔|油麦菜|娃娃菜|茄子|西兰花|菌菇|口蘑|杏鲍菇|萝卜|山药/,
];
const westernLike = [
  /法式|意面|意大利|牛排|沙拉|地中海|黑椒|黄油|芝士|奶油|烤箱|焗/,
];

export function classifyRecipeCategory(input: {
  name: string;
  ingredientsText?: string;
  tags?: string[];
}): RecipeCategory {
  const text = [
    input.name,
    input.ingredientsText ?? "",
    ...(input.tags ?? []),
  ]
    .join(" ")
    .trim();

  if (hasAny(text, westernLike)) return "西餐";

  // soups (avoid the generic “汤” to prevent false positives like “蛋黄”等)
  if (/(羹|蛋花汤|排骨汤|鸡汤|牛肉汤|鱼汤|汤面|汤粉|汤丸)/.test(text)) return "汤羹";

  // casserole / clay pot
  if (/(煲仔|瓦煲|砂锅|沙锅)/.test(text)) return "煲仔";

  // congee / noodles / powder
  if (/(粥|饭|面|粉|河粉|米粉|拌面|汤面|焖饭|烩饭|炒饭)/.test(text))
    return "粥面粉";

  // hotpot
  if (/(火锅|锅底)/.test(text)) return "火锅";

  // fried / grilled
  // “咸蛋黄鸡翅”这类名字不一定带“炸/煎/烤”，因此增加“翅/腿/排骨/蛋黄/酥脆”等常见线索
  if (/(煎|炸|烤|烧烤|椒盐|香煎|香炸|咸蛋黄|蛋黄|鸡翅|鸡腿|排骨|薯条|酥|脆皮|香酥)/.test(text))
    return "煎炸烧烤";

  // seafood
  if (hasAny(text, seafoodLike)) return "海鲜";

  // vegetarian: no meat/seafood but looks like vegetables/tofu/mushroom etc.
  const isVegDish = hasAny(text, vegLike);
  const hasMeat = hasAny(text, meatLike);
  const hasSeafood = hasAny(text, seafoodLike);
  if (isVegDish && !hasMeat && !hasSeafood) return "素菜";

  return "家常菜";
}

export function reclassifyRecipe(r: Recipe): Recipe {
  const ingredientsText = [...(r.mainIngredients ?? []), ...(r.auxiliaryIngredients ?? [])]
    .map((i) => `${i.name}${i.amount ? `(${i.amount})` : ""}`)
    .join(" ");
  const category = classifyRecipeCategory({
    name: r.name,
    ingredientsText,
    tags: r.tags,
  });
  return { ...r, category };
}


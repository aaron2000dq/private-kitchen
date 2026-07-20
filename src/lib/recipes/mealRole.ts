import type { Recipe } from "@/lib/recipes/types";

export type MealRole = "main" | "vegetable" | "soup" | "staple" | "small" | "home";

export const MEAL_ROLE_META: Record<
  MealRole,
  {
    label: string;
    receiptLabel: string;
    shortLabel: string;
    note: string;
    order: number;
  }
> = {
  main: { label: "主菜", receiptLabel: "热菜主菜", shortLabel: "主菜", note: "撑起席面", order: 1 },
  vegetable: { label: "蔬菜", receiptLabel: "时令蔬菜", shortLabel: "蔬菜", note: "清爽解腻", order: 2 },
  soup: { label: "汤羹", receiptLabel: "汤羹暖碗", shortLabel: "汤羹", note: "收住烟火", order: 3 },
  staple: { label: "主食", receiptLabel: "主食点心", shortLabel: "点心", note: "压稳一餐", order: 4 },
  small: { label: "小食", receiptLabel: "家常小食", shortLabel: "小食", note: "添一点兴致", order: 5 },
  home: { label: "家常", receiptLabel: "家常小食", shortLabel: "小食", note: "添一点兴致", order: 6 },
};

const VEGETABLE_PATTERN = /(青菜|白菜|菠菜|生菜|油麦菜|空心菜|丝瓜|豆角|西兰花|包菜|茄子|苦瓜|莴笋|蒲菜|菜苔|萝卜|芹菜|莴苣|冬瓜|蔬|素菜)/;
const ANIMAL_PROTEIN_PATTERN = /(鸡|鸭|鱼|虾|蟹|牛|羊|猪|肉|排骨|鸡翅|牛蛙|蛋|小肠|五花|牛腩|猪蹄|腊肠|腊肉)/;
const MAIN_PATTERN = /(鸡|鸭|鱼|虾|蟹|牛|羊|猪|肉|排骨|鸡翅|牛蛙|蛋|豆腐|肥牛|小肠|五花|牛腩|猪蹄|腊肠|腊肉)/;
const STAPLE_PATTERN = /(饭|面|米粉|河粉|炒饭|拌面|烩饭|煲仔饭|螺蛳粉|粉(?!丝)|饼|点心)/;
const SOUP_PATTERN = /(汤|羹|粥)/;

export function recipeSearchText(recipe: Recipe): string {
  return `${recipe.name} ${recipe.category} ${recipe.description} ${(recipe.tags ?? []).join(" ")}`;
}

export function mealRoleOf(recipe: Recipe): MealRole {
  const name = recipe.name;
  const tags = (recipe.tags ?? []).join(" ");
  const mainIngredients = (recipe.mainIngredients ?? []).map((item) => item.name).join(" ");
  const primaryText = `${name} ${recipe.category} ${tags} ${mainIngredients}`;

  if (SOUP_PATTERN.test(name) || /(炖汤|家常汤|暖汤)/.test(tags)) return "soup";
  if (STAPLE_PATTERN.test(name) || /(主食|点心)/.test(tags)) return "staple";
  if (VEGETABLE_PATTERN.test(name) && !ANIMAL_PROTEIN_PATTERN.test(primaryText)) return "vegetable";
  if (MAIN_PATTERN.test(primaryText)) return "main";
  if (VEGETABLE_PATTERN.test(primaryText)) return "vegetable";
  if (SOUP_PATTERN.test(recipeSearchText(recipe))) return "soup";
  if (/(炸|烤|卤|拼盘|小食|烧烤)/.test(primaryText)) return "small";
  return "home";
}

export function mealRoleLabel(recipe: Recipe): string {
  return MEAL_ROLE_META[mealRoleOf(recipe)].label;
}

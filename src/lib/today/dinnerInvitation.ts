import type { Recipe } from "@/lib/recipes/types";
import type { GuestFitPlan } from "./guestProfile";
import type { TodayMenuInsights } from "./menuInsights";
import type { PantryCoverage } from "./pantry";

type DinnerInvitationOptions = {
  recipes: Recipe[];
  insights: TodayMenuInsights;
  guestFit: GuestFitPlan;
  pantryCoverage: PantryCoverage;
  dinnerTime?: string;
};

function compactNames(names: string[], fallback: string, max = 8): string {
  const visible = names.slice(0, max);
  if (!visible.length) return fallback;
  return `${visible.join("、")}${names.length > max ? "等" : ""}`;
}

function todayTitle(date = new Date()): string {
  return `${date.getMonth() + 1}月${date.getDate()}日 · 私房家宴`;
}

function guestLine(guestFit: GuestFitPlan): string {
  if (guestFit.activeLabels.length) {
    return `忌口我记好了：${guestFit.activeLabels.join("、")}。`;
  }
  if (guestFit.riskRecipes.length) {
    return `我会再核对忌口：${guestFit.warnings.slice(0, 2).join("；")}。`;
  }
  return "口味我会按大家都好入口来。";
}

export function buildDinnerInvitationText({
  recipes,
  insights,
  guestFit,
  pantryCoverage,
  dinnerTime = "19:00",
}: DinnerInvitationOptions): string {
  const names = recipes.map((recipe) => recipe.name);
  const menuLine = compactNames(names, "菜单还在调整");
  const pantryLine = pantryCoverage.total
    ? `家里已有 ${pantryCoverage.inStock.length} 项，出门再补 ${pantryCoverage.missing.length} 项。`
    : "我会提前把采购和备菜安排好。";

  return [
    `${todayTitle()} 邀请`,
    `今晚 ${dinnerTime} 来家里吃饭呀。`,
    `我准备了 ${recipes.length || "几"} 道：${menuLine}。`,
    `这桌偏「${insights.palate.label}」，${insights.budget.perPerson} 左右。`,
    guestLine(guestFit),
    pantryLine,
    "直接来就好，厨房我来统筹。",
  ].join("\n");
}

export function buildDinnerConfirmationText({
  recipes,
  insights,
  guestFit,
  pantryCoverage,
  dinnerTime = "19:00",
}: DinnerInvitationOptions): string {
  const names = recipes.map((recipe) => recipe.name);
  return [
    `${todayTitle()} · 菜单确认`,
    `开饭时间：${dinnerTime}`,
    `人数：${insights.serving.diners} 人`,
    `菜单：${compactNames(names, "待定", 12)}`,
    `口味：${insights.palate.label} · ${insights.palate.score}分`,
    `预算：${insights.budget.range} · ${insights.budget.perPerson}`,
    `客人：${guestFit.label}${guestFit.activeLabels.length ? ` · ${guestFit.activeLabels.join("、")}` : ""}`,
    `冰箱：已有 ${pantryCoverage.inStock.length} 项 · 还买 ${pantryCoverage.missing.length} 项`,
    "回复我：可以 / 少辣点 / 想换一道。",
  ].join("\n");
}


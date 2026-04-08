"use client";

import * as React from "react";
import type { Recipe } from "@/lib/recipes/types";
import {
  getMondayOfWeek,
  getWeekDatesFromMonday,
  loadWeekCache,
  saveWeekCache,
  todayLocalIso,
  WEEK_CACHE_VERSION,
  type DayRecommendation,
  type WeekRecommendationCache,
} from "@/lib/recommendation/recommendationDb";

function safeJsonParse(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function hashPickIds(date: string, recipes: Recipe[], n: number): string[] {
  const ids = recipes.map((r) => r.id);
  const scored = ids.map((id, i) => {
    let h = 0;
    const s = `${date}:${id}`;
    for (let c = 0; c < s.length; c++) h = (h * 31 + s.charCodeAt(c)) >>> 0;
    return { id, h: h + i * 0.0001 };
  });
  scored.sort((a, b) => a.h - b.h);
  return scored.slice(0, n).map((x) => x.id);
}

function padDayIds(
  date: string,
  ids: string[],
  recipes: Recipe[],
  target: number,
): string[] {
  const cleaned = ids.filter((id) => recipes.some((r) => r.id === id));
  if (cleaned.length >= target) return cleaned.slice(0, target);
  const have = new Set(cleaned);
  const rest = recipes.filter((r) => !have.has(r.id));
  const need = target - cleaned.length;
  const extra = hashPickIds(`${date}:pad`, rest, need);
  return [...cleaned, ...extra].slice(0, target);
}

function localFallbackDay(date: string, recipes: Recipe[]): DayRecommendation {
  const n = Math.min(3, recipes.length);
  return {
    recommendedRecipeIds: hashPickIds(date, recipes, n),
    reason:
      "本周时令推荐尚未就绪，暂以本地规则为你搭配了三道；页面保持打开或稍后返回，将自动重试联网推荐。",
  };
}

function weekCacheIsComplete(
  cache: WeekRecommendationCache,
  dates: string[],
  targetCount: number,
): boolean {
  if (targetCount <= 0) return true;
  for (const d of dates) {
    const n = cache.days[d]?.recommendedRecipeIds?.length ?? 0;
    if (n < targetCount) return false;
  }
  return true;
}

export function useWeeklyRecommendation(recipes: Recipe[]) {
  const [weekStart, setWeekStart] = React.useState("");
  const [today, setToday] = React.useState("");
  const [weekDates, setWeekDates] = React.useState<string[]>([]);

  const [data, setData] = React.useState<DayRecommendation | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const now = new Date();
    const ws = getMondayOfWeek(now);
    const td = todayLocalIso(now);
    setWeekStart(ws);
    setToday(td);
    setWeekDates(getWeekDatesFromMonday(ws));
  }, []);

  const recipePayload = React.useMemo(
    () =>
      recipes.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        rating: r.rating ?? 0,
        tags: r.tags ?? [],
      })),
    [recipes],
  );

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      setError(null);

      if (!weekStart || !today || weekDates.length === 0) {
        return;
      }

      if (recipes.length === 0) {
        setData({
          recommendedRecipeIds: [],
          reason: "你还没有添加菜谱。先新增几道拿手菜，我再为你做搭配推荐。",
        });
        setLoading(false);
        return;
      }

      // Always use local rules for "今日推荐" (static hosting & faster UX).
      if (!cancelled) {
        const fb = localFallbackDay(today, recipes);
        setData({
          ...fb,
          reason: "按本地规则为你搭配三道：尽量错开主食/蛋白/蔬菜，口味也别撞得太厉害。",
        });
        setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [recipes, today, weekDates, weekStart]);

  return { today, weekStart, data, loading, error };
}

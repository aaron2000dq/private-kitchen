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

      const cached = await loadWeekCache();
      const targetCount = Math.min(3, recipes.length);

      if (
        cached &&
        cached.weekStart === weekStart &&
        (cached.v ?? 0) >= WEEK_CACHE_VERSION &&
        cached.source !== "fallback" &&
        weekCacheIsComplete(cached, weekDates, targetCount) &&
        cached.days[today]
      ) {
        if (!cancelled) {
          setData(cached.days[today]);
          setLoading(false);
        }
        return;
      }

      // GitHub Pages / static export: no server API routes; use local rules only.
      if (process.env.NEXT_PUBLIC_STATIC_EXPORT === "1") {
        if (!cancelled) {
          const fb = localFallbackDay(today, recipes);
          setData({
            ...fb,
            reason:
              "当前为静态站点（GitHub Pages），无服务端大模型接口；时令推荐使用本地规则。",
          });
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      try {
        const resp = await fetch("/api/recommend/week", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dates: weekDates,
            recipes: recipePayload,
          }),
        });
        const raw = await resp.text();
        const json = (safeJsonParse(raw) as any) ?? null;
        if (!resp.ok) {
          const serverMsg =
            (json && typeof json?.error === "string" && json.error) ||
            (json && typeof json?.details === "string" && json.details) ||
            raw;
          throw new Error(
            serverMsg?.trim()
              ? `本周推荐请求失败：${String(serverMsg).trim().slice(0, 240)}`
              : "本周推荐请求失败",
          );
        }
        const daysObj = json?.days as Record<string, DayRecommendation> | undefined;
        if (!daysObj || typeof daysObj !== "object") {
          throw new Error("推荐接口返回格式异常。");
        }

        const merged: Record<string, DayRecommendation> = { ...daysObj };
        const target = Math.min(3, recipes.length);
        let llmTodayHasAny = false;
        for (const d of weekDates) {
          const raw = merged[d];
          if (!raw?.recommendedRecipeIds?.length) {
            merged[d] = localFallbackDay(d, recipes);
            continue;
          }
          if (d === today) llmTodayHasAny = true;
          const ids = padDayIds(d, raw.recommendedRecipeIds, recipes, target);
          merged[d] = {
            recommendedRecipeIds: ids,
            reason: raw.reason?.trim()
              ? raw.reason
              : "结合当日时令，为你搭配了三道菜。",
          };
        }

        const nextCache: WeekRecommendationCache = {
          weekStart,
          days: merged,
          updatedAt: new Date().toISOString(),
          source: "llm",
          v: WEEK_CACHE_VERSION,
        };
        if (!cancelled) {
          // 若“今天”没有从 LLM 返回有效推荐，避免缓存 fallback 结果导致下次永远不再重试。
          if (llmTodayHasAny) {
            await saveWeekCache(nextCache);
          }
          setData(merged[today] ?? localFallbackDay(today, recipes));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "本周推荐加载失败");
          setData(localFallbackDay(today, recipes));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [recipes, recipePayload, today, weekDates, weekStart]);

  return { today, weekStart, data, loading, error };
}

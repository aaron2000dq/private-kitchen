"use client";

import * as React from "react";
import type { Recipe } from "@/lib/recipes/types";
import type { MenuPlanScene } from "./menuInsights";
import type { CookHistoryEntry } from "./cookHistoryRepository";
import {
  CookHistoryRepository,
  RECENT_COOKED_DAYS,
  getRecentCookedRecipeIds,
} from "./cookHistoryRepository";

export function useCookHistory() {
  const [hydrated, setHydrated] = React.useState(false);
  const [entries, setEntries] = React.useState<CookHistoryEntry[]>([]);

  const refresh = React.useCallback(async () => {
    const next = await CookHistoryRepository.list();
    setEntries(next);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      const next = await CookHistoryRepository.list();
      if (cancelled) return;
      setEntries(next);
      setHydrated(true);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const record = React.useCallback(
    async (recipes: Recipe[], scene: MenuPlanScene, score: number) => {
      const entry = await CookHistoryRepository.add({ recipes, scene, score });
      await refresh();
      return entry;
    },
    [refresh],
  );

  const recentRecipeIds = React.useMemo(() => getRecentCookedRecipeIds(entries), [entries]);

  return {
    hydrated,
    entries,
    recentRecipeIds,
    recentWindowDays: RECENT_COOKED_DAYS,
    record,
    refresh,
  };
}

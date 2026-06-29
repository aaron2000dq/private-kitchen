"use client";

import * as React from "react";
import type { Recipe } from "@/lib/recipes/types";
import { recommendRecipesForDay } from "./dailyRecommendation";
import { todayLocalIso } from "./recommendationDb";

export function useDailyRecommendation(recipes: Recipe[]) {
  const [date, setDate] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setDate(new Date());
  }, []);

  const data = React.useMemo(() => {
    if (!date) return null;
    return recommendRecipesForDay(recipes, date, 3);
  }, [date, recipes]);

  return {
    today: date ? todayLocalIso(date) : "",
    data,
    loading: date === null,
    error: null,
  };
}

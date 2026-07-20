"use client";

import * as React from "react";
import type { Recipe } from "@/lib/recipes/types";
import type { DishFeedbackEntry } from "@/lib/today/dishFeedback";
import { recommendRecipesForDay } from "./dailyRecommendation";
import { todayLocalIso } from "./recommendationDb";

const EMPTY_FEEDBACK_ENTRIES: DishFeedbackEntry[] = [];

export function useDailyRecommendation(
  recipes: Recipe[],
  feedbackEntries: DishFeedbackEntry[] = EMPTY_FEEDBACK_ENTRIES,
) {
  const [date, setDate] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setDate(new Date());
  }, []);

  const data = React.useMemo(() => {
    if (!date) return null;
    return recommendRecipesForDay(recipes, date, 3, feedbackEntries);
  }, [date, feedbackEntries, recipes]);

  return {
    today: date ? todayLocalIso(date) : "",
    data,
    loading: date === null,
    error: null,
  };
}

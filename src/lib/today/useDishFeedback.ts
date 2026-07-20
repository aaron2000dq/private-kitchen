"use client";

import * as React from "react";
import type { Recipe } from "@/lib/recipes/types";
import {
  persistDishFeedback,
  readDishFeedback,
  type DishFeedbackEntry,
  type DishFeedbackTone,
} from "./dishFeedback";

function reviewDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function isSameReviewDay(updatedAt: string, now: Date): boolean {
  const previous = new Date(updatedAt);
  if (Number.isNaN(previous.getTime())) return false;
  return reviewDayKey(previous) === reviewDayKey(now);
}

export function useDishFeedback() {
  const [hydrated, setHydrated] = React.useState(false);
  const [entries, setEntries] = React.useState<DishFeedbackEntry[]>([]);

  React.useEffect(() => {
    setEntries(readDishFeedback());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    persistDishFeedback(entries);
  }, [entries, hydrated]);

  const setFeedback = React.useCallback((recipe: Recipe, tone: DishFeedbackTone) => {
    setEntries((current) => {
      const nowDate = new Date();
      const now = nowDate.toISOString();
      const existing = current.find((entry) => entry.recipeId === recipe.id);
      const count = existing ? (isSameReviewDay(existing.updatedAt, nowDate) ? existing.count : existing.count + 1) : 1;
      const next: DishFeedbackEntry = {
        recipeId: recipe.id,
        recipeName: recipe.name,
        tone,
        count,
        updatedAt: now,
      };
      return [next, ...current.filter((entry) => entry.recipeId !== recipe.id)].slice(0, 160);
    });
  }, []);

  const removeFeedback = React.useCallback((recipeId: string) => {
    setEntries((current) => current.filter((entry) => entry.recipeId !== recipeId));
  }, []);

  return {
    hydrated,
    entries,
    setFeedback,
    removeFeedback,
  };
}

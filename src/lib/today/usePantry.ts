"use client";

import * as React from "react";
import {
  createDefaultPantryItems,
  createPantryItem,
  persistPantryItems,
  readPantryItems,
  type PantryItem,
} from "./pantry";

export function usePantry() {
  const [hydrated, setHydrated] = React.useState(false);
  const [items, setItems] = React.useState<PantryItem[]>([]);

  React.useEffect(() => {
    setItems(readPantryItems());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    persistPantryItems(items);
  }, [hydrated, items]);

  const add = React.useCallback((name: string, amount = "有") => {
    const item = createPantryItem(name, amount);
    setItems((current) => {
      const normalizedName = item.name.trim();
      if (!normalizedName) return current;
      const exists = current.some((entry) => entry.name.trim() === normalizedName);
      if (exists) {
        return current.map((entry) =>
          entry.name.trim() === normalizedName
            ? { ...entry, amount: item.amount, updatedAt: new Date().toISOString() }
            : entry,
        );
      }
      return [item, ...current].slice(0, 80);
    });
    return item;
  }, []);

  const remove = React.useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const seedDefaults = React.useCallback(() => {
    setItems((current) => {
      const existingNames = new Set(current.map((item) => item.name.trim()));
      const defaults = createDefaultPantryItems().filter((item) => !existingNames.has(item.name.trim()));
      return [...defaults, ...current].slice(0, 80);
    });
  }, []);

  const clear = React.useCallback(() => {
    setItems([]);
  }, []);

  return {
    hydrated,
    items,
    add,
    remove,
    seedDefaults,
    clear,
  };
}


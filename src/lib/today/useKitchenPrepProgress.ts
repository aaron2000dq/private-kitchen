"use client";

import * as React from "react";

type PrepProgressSnapshot = {
  menuKey: string;
  checkedItems: string[];
};

const KEY = "private-kitchen:kitchen-prep:v1";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function cleanItem(item: string): string {
  return item.trim();
}

function readSnapshot(menuKey: string): Set<string> {
  if (!isBrowser() || !menuKey) return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Partial<PrepProgressSnapshot>;
    if (parsed.menuKey !== menuKey || !Array.isArray(parsed.checkedItems)) return new Set();
    return new Set(parsed.checkedItems.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
}

function writeSnapshot(menuKey: string, checkedItems: Set<string>) {
  if (!isBrowser() || !menuKey) return;
  const snapshot: PrepProgressSnapshot = {
    menuKey,
    checkedItems: Array.from(checkedItems),
  };
  window.localStorage.setItem(KEY, JSON.stringify(snapshot));
}

export function useKitchenPrepProgress(menuKey: string, items: string[]) {
  const [hydrated, setHydrated] = React.useState(false);
  const [checked, setChecked] = React.useState<Set<string>>(new Set());

  const itemKey = React.useMemo(() => items.map(cleanItem).join("|"), [items]);

  React.useEffect(() => {
    const validItems = new Set(items.map(cleanItem));
    const stored = readSnapshot(menuKey);
    const filtered = new Set(Array.from(stored).filter((item) => validItems.has(item)));
    setChecked(filtered);
    setHydrated(true);
  }, [itemKey, items, menuKey]);

  const persist = React.useCallback(
    (next: Set<string>) => {
      setChecked(new Set(next));
      writeSnapshot(menuKey, next);
    },
    [menuKey],
  );

  const toggle = React.useCallback(
    (item: string) => {
      const normalized = cleanItem(item);
      const next = new Set(checked);
      if (next.has(normalized)) {
        next.delete(normalized);
      } else {
        next.add(normalized);
      }
      persist(next);
    },
    [checked, persist],
  );

  const completeAll = React.useCallback(() => {
    persist(new Set(items.map(cleanItem)));
  }, [items, persist]);

  const reset = React.useCallback(() => {
    persist(new Set());
  }, [persist]);

  return {
    hydrated,
    checkedItems: checked,
    doneCount: checked.size,
    toggle,
    completeAll,
    reset,
  };
}

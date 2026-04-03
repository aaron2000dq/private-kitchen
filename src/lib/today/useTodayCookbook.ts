"use client";

import * as React from "react";
import type { TodayCookbook } from "./todayCookbookRepository";
import { TodayCookbookRepository } from "./todayCookbookRepository";

const DEFAULT_MAX = 3;

export function useTodayCookbook(max: number = DEFAULT_MAX) {
  const [hydrated, setHydrated] = React.useState(false);
  const [value, setValue] = React.useState<TodayCookbook | null>(null);
  const ids = value?.ids ?? [];

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      const loaded = await TodayCookbookRepository.load();
      if (cancelled) return;
      setValue(loaded);
      setHydrated(true);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = React.useCallback(async (nextIds: string[]) => {
    const next: TodayCookbook = {
      ids: nextIds,
      updatedAt: new Date().toISOString(),
    };
    setValue(next);
    await TodayCookbookRepository.save(next);
  }, []);

  const add = React.useCallback(
    async (id: string) => {
      if (ids.includes(id)) return { ok: true, added: false as const };
      if (ids.length >= max) return { ok: false, added: false as const };
      const next = [...ids, id];
      await persist(next);
      return { ok: true, added: true as const };
    },
    [ids, max, persist],
  );

  const remove = React.useCallback(
    async (id: string) => {
      if (!ids.includes(id)) return;
      const next = ids.filter((x) => x !== id);
      await persist(next);
    },
    [ids, persist],
  );

  const clear = React.useCallback(async () => {
    setValue(null);
    await TodayCookbookRepository.clear();
  }, []);

  return {
    hydrated,
    ids,
    has: (id: string) => ids.includes(id),
    max,
    add,
    remove,
    clear,
  };
}


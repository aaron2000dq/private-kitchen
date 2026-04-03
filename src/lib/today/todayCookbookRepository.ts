import { openDB, type DBSchema } from "idb";

export type TodayCookbook = {
  /** recipe ids in order */
  ids: string[];
  updatedAt: string;
};

const DB_NAME = "private-kitchen-today";
const STORE = "kv";
const KEY = "cookbook";

interface TodayDB extends DBSchema {
  kv: {
    key: string;
    value: TodayCookbook;
  };
}

function isBrowser() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

async function db() {
  return openDB<TodayDB>(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore(STORE);
    },
  });
}

export const TodayCookbookRepository = {
  async load(): Promise<TodayCookbook | null> {
    if (!isBrowser()) return null;
    const d = await db();
    return (await d.get(STORE, KEY)) ?? null;
  },

  async save(value: TodayCookbook): Promise<void> {
    if (!isBrowser()) throw new Error("Not in browser");
    const d = await db();
    await d.put(STORE, value, KEY);
  },

  async clear(): Promise<void> {
    if (!isBrowser()) return;
    const d = await db();
    await d.delete(STORE, KEY);
  },
};


import { openDB, type DBSchema } from "idb";

export type DayRecommendation = {
  recommendedRecipeIds: string[];
  reason: string;
};

export type WeekRecommendationCache = {
  weekStart: string;
  /** ISO date YYYY-MM-DD -> recommendation */
  days: Record<string, DayRecommendation>;
  updatedAt: string;
  /** llm：模型生成；缺省视为旧版缓存（升级后仍会刷新一次） */
  source?: "llm" | "fallback";
  /** 缓存结构版本；低于当前则丢弃并重新拉取 */
  v?: number;
};

export const WEEK_CACHE_VERSION = 2;

interface RecDB extends DBSchema {
  kv: {
    key: string;
    value: WeekRecommendationCache;
  };
}

const DB_NAME = "private-kitchen-rec";
const STORE = "kv";
const WEEK_KEY = "weekly";

function isBrowser() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

async function db() {
  return openDB<RecDB>(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore(STORE);
    },
  });
}

export async function loadWeekCache(): Promise<WeekRecommendationCache | null> {
  if (!isBrowser()) return null;
  const d = await db();
  const v = await d.get(STORE, WEEK_KEY);
  return v ?? null;
}

export async function saveWeekCache(cache: WeekRecommendationCache): Promise<void> {
  if (!isBrowser()) return;
  const d = await db();
  await d.put(STORE, cache, WEEK_KEY);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** YYYY-MM-DD（本地日历） */
export function todayLocalIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** ISO 周一日期（本地时区） */
export function getMondayOfWeek(d: Date = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}

export function getWeekDatesFromMonday(mondayIso: string): string[] {
  const parts = mondayIso.split("-").map(Number);
  const y = parts[0]!;
  const mo = parts[1]!;
  const day = parts[2]!;
  const base = new Date(y, mo - 1, day);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const t = new Date(base);
    t.setDate(base.getDate() + i);
    dates.push(`${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`);
  }
  return dates;
}

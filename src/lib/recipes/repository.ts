import { openDB, type DBSchema } from "idb";
import { Recipe, RecipeInput } from "./types";
import { RECIPE_CATEGORY_RULE_VERSION, reclassifyRecipe } from "./classify";
import {
  RECIPE_DESCRIPTION_RULE_VERSION,
  withGeneratedDescription,
} from "./describe";
import { getGeneratedRecipes, getGeneratedRecipesSignature } from "./generatedRecipes";
import { stableRecipeIdFromName } from "./stableRecipeId";
import { TodayCookbookRepository } from "@/lib/today/todayCookbookRepository";

const LEGACY_STORAGE_KEY = "private-kitchen:recipes";
const CATEGORY_VERSION_KEY = "private-kitchen:category-rule-version";
const DESCRIPTION_VERSION_KEY = "private-kitchen:description-rule-version";
const GENERATED_DESC_SYNC_KEY = "private-kitchen:generated-desc-sync-sig";
const STABLE_ID_MIGRATION_KEY = "private-kitchen:stable-id-migration-v1";
const SEEDED_FROM_GENERATED_KEY = "private-kitchen:seeded-from-generated-v1";

interface PrivateKitchenDB extends DBSchema {
  recipes: {
    key: string;
    value: Recipe;
    indexes: { "by-updatedAt": string };
  };
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `recipe_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

async function getDb() {
  return await openDB<PrivateKitchenDB>("private-kitchen", 1, {
    upgrade(db) {
      const store = db.createObjectStore("recipes", { keyPath: "id" });
      store.createIndex("by-updatedAt", "updatedAt");
    },
  });
}

async function migrateFromLocalStorageIfNeeded(): Promise<void> {
  if (!isBrowser()) return;

  const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacyRaw) return;

  let legacy: Record<string, Recipe> | null = null;
  try {
    legacy = JSON.parse(legacyRaw) as Record<string, Recipe>;
  } catch {
    legacy = null;
  }
  if (!legacy) return;

  const recipes = Object.values(legacy);
  if (recipes.length === 0) {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    return;
  }

  const db = await getDb();
  const existingCount = await db.count("recipes");
  if (existingCount > 0) {
    // If IndexedDB already has data, do not overwrite.
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    return;
  }

  const tx = db.transaction("recipes", "readwrite");
  for (const r of recipes) {
    await tx.store.put(r);
  }
  await tx.done;
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
}

async function maybeMigrateRecipeCategoriesIfNeeded(): Promise<void> {
  if (!isBrowser()) return;
  const raw = window.localStorage.getItem(CATEGORY_VERSION_KEY);
  const current = raw ? Number(raw) : 0;
  if (!Number.isFinite(current)) return;
  if (current >= RECIPE_CATEGORY_RULE_VERSION) return;

  const db = await getDb();
  const all = await db.getAll("recipes");
  if (all.length > 0) {
    const tx = db.transaction("recipes", "readwrite");
    for (const r of all) {
      await tx.store.put(reclassifyRecipe(r));
    }
    await tx.done;
  }

  window.localStorage.setItem(
    CATEGORY_VERSION_KEY,
    String(RECIPE_CATEGORY_RULE_VERSION),
  );
}

async function maybeMigrateRecipeDescriptionsIfNeeded(): Promise<void> {
  if (!isBrowser()) return;
  const raw = window.localStorage.getItem(DESCRIPTION_VERSION_KEY);
  const current = raw ? Number(raw) : 0;
  if (!Number.isFinite(current)) return;
  if (current >= RECIPE_DESCRIPTION_RULE_VERSION) return;

  const db = await getDb();
  const all = await db.getAll("recipes");
  if (all.length > 0) {
    const tx = db.transaction("recipes", "readwrite");
    for (const r of all) {
      await tx.store.put(withGeneratedDescription(r));
    }
    await tx.done;
  }

  window.localStorage.setItem(
    DESCRIPTION_VERSION_KEY,
    String(RECIPE_DESCRIPTION_RULE_VERSION),
  );
}

async function maybeMigrateStableRecipeIds(): Promise<void> {
  if (!isBrowser()) return;
  if (window.localStorage.getItem(STABLE_ID_MIGRATION_KEY) === "1") return;

  const db = await getDb();
  const all = await db.getAll("recipes");
  if (all.length === 0) {
    window.localStorage.setItem(STABLE_ID_MIGRATION_KEY, "1");
    return;
  }

  const oldToNew = new Map<string, string>();
  for (const r of all) {
    oldToNew.set(r.id, stableRecipeIdFromName(r.name));
  }

  const bestByName = new Map<string, Recipe>();
  for (const r of all) {
    const prev = bestByName.get(r.name);
    if (!prev || new Date(r.updatedAt) >= new Date(prev.updatedAt)) {
      const nid = stableRecipeIdFromName(r.name);
      bestByName.set(r.name, { ...r, id: nid });
    }
  }

  const out = Array.from(bestByName.values());

  const tx = db.transaction("recipes", "readwrite");
  for (const r of all) {
    await tx.store.delete(r.id);
  }
  for (const r of out) {
    await tx.store.put(r);
  }
  await tx.done;

  const idSet = new Set(out.map((x) => x.id));
  const tc = await TodayCookbookRepository.load();
  if (tc?.ids?.length) {
    const newIds = tc.ids
      .map((oid) => oldToNew.get(oid) ?? oid)
      .filter((id) => idSet.has(id));
    await TodayCookbookRepository.save({
      ids: [...new Set(newIds)],
      updatedAt: new Date().toISOString(),
    });
  }

  window.localStorage.setItem(STABLE_ID_MIGRATION_KEY, "1");
}

async function maybeSyncDescriptionsFromGeneratedJson(): Promise<void> {
  if (!isBrowser()) return;
  const sig = getGeneratedRecipesSignature();
  if (window.localStorage.getItem(GENERATED_DESC_SYNC_KEY) === sig) return;

  const generated = getGeneratedRecipes();
  if (!generated.length) {
    window.localStorage.setItem(GENERATED_DESC_SYNC_KEY, sig);
    return;
  }

  const byName = new Map<string, { description?: string; tags?: string[] }>();
  for (const r of generated) {
    const name = String(r?.name ?? "").trim();
    if (!name) continue;
    byName.set(name, { description: r.description, tags: r.tags });
  }

  const db = await getDb();
  const all = await db.getAll("recipes");
  if (all.length > 0) {
    const tx = db.transaction("recipes", "readwrite");
    for (const r of all) {
      const incoming = byName.get(String(r.name ?? "").trim());
      if (!incoming) continue;

      const nextDesc = String(incoming.description ?? "").trim();
      const nextTags = Array.isArray(incoming.tags) ? incoming.tags.map(String) : [];

      const updated: Recipe = {
        ...r,
        // Intentionally do NOT touch category/ratings/etc; only overwrite generated content.
        description: nextDesc || r.description,
        tags: nextTags
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 10),
      };
      await tx.store.put(updated);
    }
    await tx.done;
  }

  window.localStorage.setItem(GENERATED_DESC_SYNC_KEY, sig);
}

async function maybeSeedRecipesFromGeneratedJson(): Promise<void> {
  if (!isBrowser()) return;
  if (window.localStorage.getItem(SEEDED_FROM_GENERATED_KEY) === "1") return;

  const db = await getDb();
  const existingCount = await db.count("recipes");
  if (existingCount > 0) {
    window.localStorage.setItem(SEEDED_FROM_GENERATED_KEY, "1");
    return;
  }

  const generated = getGeneratedRecipes();
  if (!generated.length) {
    window.localStorage.setItem(SEEDED_FROM_GENERATED_KEY, "1");
    return;
  }

  const now = new Date().toISOString();
  const tx = db.transaction("recipes", "readwrite");
  for (const g of generated as any[]) {
    const name = String(g?.name ?? "").trim();
    if (!name) continue;
    const id = stableRecipeIdFromName(name);
    const recipe: Recipe = {
      id,
      name,
      category: String(g?.category ?? "家常菜"),
      rating: Number.isFinite(Number(g?.rating)) ? Number(g.rating) : 0,
      difficulty:
        g?.difficulty === "easy" || g?.difficulty === "hard" || g?.difficulty === "medium"
          ? g.difficulty
          : "medium",
      tags: Array.isArray(g?.tags) ? g.tags.map(String).map((s: string) => s.trim()).filter(Boolean).slice(0, 10) : [],
      description: String(g?.description ?? "").trim(),
      ingredients: Array.isArray(g?.ingredients)
        ? g.ingredients
            .filter((x: any) => x && typeof x === "object")
            .map((x: any) => ({
              name: String(x.name ?? "").trim(),
              amount: String(x.amount ?? "").trim(),
              note: x.note != null ? String(x.note).trim() : undefined,
            }))
            .filter((x: any) => x.name || x.amount)
        : [],
      steps: Array.isArray(g?.steps)
        ? g.steps
            .filter((x: any) => x && typeof x === "object")
            .map((x: any, i: number) => ({
              order: Number.isFinite(Number(x.order)) ? Number(x.order) : i + 1,
              content: String(x.content ?? "").trim(),
              tip: x.tip != null ? String(x.tip).trim() : undefined,
            }))
            .filter((x: any) => x.content)
        : [],
      images: Array.isArray(g?.images) ? g.images.map(String).map((s: string) => s.trim()).filter(Boolean).slice(0, 10) : [],
      createdAt: now,
      updatedAt: now,
    };
    await tx.store.put(recipe);
  }
  await tx.done;

  window.localStorage.setItem(SEEDED_FROM_GENERATED_KEY, "1");
}

async function ensureRecipeMigrations(): Promise<void> {
  if (!isBrowser()) return;
  await migrateFromLocalStorageIfNeeded();
  await maybeSeedRecipesFromGeneratedJson();
  await maybeMigrateStableRecipeIds();
  await maybeMigrateRecipeCategoriesIfNeeded();
  await maybeMigrateRecipeDescriptionsIfNeeded();
  await maybeSyncDescriptionsFromGeneratedJson();
}

function normalizeRecipe(input: RecipeInput, base?: Recipe): Recipe {
  const now = new Date().toISOString();
  const nameTrim = String(input.name ?? base?.name ?? "").trim();
  const id =
    base?.id ??
    input.id ??
    (nameTrim ? stableRecipeIdFromName(nameTrim) : generateId());
  const createdAt = base?.createdAt ?? now;

  return {
    id,
    name: input.name ?? base?.name ?? "",
    category: input.category ?? base?.category ?? "",
    rating: input.rating ?? base?.rating ?? 0,
    difficulty: input.difficulty ?? base?.difficulty ?? "medium",
    tags: input.tags ?? base?.tags ?? [],
    description: input.description ?? base?.description ?? "",
    ingredients: input.ingredients ?? base?.ingredients ?? [],
    steps: input.steps ?? base?.steps ?? [],
    images: input.images ?? base?.images ?? [],
    createdAt,
    updatedAt: now,
  };
}

export const RecipeRepository = {
  async list(): Promise<Recipe[]> {
    if (!isBrowser()) return [];
    await ensureRecipeMigrations();
    const db = await getDb();
    const all = await db.getAll("recipes");
    return all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async get(id: string): Promise<Recipe | null> {
    if (!isBrowser()) return null;
    await ensureRecipeMigrations();
    const db = await getDb();
    return (await db.get("recipes", id)) ?? null;
  },

  async create(input: RecipeInput): Promise<Recipe> {
    if (!isBrowser()) throw new Error("Not in browser");
    await ensureRecipeMigrations();
    const db = await getDb();
    const recipe = normalizeRecipe(input);
    await db.put("recipes", recipe);
    return recipe;
  },

  async update(id: string, input: Partial<RecipeInput>): Promise<Recipe | null> {
    if (!isBrowser()) return null;
    await ensureRecipeMigrations();
    const db = await getDb();
    const existing = await db.get("recipes", id);
    if (!existing) return null;
    const updated = normalizeRecipe({ ...existing, ...input, id }, existing);
    await db.put("recipes", updated);
    return updated;
  },

  async delete(id: string): Promise<void> {
    if (!isBrowser()) return;
    await ensureRecipeMigrations();
    const db = await getDb();
    await db.delete("recipes", id);
  },

  async upsertMany(inputs: RecipeInput[]): Promise<Recipe[]> {
    if (!isBrowser()) throw new Error("Not in browser");
    await ensureRecipeMigrations();
    const db = await getDb();
    const tx = db.transaction("recipes", "readwrite");
    const results: Recipe[] = [];
    for (const input of inputs) {
      const nameTrim = String(input.name ?? "").trim();
      const id =
        input.id ??
        (nameTrim ? stableRecipeIdFromName(nameTrim) : generateId());
      const existing = await tx.store.get(id);
      const updated = normalizeRecipe({ ...input, id }, existing ?? undefined);
      await tx.store.put(updated);
      results.push(updated);
    }
    await tx.done;
    return results;
  },

  async exportAll(): Promise<Recipe[]> {
    return await this.list();
  },

  async replaceMany(recipes: Recipe[]): Promise<void> {
    if (!isBrowser()) throw new Error("Not in browser");
    await ensureRecipeMigrations();
    const db = await getDb();
    const tx = db.transaction("recipes", "readwrite");
    for (const r of recipes) {
      await tx.store.put(r);
    }
    await tx.done;
  },
};


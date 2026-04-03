"use client";

import * as React from "react";
import { useRecipes } from "@/lib/recipes/useRecipes";
import { RecipeRepository } from "@/lib/recipes/repository";
import { reclassifyRecipe, RecipeCategories } from "@/lib/recipes/classify";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useTodayCookbook } from "@/lib/today/useTodayCookbook";
import { RecipeCard } from "@/components/recipes/RecipeCard";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function CategoriesClient() {
  const { recipes, hydrated, update } = useRecipes();
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState<string>("全部");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const { ids: todayIds, has: isTodaySelected, add: addToToday, max: todayMax } =
    useTodayCookbook();
  const [draggingRecipeId, setDraggingRecipeId] = React.useState<string | null>(null);
  const [dropCategory, setDropCategory] = React.useState<string | null>(null);
  const [changingCategory, setChangingCategory] = React.useState(false);
  const activeRef = React.useRef<string>(active);
  const suppressNextClickRef = React.useRef(false);
  const pendingRecipeIdRef = React.useRef<string | null>(null);
  const pendingPointerIdRef = React.useRef<number | null>(null);
  const pendingStartRef = React.useRef<{ x: number; y: number; t: number } | null>(null);
  const draggingRecipeIdRef = React.useRef<string | null>(null);
  const dropCategoryRef = React.useRef<string | null>(null);

  const categories = React.useMemo(() => {
    // Prefer a stable, curated category order (only show your supported categories).
    const present = new Set<string>();
    for (const r of recipes) {
      const c = r.category?.trim();
      if (!c) continue;
      if (RecipeCategories.includes(c as any)) present.add(c);
    }
    return RecipeCategories.filter((c) => present.has(c));
  }, [recipes]);

  React.useEffect(() => {
    if (active !== "全部" && categories.length && !categories.includes(active as any)) {
      setActive("全部");
    }
  }, [active, categories]);

  React.useEffect(() => {
    activeRef.current = active;
  }, [active]);

  React.useEffect(() => {
    draggingRecipeIdRef.current = draggingRecipeId;
  }, [draggingRecipeId]);

  React.useEffect(() => {
    dropCategoryRef.current = dropCategory;
  }, [dropCategory]);

  React.useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      if (!suppressNextClickRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      suppressNextClickRef.current = false;
    };
    window.addEventListener("click", onClickCapture, true);
    return () => window.removeEventListener("click", onClickCapture, true);
  }, []);

  const getCategoryFromPoint = React.useCallback((x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const btn = el?.closest("button[data-cat]") as HTMLButtonElement | null;
    const cat = btn?.dataset.cat ?? null;
    if (!cat) return null;
    if (!RecipeCategories.includes(cat as any)) return null;
    return cat;
  }, []);

  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    return recipes
      .filter((r) => (active === "全部" ? true : r.category === active))
      .filter((r) => {
        if (!query) return true;
        const hay = [r.name, r.category, r.description, ...(r.tags ?? [])]
          .join(" ")
          .toLowerCase();
        return hay.includes(query);
      });
  }, [active, q, recipes]);

  const onReclassify = async () => {
    setMsg(null);
    setBusy(true);
    try {
      const next = recipes.map(reclassifyRecipe);
      await RecipeRepository.replaceMany(next);
      setMsg("已按新分类规则重新整理。");
      window.location.reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "重新分类失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="font-[var(--font-noto-serif-sc)] text-[26px] tracking-wide">
            分类
          </h1>
          <p className="text-[13px] leading-6 text-[color:var(--muted)]">
            按类别聚合，你会更容易找到想做的那一道。
          </p>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索：菜名 / 标签"
            className="md:max-w-sm"
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onReclassify} disabled={!hydrated || busy}>
              {busy ? "整理中…" : "按新规则重新分类"}
            </Button>
            {msg ? <span className="text-[12px] text-[color:var(--muted-2)]">{msg}</span> : null}
          </div>
        </div>
      </div>

      <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 border-b border-[color:var(--line)] bg-[color:var(--paper)]/90 backdrop-blur py-3">
        <button
          type="button"
          onClick={() => setActive("全部")}
          className={cn(
            "rounded-full border px-3 py-1.5 text-[12px] transition-colors",
            active === "全部"
              ? "border-[color:rgba(107,142,107,0.35)] bg-[color:rgba(107,142,107,0.10)] text-[color:var(--foreground)]"
              : "border-[color:var(--line)] text-[color:var(--muted)] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
          )}
        >
          全部
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            data-cat={c}
            onClick={(e) => {
              if (draggingRecipeIdRef.current) {
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              setActive(c);
            }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12px] transition-colors",
              active === c
                ? "border-[color:rgba(107,142,107,0.35)] bg-[color:rgba(107,142,107,0.10)] text-[color:var(--foreground)]"
                : "border-[color:var(--line)] text-[color:var(--muted)] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
              dropCategory === c
                ? "border-[color:rgba(107,142,107,0.95)] bg-[color:rgba(107,142,107,0.16)] text-[color:var(--foreground)]"
                : "",
            )}
          >
            {c}
          </button>
        ))}
        <div className="ml-auto text-[12px] text-[color:var(--muted-2)]">
          {hydrated ? `${filtered.length} 道菜` : "读取中…"}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {hydrated && filtered.length === 0 ? (
          <div className="md:col-span-2 xl:col-span-3 rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper)] p-10 text-center">
            <Badge tone="muted">空</Badge>
            <p className="mt-3 text-[13px] leading-7 text-[color:var(--muted)]">
              这个分类暂时没有内容。
            </p>
          </div>
        ) : null}

        {filtered.map((r) => {
          const selected = isTodaySelected(r.id);
          const canAdd = !selected && todayIds.length < todayMax;
          const dragEnabled = active === "全部" && !changingCategory;
          return (
            <div
              key={r.id}
              className="contents"
              onPointerDown={(e) => {
                if (!dragEnabled) return;
                const target = e.target as HTMLElement | null;
                if (target?.closest("[data-today-action='1']")) return;

                pendingRecipeIdRef.current = r.id;
                pendingPointerIdRef.current = e.pointerId;
                pendingStartRef.current = {
                  x: e.clientX,
                  y: e.clientY,
                  t: performance.now(),
                };

                setDraggingRecipeId(null);
                draggingRecipeIdRef.current = null;
                setDropCategory(null);
                dropCategoryRef.current = null;

                const thresholdPx = 10;
                const thresholdMs = 120;
                const squared = (dx: number, dy: number) => dx * dx + dy * dy;
                let lastX = e.clientX;
                let lastY = e.clientY;

                const startTimer = window.setTimeout(() => {
                  if (pendingPointerIdRef.current !== e.pointerId) return;
                  const pending = pendingRecipeIdRef.current;
                  if (!pending) return;
                  if (draggingRecipeIdRef.current) return;

                  setDraggingRecipeId(pending);
                  draggingRecipeIdRef.current = pending;
                  suppressNextClickRef.current = true;

                  const cat = getCategoryFromPoint(lastX, lastY);
                  setDropCategory(cat);
                  dropCategoryRef.current = cat;
                }, thresholdMs);

                const onMove = (ev: PointerEvent) => {
                  if (pendingPointerIdRef.current !== ev.pointerId) return;
                  const pending = pendingRecipeIdRef.current;
                  const start = pendingStartRef.current;
                  if (!pending || !start) return;

                  lastX = ev.clientX;
                  lastY = ev.clientY;

                  const dx = ev.clientX - start.x;
                  const dy = ev.clientY - start.y;
                  const elapsed = performance.now() - start.t;

                  const shouldStart =
                    squared(dx, dy) >= thresholdPx * thresholdPx || elapsed >= thresholdMs;

                  if (!draggingRecipeIdRef.current && shouldStart) {
                    setDraggingRecipeId(pending);
                    draggingRecipeIdRef.current = pending;
                    suppressNextClickRef.current = true;
                  }

                  if (draggingRecipeIdRef.current) {
                    const cat = getCategoryFromPoint(ev.clientX, ev.clientY);
                    setDropCategory(cat);
                    dropCategoryRef.current = cat;
                  }
                };

                const onUp = async (ev: PointerEvent) => {
                  if (pendingPointerIdRef.current !== ev.pointerId) return;
                  clearTimeout(startTimer);
                  window.removeEventListener("pointermove", onMove);
                  window.removeEventListener("pointercancel", onUp);
                  window.removeEventListener("pointerup", onUp);

                  const id = draggingRecipeIdRef.current;
                  const cat = dropCategoryRef.current;

                  pendingRecipeIdRef.current = null;
                  pendingPointerIdRef.current = null;
                  pendingStartRef.current = null;
                  setDraggingRecipeId(null);
                  draggingRecipeIdRef.current = null;
                  setDropCategory(null);
                  dropCategoryRef.current = null;

                  if (!id || !cat) return;
                  if (activeRef.current !== "全部") return;

                  setChangingCategory(true);
                  try {
                    await update(id, { category: cat });
                  } catch (err) {
                    setMsg(err instanceof Error ? err.message : "修改分类失败");
                  } finally {
                    setChangingCategory(false);
                    suppressNextClickRef.current = true;
                  }
                };

                window.addEventListener("pointermove", onMove, { passive: true });
                window.addEventListener("pointerup", onUp, { passive: true });
                window.addEventListener("pointercancel", onUp, { passive: true });
              }}
            >
              <RecipeCard
                recipe={r}
                showTodayAction
                todaySelected={selected}
                onTodayAction={canAdd ? () => void addToToday(r.id) : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}


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

export function CategoriesClientSelect() {
  const { recipes, hydrated, update } = useRecipes();
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState<string>("全部");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const { ids: todayIds, has: isTodaySelected, add: addToToday, max: todayMax } =
    useTodayCookbook();

  const categories = React.useMemo(() => {
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
            <Button
              variant="outline"
              size="sm"
              onClick={onReclassify}
              disabled={!hydrated || busy}
            >
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
            onClick={() => setActive(c)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12px] transition-colors",
              active === c
                ? "border-[color:rgba(107,142,107,0.35)] bg-[color:rgba(107,142,107,0.10)] text-[color:var(--foreground)]"
                : "border-[color:var(--line)] text-[color:var(--muted)] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
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
          return (
            <RecipeCard
              key={r.id}
              recipe={r}
              showTodayAction
              todaySelected={selected}
              onTodayAction={canAdd ? () => void addToToday(r.id) : undefined}
              categoryEditable
              categoryOptions={[...RecipeCategories]}
              onCategoryChange={async (nextCat) => {
                try {
                  await update(r.id, { category: nextCat });
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : "修改分类失败");
                }
              }}
            />
          );
        })}
      </div>
    </div>
  );
}


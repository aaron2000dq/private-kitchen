"use client";

import * as React from "react";
import { useRecipes } from "@/lib/recipes/useRecipes";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { RecipeCard } from "@/components/recipes/RecipeCard";

export function RecipesListClient() {
  const { recipes, hydrated } = useRecipes();
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return recipes;
    return recipes.filter((r) => {
      const hay = [
        r.name,
        r.category,
        r.description,
        ...(r.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [q, recipes]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索：菜名 / 分类 / 标签"
          className="md:max-w-md"
        />
        <div className="text-[12px] text-[color:var(--muted-2)]">
          {hydrated ? `${filtered.length} 道菜` : "读取中…"}
        </div>
      </div>

      {hydrated && filtered.length === 0 ? (
        <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper)] p-8 text-center">
          <div className="mx-auto max-w-md space-y-3">
            <Badge tone="muted">空</Badge>
            <p className="text-[14px] leading-7 text-[color:var(--muted)]">
              还没有菜谱。先从你最拿手的一道开始吧。
            </p>
            <Link
              href="/recipes/new"
              className="inline-flex justify-center rounded-xl border border-[color:var(--line)] bg-black/[0.02] px-4 py-2 text-[13px] hover:bg-black/[0.03] dark:bg-white/[0.04] dark:hover:bg-white/[0.06]"
            >
              新增菜谱
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((r) => (
          <RecipeCard key={r.id} recipe={r} />
        ))}
      </div>
    </div>
  );
}


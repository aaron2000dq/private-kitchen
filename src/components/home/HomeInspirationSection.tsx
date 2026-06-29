"use client";

import * as React from "react";
import { InspirationStack } from "@/components/inspiration/InspirationStack";
import { inspirationDeck } from "@/lib/recommendation/localInspiration";
import { getMondayOfWeek } from "@/lib/recommendation/recommendationDb";
import { useRecipes } from "@/lib/recipes/useRecipes";
import { Badge } from "@/components/ui/Badge";

export function HomeInspirationSection() {
  const { recipes } = useRecipes();
  const weekStart = React.useMemo(() => getMondayOfWeek(new Date()), []);
  const deck = React.useMemo(
    () => inspirationDeck(recipes, weekStart, new Date()),
    [recipes, weekStart],
  );

  return (
    <section className="rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
      <div className="space-y-1">
        <Badge tone="muted">看看灵感</Badge>
        <h2 className="font-[var(--font-noto-serif-sc)] text-[20px] leading-tight">
          菜谱库里的好选择
        </h2>
        <p className="max-w-xl text-[13px] leading-6 text-[color:var(--muted)]">
          本周更值得翻出来的几道菜。
        </p>
      </div>
      <div className="mt-6">
        <InspirationStack recipes={deck} />
      </div>
    </section>
  );
}

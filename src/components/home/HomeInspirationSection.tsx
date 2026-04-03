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
    <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper)] p-6 shadow-[var(--shadow)]">
      <div className="space-y-1">
        <Badge tone="muted">看看灵感</Badge>
        <h2 className="font-[var(--font-noto-serif-sc)] text-[20px] leading-tight tracking-wide">
          从菜谱库里翻翻看
        </h2>
        <p className="max-w-xl text-[13px] leading-7 text-[color:var(--muted)]">
          按时令关键词与评分做的本地排序，再按周做一次轻微洗牌；叠卡上用触控板双指左右轻扫即可翻页。
        </p>
      </div>
      <div className="mt-6">
        <InspirationStack recipes={deck} />
      </div>
    </section>
  );
}

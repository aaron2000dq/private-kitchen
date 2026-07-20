"use client";

import { useSearchParams } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { RecipeDetailClient } from "../[id]/recipeDetailClient";
import { recipeEditHref } from "@/lib/recipes/recipeRoutes";

export function RecipeDetailWithQuery() {
  const sp = useSearchParams();
  const id = sp.get("id")?.trim() ?? "";

  if (!id) {
    return (
      <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)] p-8">
        <p className="text-[13px] leading-7 text-[color:var(--muted)]">
          链接里缺少菜谱 id。请从列表或首页卡片进入。
        </p>
        <div className="mt-4">
          <ButtonLink href="/recipes/all" variant="outline">回到菜谱库</ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <ButtonLink href="/recipes/all" variant="ghost">← 返回</ButtonLink>
        <ButtonLink href={recipeEditHref(id)} variant="outline">编辑</ButtonLink>
      </div>
      <div className="mt-6">
        <RecipeDetailClient id={id} />
      </div>
    </>
  );
}

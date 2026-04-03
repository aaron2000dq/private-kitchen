"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { RecipeDetailClient } from "../[id]/recipeDetailClient";
import { recipeEditHref } from "@/lib/recipes/recipeRoutes";

export function RecipeDetailWithQuery() {
  const sp = useSearchParams();
  const id = sp.get("id")?.trim() ?? "";

  if (!id) {
    return (
      <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper)] p-8">
        <p className="text-[13px] leading-7 text-[color:var(--muted)]">
          链接里缺少菜谱 id。请从列表或首页卡片进入。
        </p>
        <div className="mt-4">
          <Link href="/recipes/all">
            <Button variant="outline">回到菜谱库</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <Link href="/recipes/all">
          <Button variant="ghost">← 返回</Button>
        </Link>
        <Link href={recipeEditHref(id)}>
          <Button variant="outline">编辑</Button>
        </Link>
      </div>
      <div className="mt-6">
        <RecipeDetailClient id={id} />
      </div>
    </>
  );
}

"use client";

import { useSearchParams } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { EditRecipeClient } from "../[id]/edit/editRecipeClient";
import { recipeDetailHref } from "@/lib/recipes/recipeRoutes";

export function EditRecipeWithQuery() {
  const sp = useSearchParams();
  const id = sp.get("id")?.trim() ?? "";

  if (!id) {
    return (
      <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper)] p-8">
        <p className="text-[13px] leading-7 text-[color:var(--muted)]">
          链接里缺少菜谱 id。请从详情页进入编辑。
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
        <ButtonLink href={recipeDetailHref(id)} variant="ghost">← 返回</ButtonLink>
      </div>
      <div className="mt-6">
        <EditRecipeClient id={id} />
      </div>
    </>
  );
}

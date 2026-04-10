"use client";

import Link from "next/link";
import * as React from "react";
import { RecipeRepository } from "@/lib/recipes/repository";
import { Recipe } from "@/lib/recipes/types";
import { recipeImageUrl } from "@/lib/recipes/recipeImageUrl";
import { Badge } from "@/components/ui/Badge";
import { StarRating } from "@/components/ui/StarRating";
import { Button } from "@/components/ui/Button";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function RecipeDetailClient({ id }: { id: string }) {
  const [recipe, setRecipe] = React.useState<Recipe | null>(null);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setHydrated(true);
    void RecipeRepository.get(id).then(setRecipe);
  }, [id]);

  const onChangeRating = (v: number) => {
    void RecipeRepository.update(id, { rating: v }).then(setRecipe);
  };

  if (!hydrated) {
    return (
      <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper)] p-8">
        <p className="text-[13px] text-[color:var(--muted-2)]">读取中…</p>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper)] p-8">
        <Badge tone="muted">未找到</Badge>
        <p className="mt-3 text-[13px] leading-7 text-[color:var(--muted)]">
          这道菜谱可能已被删除，或当前浏览器没有这份数据。
        </p>
        <div className="mt-4">
          <Link href="/recipes/all">
            <Button variant="outline">回到列表</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper)] p-6 shadow-[var(--shadow)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{recipe.category}</Badge>
              {recipe.tags?.map((t) => (
                <Badge key={t} tone="muted">
                  {t}
                </Badge>
              ))}
              <Badge tone="muted">
                难度：
                {recipe.difficulty === "easy"
                  ? "简单"
                  : recipe.difficulty === "hard"
                    ? "费心"
                    : "适中"}
              </Badge>
            </div>
            <h1 className="mt-4 truncate font-[var(--font-noto-serif-sc)] text-[30px] leading-tight tracking-wide">
              {recipe.name}
            </h1>
            {recipe.description ? (
              <p className="mt-3 max-w-2xl text-[14px] leading-7 text-[color:var(--muted)]">
                {recipe.description}
              </p>
            ) : null}
          </div>

          <div className="shrink-0">
            <StarRating value={recipe.rating ?? 0} onChange={onChangeRating} label="评分" />
          </div>
        </div>

        {recipe.images?.length ? (
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
            {recipe.images.slice(0, 6).map((src, idx) => (
              <div
                key={idx}
                className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-black/[0.03] dark:bg-white/[0.05]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={recipeImageUrl(src)}
                  alt={`图片 ${idx + 1}`}
                  loading={idx === 0 ? "eager" : "lazy"}
                  decoding="async"
                  className="h-36 w-full object-cover"
                />
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[12px] text-[color:var(--muted-2)]">
          <span>更新于 {formatDate(recipe.updatedAt)}</span>
          <span className="opacity-70">创建于 {formatDate(recipe.createdAt)}</span>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper)] p-6">
          <Badge tone="muted">用料</Badge>
          {recipe.mainIngredients?.length || recipe.auxiliaryIngredients?.length ? (
            <div className="mt-4 space-y-6">
              <div>
                <div className="text-[12px] font-medium text-[color:var(--muted)]">主要食材</div>
                {recipe.mainIngredients?.length ? (
                  <ul className="mt-2 space-y-2">
                    {recipe.mainIngredients.map((i, idx) => (
                      <li
                        key={`m-${idx}`}
                        className="flex items-baseline justify-between gap-4 rounded-2xl border border-[color:var(--line)] bg-black/[0.01] px-4 py-3 text-[13px] dark:bg-white/[0.03]"
                      >
                        <div className="min-w-0">
                          <div className="truncate">{i.name || "—"}</div>
                          {i.note ? (
                            <div className="mt-1 text-[12px] text-[color:var(--muted-2)]">
                              {i.note}
                            </div>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-[color:var(--muted)]">{i.amount}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[13px] text-[color:var(--muted-2)]">未列出主料。</p>
                )}
              </div>
              <div>
                <div className="text-[12px] font-medium text-[color:var(--muted)]">辅料</div>
                <p className="mt-1 text-[11px] text-[color:var(--muted-2)]">
                  油盐酱醋、糖、淀粉、香料、葱姜蒜等调味与作料。
                </p>
                {recipe.auxiliaryIngredients?.length ? (
                  <ul className="mt-2 space-y-2">
                    {recipe.auxiliaryIngredients.map((i, idx) => (
                      <li
                        key={`a-${idx}`}
                        className="flex items-baseline justify-between gap-4 rounded-2xl border border-[color:var(--line)] bg-black/[0.01] px-4 py-3 text-[13px] dark:bg-white/[0.03]"
                      >
                        <div className="min-w-0">
                          <div className="truncate">{i.name || "—"}</div>
                          {i.note ? (
                            <div className="mt-1 text-[12px] text-[color:var(--muted-2)]">
                              {i.note}
                            </div>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-[color:var(--muted)]">{i.amount}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[13px] text-[color:var(--muted-2)]">未列出辅料。</p>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-[13px] text-[color:var(--muted-2)]">未填写用料。</p>
          )}
        </section>

        <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper)] p-6">
          <Badge tone="muted">步骤</Badge>
          {recipe.steps?.length ? (
            <ol className="mt-4 space-y-3">
              {recipe.steps
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((s) => (
                  <li
                    key={s.order}
                    className="rounded-2xl border border-[color:var(--line)] bg-black/[0.01] p-4 text-[13px] leading-7 dark:bg-white/[0.03]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--line)] text-[12px] text-[color:var(--muted)]">
                        {s.order}
                      </div>
                      <div className="min-w-0">
                        <div className="whitespace-pre-wrap">{s.content}</div>
                        {s.tip ? (
                          <div className="mt-2 text-[12px] text-[color:var(--muted-2)]">
                            提示：{s.tip}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
            </ol>
          ) : (
            <p className="mt-4 text-[13px] text-[color:var(--muted-2)]">未填写步骤。</p>
          )}
        </section>
      </div>
    </div>
  );
}


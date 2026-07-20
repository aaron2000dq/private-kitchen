"use client";

import * as React from "react";
import { RecipeRepository } from "@/lib/recipes/repository";
import type { Recipe, RecipeIngredient, RecipeStep } from "@/lib/recipes/types";
import { recipeImageThumbUrl, recipeImageUrl } from "@/lib/recipes/recipeImageUrl";
import { Badge } from "@/components/ui/Badge";
import { StarRating } from "@/components/ui/StarRating";
import { ButtonLink } from "@/components/ui/Button";
import { VisuallyLosslessThumb } from "@/components/recipes/VisuallyLosslessThumb";
import { RecipeCookingMode } from "@/components/recipes/RecipeCookingMode";

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

function difficultyLabel(recipe: Recipe): string {
  if (recipe.difficulty === "easy") return "简单";
  if (recipe.difficulty === "hard") return "费心";
  return "适中";
}

function ingredientAmount(item: RecipeIngredient): string {
  return item.amount?.trim() || "适量";
}

function sortedSteps(recipe: Recipe): RecipeStep[] {
  return [...(recipe.steps ?? [])].sort((a, b) => a.order - b.order);
}

function RecipePhotoBook({ recipe }: { recipe: Recipe }) {
  const images = recipe.images?.slice(0, 5) ?? [];
  const primary = images[0];

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--wash)] shadow-[0_1px_0_rgba(24,33,29,0.04)]">
        <div className="aspect-[4/3]">
          {primary ? (
            <VisuallyLosslessThumb
              src={recipeImageThumbUrl(primary)}
              fallbackSrc={recipeImageUrl(primary)}
              alt={recipe.name}
              loading="eager"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[13px] text-[color:var(--muted-2)]">
              暂无成品图
            </div>
          )}
        </div>
      </div>

      {images.length > 1 ? (
        <div className="grid grid-cols-4 gap-2">
          {images.slice(1).map((src, idx) => (
            <div
              key={`${src}-${idx}`}
              className="aspect-square overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--wash)]"
            >
              <VisuallyLosslessThumb
                src={recipeImageThumbUrl(src)}
                fallbackSrc={recipeImageUrl(src)}
                alt={`${recipe.name} 图片 ${idx + 2}`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-[color:var(--line)] px-3 py-3 last:border-r-0">
      <div className="text-[11px] leading-none text-[color:var(--muted-2)]">{label}</div>
      <div className="pk-serif mt-2 truncate text-[18px] leading-none text-[color:var(--foreground)]">
        {value}
      </div>
    </div>
  );
}

function IngredientGroup({
  title,
  marker,
  items,
}: {
  title: string;
  marker: string;
  items: RecipeIngredient[];
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="pk-serif text-[19px] leading-tight">{title}</div>
        <div className="text-[12px] text-[color:var(--muted-2)]">{items.length} 项</div>
      </div>
      {items.length ? (
        <ul className="divide-y divide-[color:var(--line)] border-t border-[color:var(--line)]">
          {items.map((item, idx) => (
            <li
              key={`${marker}-${item.name}-${idx}`}
              className="grid grid-cols-[2.25rem_1fr_auto] items-start gap-3 px-4 py-3 text-[13px] sm:px-5"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--menu-line)] text-[11px] text-[color:var(--muted)]">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[color:var(--foreground)]">
                  {item.name || "未命名食材"}
                </span>
                {item.note ? (
                  <span className="mt-1 block text-[12px] leading-5 text-[color:var(--muted-2)]">
                    {item.note}
                  </span>
                ) : null}
              </span>
              <span className="max-w-[8rem] shrink-0 truncate text-right text-[color:var(--muted)]">
                {ingredientAmount(item)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-[color:var(--line)] px-4 py-4 text-[13px] text-[color:var(--muted-2)] sm:px-5">
          暂未列出。
        </p>
      )}
    </div>
  );
}

function StepsScoreboard({ steps }: { steps: RecipeStep[] }) {
  return (
    <section className="pk-panel-plain overflow-hidden">
      <div className="border-b border-[color:var(--line)] px-4 py-4 sm:px-5">
        <div className="pk-section-label">烹饪谱</div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <h2 className="pk-serif text-[27px] leading-tight">步骤</h2>
          <span className="text-[12px] text-[color:var(--muted-2)]">{steps.length} 步</span>
        </div>
      </div>

      {steps.length ? (
        <ol className="divide-y divide-[color:var(--line)]">
          {steps.map((step, idx) => (
            <li key={step.order} className="grid grid-cols-[3rem_1fr] gap-3 px-4 py-4 sm:px-5">
              <div className="pt-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--menu-line)] bg-[color:var(--paper-strong)] text-[12px] text-[color:var(--muted)]">
                  {String(idx + 1).padStart(2, "0")}
                </div>
              </div>
              <div className="min-w-0">
                <div className="whitespace-pre-wrap break-words text-[15px] leading-8 text-[color:var(--foreground)]">
                  {step.content}
                </div>
                {step.tip ? (
                  <div className="mt-3 rounded-lg border border-[color:rgba(184,92,56,0.22)] bg-[color:rgba(184,92,56,0.07)] px-3 py-2 text-[12px] leading-6 text-[color:var(--warm)]">
                    提示：{step.tip}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-4 py-5 text-[13px] text-[color:var(--muted-2)] sm:px-5">
          未填写步骤。
        </p>
      )}
    </section>
  );
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
      <div className="pk-panel-plain p-8">
        <p className="text-[13px] text-[color:var(--muted-2)]">读取中…</p>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="pk-panel-plain p-8">
        <Badge tone="muted">未找到</Badge>
        <p className="mt-3 text-[13px] leading-7 text-[color:var(--muted)]">
          这道菜谱可能已被删除，或当前浏览器没有这份数据。
        </p>
        <div className="mt-4">
          <ButtonLink href="/recipes/all" variant="outline">
            回到列表
          </ButtonLink>
        </div>
      </div>
    );
  }

  const steps = sortedSteps(recipe);
  const mainIngredients = recipe.mainIngredients ?? [];
  const auxiliaryIngredients = recipe.auxiliaryIngredients ?? [];
  const totalIngredients = mainIngredients.length + auxiliaryIngredients.length;

  return (
    <div className="space-y-6">
      <section className="pk-panel p-4 sm:p-5">
        <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <RecipePhotoBook recipe={recipe} />

          <div className="min-w-0 py-1 lg:py-2">
            <div className="pk-section-label">私房食谱</div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone="accent">{recipe.category}</Badge>
              {recipe.tags?.slice(0, 7).map((tag) => (
                <Badge key={tag} tone="muted">
                  {tag}
                </Badge>
              ))}
            </div>

            <h1 className="pk-serif mt-5 text-[36px] leading-[1.12] tracking-normal sm:text-[46px]">
              {recipe.name}
            </h1>

            {recipe.description ? (
              <p className="mt-4 max-w-2xl text-[15px] leading-8 text-[color:var(--muted)]">
                {recipe.description}
              </p>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
              <RecipeCookingMode recipe={recipe} />
              <div className="text-[12px] leading-6 text-[color:var(--muted-2)]">
                大字步骤、滑动切换、计时器和进度都会保存在本机。
              </div>
            </div>

            <div className="mt-5 grid grid-cols-4 overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--paper-strong)]/66">
              <DetailStat label="用料" value={`${totalIngredients}项`} />
              <DetailStat label="步骤" value={`${steps.length}步`} />
              <DetailStat label="难度" value={difficultyLabel(recipe)} />
              <DetailStat label="评分" value={recipe.rating ? `${recipe.rating}/5` : "未评"} />
            </div>

            <div className="mt-5 border-t border-dashed border-[color:rgba(24,33,29,0.16)] pt-4">
              <StarRating value={recipe.rating ?? 0} onChange={onChangeRating} label="评分" />
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)] pt-4 text-[12px] text-[color:var(--muted-2)]">
          <span>更新于 {formatDate(recipe.updatedAt)}</span>
          <span className="opacity-70">创建于 {formatDate(recipe.createdAt)}</span>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="pk-panel-plain overflow-hidden">
          <div className="border-b border-[color:var(--line)] px-4 py-4 sm:px-5">
            <div className="pk-section-label">备料台</div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <h2 className="pk-serif text-[27px] leading-tight">用料</h2>
              <span className="text-[12px] text-[color:var(--muted-2)]">
                主料 {mainIngredients.length} · 辅料 {auxiliaryIngredients.length}
              </span>
            </div>
          </div>

          <div className="divide-y divide-[color:var(--line)]">
            <IngredientGroup title="主要食材" marker="m" items={mainIngredients} />
            <IngredientGroup title="调味辅料" marker="a" items={auxiliaryIngredients} />
          </div>
        </section>

        <StepsScoreboard steps={steps} />
      </div>
    </div>
  );
}

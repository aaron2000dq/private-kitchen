"use client";

import * as React from "react";
import { AppLink as Link } from "@/components/ui/AppLink";
import { RecipeRepository } from "@/lib/recipes/repository";
import type { Recipe, RecipeIngredient, RecipeStep } from "@/lib/recipes/types";
import { MEAL_ROLE_META, mealRoleOf, type MealRole } from "@/lib/recipes/mealRole";
import { recipeDetailHref } from "@/lib/recipes/recipeRoutes";
import { useRecipes } from "@/lib/recipes/useRecipes";
import { useTodayCookbook } from "@/lib/today/useTodayCookbook";
import { recipeImageThumbUrl, recipeImageUrl } from "@/lib/recipes/recipeImageUrl";
import { Badge } from "@/components/ui/Badge";
import { StarRating } from "@/components/ui/StarRating";
import { Button, ButtonLink } from "@/components/ui/Button";
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

const PAIRING_TARGETS: Record<MealRole, MealRole[]> = {
  main: ["vegetable", "soup", "staple", "small"],
  vegetable: ["main", "soup", "staple"],
  soup: ["main", "vegetable", "staple"],
  staple: ["main", "vegetable", "soup"],
  small: ["main", "vegetable", "soup"],
  home: ["main", "vegetable", "soup"],
};

function sharedTagCount(a: Recipe, b: Recipe): number {
  const tags = new Set(a.tags ?? []);
  return (b.tags ?? []).filter((tag) => tags.has(tag)).length;
}

function pairingScore(recipe: Recipe, candidate: Recipe): number {
  const recipeRole = mealRoleOf(recipe);
  const candidateRole = mealRoleOf(candidate);
  const desired = PAIRING_TARGETS[recipeRole];
  const desiredIndex = desired.indexOf(candidateRole);
  const roleScore = desiredIndex >= 0 ? 80 - desiredIndex * 10 : candidateRole === recipeRole ? 4 : 18;
  const diversityScore = candidate.category === recipe.category ? 1 : 5;
  const imageScore = candidate.images?.length ? 4 : 0;
  const ratingScore = (candidate.rating ?? 0) * 2.5;

  return roleScore + diversityScore + imageScore + ratingScore + sharedTagCount(recipe, candidate) * 1.5;
}

function pairingReason(recipe: Recipe, candidate: Recipe): string {
  const candidateRole = mealRoleOf(candidate);
  const recipeRole = mealRoleOf(recipe);

  if (candidateRole === "vegetable") return recipeRole === "main" ? "给主菜留一口清爽" : "让这餐更轻盈";
  if (candidateRole === "soup") return "收住烟火气，吃起来更完整";
  if (candidateRole === "staple") return "把这餐压稳，适合一起上桌";
  if (candidateRole === "main") return recipeRole === "vegetable" ? "补一道撑场面的主菜" : "让席面更有主心骨";
  if (candidateRole === "small") return "添一点开胃的小兴致";
  return "和这道菜放在一桌很顺口";
}

function buildPairings(recipe: Recipe, recipes: Recipe[]): Recipe[] {
  const candidates = recipes.filter((candidate) => candidate.id !== recipe.id);
  const scored = candidates
    .map((candidate) => ({ candidate, score: pairingScore(recipe, candidate) }))
    .sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name, "zh-CN"));

  const picked: Recipe[] = [];
  const pickedIds = new Set<string>();
  for (const role of PAIRING_TARGETS[mealRoleOf(recipe)]) {
    const best = scored.find((entry) => !pickedIds.has(entry.candidate.id) && mealRoleOf(entry.candidate) === role);
    if (!best) continue;
    picked.push(best.candidate);
    pickedIds.add(best.candidate.id);
  }

  for (const entry of scored) {
    if (picked.length >= 4) break;
    if (pickedIds.has(entry.candidate.id)) continue;
    picked.push(entry.candidate);
    pickedIds.add(entry.candidate.id);
  }

  return picked.slice(0, 4);
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

function PairingShelf({ recipe }: { recipe: Recipe }) {
  const { recipes, hydrated } = useRecipes();
  const { hydrated: todayHydrated, ids, has, add, max } = useTodayCookbook();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const pairings = React.useMemo(
    () => (hydrated ? buildPairings(recipe, recipes) : []),
    [hydrated, recipe, recipes],
  );
  const currentRole = MEAL_ROLE_META[mealRoleOf(recipe)].label;

  const onAdd = async (recipeId: string) => {
    setPendingId(recipeId);
    try {
      await add(recipeId);
    } finally {
      setPendingId(null);
    }
  };

  if (!hydrated || pairings.length === 0) return null;

  return (
    <section className="pk-panel-plain overflow-hidden">
      <div className="border-b border-[color:var(--line)] px-4 py-4 sm:px-5">
        <div className="pk-section-label">菜单管家</div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <h2 className="pk-serif text-[27px] leading-tight">顺手搭配</h2>
            <p className="mt-2 text-[12px] leading-5 text-[color:var(--muted)]">
              当前是{currentRole}，优先补齐一桌菜需要的口味和结构。
            </p>
          </div>
          <span className="shrink-0 text-[12px] text-[color:var(--muted-2)]">{pairings.length} 道</span>
        </div>
      </div>

      <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
        {pairings.map((candidate, index) => {
          const selected = has(candidate.id);
          const full = ids.length >= max && !selected;
          const role = MEAL_ROLE_META[mealRoleOf(candidate)].label;
          const image = candidate.images?.[0];
          return (
            <article
              key={candidate.id}
              className="flex min-w-0 flex-col rounded-lg border border-[color:var(--line)] bg-[color:var(--paper-strong)]/72 p-2.5 shadow-[0_1px_0_rgba(24,33,29,0.04)]"
            >
              <Link
                href={recipeDetailHref(candidate.id)}
                className="grid min-w-0 grid-cols-[76px_minmax(0,1fr)] gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
              >
                <div className="h-[76px] w-[76px] overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--wash)]">
                  {image ? (
                    <VisuallyLosslessThumb
                      src={recipeImageThumbUrl(image)}
                      fallbackSrc={recipeImageUrl(image)}
                      alt={candidate.name}
                      loading={index === 0 ? "eager" : "lazy"}
                      fetchPriority={index === 0 ? "high" : "auto"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[11px] text-[color:var(--muted-2)]">
                      无图
                    </div>
                  )}
                </div>
                <div className="min-w-0 py-0.5">
                  <Badge tone={mealRoleOf(candidate) === "vegetable" ? "accent" : "muted"}>{role}</Badge>
                  <div className="pk-serif mt-2 line-clamp-2 text-[17px] leading-tight">{candidate.name}</div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[color:var(--muted)]">
                    {pairingReason(recipe, candidate)}
                  </p>
                </div>
              </Link>

              <Button
                size="sm"
                variant={selected ? "outline" : "primary"}
                className="mt-3 w-full"
                disabled={!todayHydrated || selected || full || pendingId === candidate.id}
                onClick={() => void onAdd(candidate.id)}
              >
                {selected ? "已在菜单" : full ? "今日已满" : pendingId === candidate.id ? "加入中" : "加入今日"}
              </Button>
            </article>
          );
        })}
      </div>
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

      <PairingShelf recipe={recipe} />

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

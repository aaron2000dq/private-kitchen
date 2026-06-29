"use client";

import Link from "next/link";
import * as React from "react";
import { useRouter } from "next/navigation";
import type { Recipe } from "@/lib/recipes/types";
import { recipeImageThumbUrl, recipeImageUrl } from "@/lib/recipes/recipeImageUrl";
import { formatRecipeIngredientsPreview } from "@/lib/recipes/formatIngredientsPreview";
import { recipeDetailHref } from "@/lib/recipes/recipeRoutes";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { VisuallyLosslessThumb } from "@/components/recipes/VisuallyLosslessThumb";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function RecipeCard({
  recipe,
  showTodayAction = false,
  todaySelected = false,
  onTodayAction,
  draggable = false,
  onDragStart,
  onDragEnd,
  categoryEditable = false,
  categoryOptions = [],
  onCategoryChange,
}: {
  recipe: Recipe;
  showTodayAction?: boolean;
  todaySelected?: boolean;
  onTodayAction?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLElement>) => void;
  categoryEditable?: boolean;
  categoryOptions?: string[];
  onCategoryChange?: (next: string) => void | Promise<void>;
}) {
  const router = useRouter();
  const [catMenuOpen, setCatMenuOpen] = React.useState(false);
  const catMenuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (!catMenuOpen) return;
      const el = catMenuRef.current;
      if (!el) return;
      const t = e.target as Node | null;
      if (!t) return;
      if (el.contains(t)) return;
      setCatMenuOpen(false);
    }

    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [catMenuOpen]);

  const href = recipeDetailHref(recipe.id);
  const image = recipe.images?.[0];
  const ingredientsPreview = formatRecipeIngredientsPreview(recipe);
  const Wrapper: React.ElementType = categoryEditable ? "div" : Link;
  const wrapperProps = categoryEditable
    ? {
        role: "link",
        tabIndex: 0,
        onClick: (e: React.MouseEvent) => {
          const t = e.target as HTMLElement | null;
          if (t?.closest("[data-cat-toggle='1'], [data-cat-menu='1']")) return;
          if (t?.closest("[data-today-action='1']")) return;
          router.push(href);
        },
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          const t = e.target as HTMLElement | null;
          if (t?.closest("[data-cat-toggle='1'], [data-cat-menu='1']")) return;
          if (t?.closest("[data-today-action='1']")) return;
          e.preventDefault();
          router.push(href);
        },
      }
    : { href };

  return (
    <Wrapper
      {...wrapperProps}
      className="group block overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[color:rgba(184,92,56,0.34)] hover:shadow-[var(--shadow-soft)]"
      draggable={draggable}
      onDragStart={(e: React.DragEvent<HTMLElement>) => {
        onDragStart?.(e);
      }}
      onDragEnd={onDragEnd}
    >
      <div className="relative aspect-[4/3] overflow-hidden border-b border-[color:var(--line)] bg-[color:var(--wash)]">
        {image ? (
          <VisuallyLosslessThumb
            src={recipeImageThumbUrl(image)}
            fallbackSrc={recipeImageUrl(image)}
            alt={recipe.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] text-[color:var(--muted-2)]">
            无图
          </div>
        )}
        {recipe.rating ? (
          <div className="absolute right-2 top-2 rounded-md bg-[color:var(--paper)]/92 px-2 py-1 text-[11px] font-medium text-[color:var(--warm)] shadow-[var(--shadow-soft)]">
            {recipe.rating}/5
          </div>
        ) : null}
      </div>

      <div className="p-3 sm:p-4">
        <div className="min-h-[2.45rem] font-[var(--font-noto-serif-sc)] text-[16px] leading-tight text-[color:var(--foreground)] sm:text-[17px]">
          <span className="line-clamp-2">{recipe.name}</span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <div className="relative" ref={catMenuRef}>
            <Badge
              tone="accent"
              className={categoryEditable ? "cursor-pointer" : undefined}
              onClick={(e) => {
                if (!categoryEditable || !categoryOptions.length || !onCategoryChange) return;
                e.preventDefault();
                e.stopPropagation();
                setCatMenuOpen((v) => !v);
              }}
            >
              {recipe.category}
            </Badge>
            {categoryEditable && categoryOptions.length && onCategoryChange ? (
              <button
                type="button"
                className="absolute inset-0"
                aria-label="修改分类"
                data-cat-toggle="1"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCatMenuOpen((v) => !v);
                }}
              />
            ) : null}
            {catMenuOpen ? (
              <div
                data-cat-menu="1"
                className="absolute left-0 top-[calc(100%+6px)] z-30 w-max min-w-[160px] rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)] p-2 shadow-[var(--shadow)]"
              >
                <div className="max-h-60 overflow-auto">
                  {categoryOptions.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="w-full rounded-md px-3 py-2 text-left text-[13px] text-[color:var(--foreground)] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-50"
                      disabled={c === recipe.category}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void Promise.resolve(onCategoryChange?.(c)).finally(() => setCatMenuOpen(false));
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          {recipe.tags?.slice(0, 2).map((t) => (
            <Badge key={t} tone="muted">
              {t}
            </Badge>
          ))}
        </div>

        {recipe.description ? (
          <p className="mt-3 line-clamp-2 text-[12px] leading-5 text-[color:var(--muted)] sm:text-[13px]">
            {recipe.description}
          </p>
        ) : (
          <p className="mt-3 text-[12px] leading-5 text-[color:var(--muted-2)]">没有简介</p>
        )}
        {ingredientsPreview ? (
          <p className="mt-2 line-clamp-1 text-[11px] leading-4 text-[color:var(--muted-2)]">
            {ingredientsPreview}
          </p>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-[color:var(--muted-2)]">
          <span>{formatDate(recipe.updatedAt)}</span>
          <button
            type="button"
            className="shrink-0 rounded-md px-1.5 py-1 text-[color:var(--foreground)] opacity-70 transition-[background-color,opacity] group-hover:bg-black/[0.04] group-hover:opacity-100 dark:group-hover:bg-white/[0.06]"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              router.push(href);
            }}
          >
            打开
          </button>
        </div>

        {showTodayAction ? (
          <div className="mt-3">
            <Button
              size="sm"
              variant={todaySelected ? "outline" : "primary"}
              disabled={todaySelected || !onTodayAction}
              data-today-action="1"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onTodayAction?.();
              }}
              className="w-full"
            >
              {todaySelected ? "已加入" : "加入今日"}
            </Button>
          </div>
        ) : null}
      </div>
    </Wrapper>
  );
}

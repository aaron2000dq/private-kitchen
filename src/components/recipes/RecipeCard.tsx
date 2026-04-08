"use client";

import Link from "next/link";
import * as React from "react";
import { useRouter } from "next/navigation";
import type { Recipe } from "@/lib/recipes/types";
import { recipeImageUrl } from "@/lib/recipes/recipeImageUrl";
import { recipeDetailHref } from "@/lib/recipes/recipeRoutes";
import { Badge } from "@/components/ui/Badge";
import { StarRating } from "@/components/ui/StarRating";
import { Button } from "@/components/ui/Button";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("zh-CN", {
      year: "numeric",
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
  onDragStart?: (e: React.DragEvent<HTMLAnchorElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLAnchorElement>) => void;
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
  const Wrapper: any = categoryEditable ? "div" : Link;
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
      className="group rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper)] p-5 transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow)]"
      draggable={draggable}
      onDragStart={(e: any) => {
        onDragStart?.(e);
      }}
      onDragEnd={onDragEnd as any}
    >
      {recipe.images?.[0] ? (
        <div className="-mt-1 mb-4 overflow-hidden rounded-2xl border border-[color:var(--line)] bg-black/[0.03] dark:bg-white/[0.05]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={recipeImageUrl(recipe.images[0])}
            alt={recipe.name}
            loading="lazy"
            decoding="async"
            className="h-40 w-full object-cover"
          />
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate font-[var(--font-noto-serif-sc)] text-[18px] tracking-wide">
            {recipe.name}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
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
                  className="absolute left-0 top-[calc(100%+6px)] z-30 w-max min-w-[160px] rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-2 shadow-[var(--shadow)]"
                >
                  <div className="max-h-60 overflow-auto">
                    {categoryOptions.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="w-full rounded-xl px-3 py-2 text-left text-[13px] text-[color:var(--foreground)] transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.06] disabled:opacity-50"
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
        </div>
        <div className="shrink-0">
          <StarRating value={recipe.rating ?? 0} />
        </div>
      </div>

      {recipe.description ? (
        <p className="mt-4 line-clamp-2 text-[13px] leading-6 text-[color:var(--muted)]">
          {recipe.description}
        </p>
      ) : (
        <p className="mt-4 text-[13px] leading-6 text-[color:var(--muted-2)]">
          没有简介
        </p>
      )}

      <div className="mt-4 flex items-center justify-between text-[12px] text-[color:var(--muted-2)]">
        <span>{formatDate(recipe.updatedAt)}</span>
        <button
          type="button"
          className="opacity-70 transition-opacity group-hover:opacity-100"
          onClick={(e) => {
            // Ensure "打开" always navigates, even if wrapper click is blocked by drag/select.
            e.preventDefault();
            e.stopPropagation();
            router.push(href);
          }}
        >
          打开 →
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
            {todaySelected ? "已在今日菜谱" : "今天吃这个"}
          </Button>
        </div>
      ) : null}
    </Wrapper>
  );
}


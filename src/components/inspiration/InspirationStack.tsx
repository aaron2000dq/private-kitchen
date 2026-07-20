"use client";

import * as React from "react";
import type { Recipe } from "@/lib/recipes/types";
import { recipeImageThumbUrl, recipeImageUrl } from "@/lib/recipes/recipeImageUrl";
import { VisuallyLosslessThumb } from "@/components/recipes/VisuallyLosslessThumb";
import { formatRecipeIngredientsPreview } from "@/lib/recipes/formatIngredientsPreview";
import { recipeDetailHref } from "@/lib/recipes/recipeRoutes";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useTodayCookbook } from "@/lib/today/useTodayCookbook";

const STACK_DEPTH = 4;
const SWIPE_THRESHOLD = 92;
const WHEEL_ACCUM_THRESHOLD = 48;
const EXIT_X = 440;

function CardFace({
  r,
  showTodayAction,
  todaySelected,
  todayCanAdd,
  onTodayAction,
}: {
  r: Recipe;
  showTodayAction?: boolean;
  todaySelected?: boolean;
  todayCanAdd?: boolean;
  onTodayAction?: () => void;
}) {
  const tags = (r.tags ?? []).slice(0, 4);
  const ingPreview = formatRecipeIngredientsPreview(r, 2, 2);
  return (
    <div className="flex h-full flex-col">
      <div className="relative h-48 w-full shrink-0 border-b border-[color:var(--line)] bg-[color:var(--wash)] sm:h-52">
        {r.images?.[0] ? (
          <VisuallyLosslessThumb
            src={recipeImageThumbUrl(r.images[0])}
            fallbackSrc={recipeImageUrl(r.images[0])}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] text-[color:var(--muted-2)]">
            无图
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />
        <div className="absolute bottom-3 left-3 rounded-md border border-white/35 bg-black/28 px-2 py-1 text-[11px] text-white backdrop-blur">
          {r.category}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-hidden px-4 py-4">
        <div className="pk-serif line-clamp-2 text-[20px] leading-snug">
          {r.name}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[color:var(--muted-2)]">
          <span>评分：{r.rating > 0 ? `${r.rating}/5` : "未评分"}</span>
          <span>本地灵感</span>
        </div>
        {tags.length > 0 ? (
          <div className="flex max-h-[3.15rem] flex-wrap gap-1.5 overflow-hidden">
            {tags.map((t, i) => (
              <span
                key={`${t}-${i}`}
                className="rounded-md border border-[color:var(--line)] bg-[color:var(--paper-strong)]/80 px-2 py-1 text-[11px] leading-tight text-[color:var(--muted)]"
              >
                {t}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-[color:var(--muted-2)]">标签：无</div>
        )}
        {ingPreview ? (
          <div className="line-clamp-2 text-[12px] leading-5 text-[color:var(--muted-2)]">
            用料：{ingPreview}
          </div>
        ) : null}
      </div>

      {showTodayAction ? (
        <div className="shrink-0 border-t border-dashed border-[color:rgba(24,33,29,0.18)] p-3">
          <Button
            size="sm"
            variant={todaySelected ? "outline" : "primary"}
            disabled={!!todaySelected || !todayCanAdd}
            className="h-9 w-full"
            onPointerDown={(e) => {
              // prevent starting the swipe gesture
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTodayAction?.();
            }}
          >
            {todaySelected ? "已加入今日菜谱" : "今天吃这个"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
    >
      <rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" opacity="0.9" />
      <rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor" opacity="0.9" />
      <rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor" opacity="0.9" />
      <rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

export function InspirationStack({ recipes }: { recipes: Recipe[] }) {
  const n = recipes.length;
  const router = useRouter();
  const {
    ids: todayIds,
    has: isTodaySelected,
    add: addToToday,
    max: todayMax,
  } = useTodayCookbook();

  const [index, setIndex] = React.useState(0);
  const [drag, setDrag] = React.useState({ x: 0, y: 0 });
  const [dragging, setDragging] = React.useState(false);
  const [leaving, setLeaving] = React.useState<"left" | "right" | null>(null);
  const dragRef = React.useRef<{ startX: number; startY: number } | null>(null);
  const movedRef = React.useRef(false);
  const wheelRootRef = React.useRef<HTMLDivElement>(null);
  const wheelAccum = React.useRef(0);
  const wheelClearRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const goNext = React.useCallback(() => {
    if (n <= 1) return;
    setIndex((i) => (i + 1) % n);
    setDrag({ x: 0, y: 0 });
  }, [n]);

  const goPrev = React.useCallback(() => {
    if (n <= 1) return;
    setIndex((i) => (i - 1 + n) % n);
    setDrag({ x: 0, y: 0 });
  }, [n]);

  const settleSwipe = React.useCallback(
    (direction: "left" | "right", recipe?: Recipe, canAdd?: boolean, selected?: boolean) => {
      if (n <= 0 || leaving) return;
      setLeaving(direction);
      setDragging(false);
      setDrag((d) => ({
        x: direction === "right" ? EXIT_X : -EXIT_X,
        y: d.y || -18,
      }));

      window.setTimeout(() => {
        if (direction === "right" && recipe && canAdd && !selected) {
          void addToToday(recipe.id);
        }
        setIndex((i) => (i + 1) % n);
        setLeaving(null);
        setDrag({ x: 0, y: 0 });
        movedRef.current = false;
      }, 230);
    },
    [addToToday, leaving, n],
  );

  React.useEffect(() => {
    const el = wheelRootRef.current;
    if (!el || n <= 1) return;

    const flushAccumTimer = () => {
      if (wheelClearRef.current) {
        clearTimeout(wheelClearRef.current);
        wheelClearRef.current = null;
      }
    };

    const onWheel = (e: WheelEvent) => {
      let dx = e.deltaX;
      if (e.shiftKey && Math.abs(e.deltaY) > Math.abs(dx)) {
        dx = e.deltaY;
      }
      const adx = Math.abs(dx);
      const ady = Math.abs(e.deltaY);
      if (adx < 2 || (adx <= ady && !e.shiftKey)) return;

      e.preventDefault();
      e.stopPropagation();

      wheelAccum.current += dx;
      flushAccumTimer();
      wheelClearRef.current = setTimeout(() => {
        wheelAccum.current = 0;
        wheelClearRef.current = null;
      }, 200);

      if (wheelAccum.current <= -WHEEL_ACCUM_THRESHOLD) {
        goNext();
        wheelAccum.current = 0;
      } else if (wheelAccum.current >= WHEEL_ACCUM_THRESHOLD) {
        goPrev();
        wheelAccum.current = 0;
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      flushAccumTimer();
    };
  }, [goNext, goPrev, n]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY };
    movedRef.current = false;
    setDragging(true);
    setDrag({ x: 0, y: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 6) movedRef.current = true;
    setDrag({ x: dx, y: Math.max(-42, Math.min(42, dy)) });
  };

  const endDrag = (e: React.PointerEvent, recipe?: Recipe, canAdd?: boolean, selected?: boolean) => {
    const d = dragRef.current;
    const dx = d ? e.clientX - d.startX : drag.x;
    dragRef.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (d && dx < -SWIPE_THRESHOLD) {
      settleSwipe("left", recipe, canAdd, selected);
    } else if (d && dx > SWIPE_THRESHOLD) {
      settleSwipe("right", recipe, canAdd, selected);
    } else {
      setDrag({ x: 0, y: 0 });
    }
  };

  if (n === 0) {
    return (
      <div className="pk-panel-plain px-4 py-8 text-center text-[13px] text-[color:var(--muted)]">
        添加菜谱后，这里会按本地规则为你叠一摞「灵感卡」。
      </div>
    );
  }

  return (
    <div ref={wheelRootRef} className="relative pb-4 pt-9 outline-none sm:pb-0">
      <div className="pointer-events-none absolute right-1 top-0 z-20 flex items-center gap-1.5 text-[12px] font-medium text-[color:var(--accent)]">
        <GridIcon className="opacity-90" />
        <span>{n} 道菜</span>
      </div>
      <div className="pointer-events-none absolute left-1 top-0 z-20 text-[12px] text-[color:var(--muted-2)]">
        左滑换菜 · 右滑加入
      </div>

      <button
        type="button"
        aria-label="上一张灵感"
        disabled={n <= 1}
        onClick={() => goPrev()}
        className="pointer-events-auto absolute left-1 top-1/2 z-30 hidden -translate-y-1/2 rounded-lg border border-[color:var(--menu-line)] bg-[color:var(--paper)]/90 px-3 py-2 text-[18px] leading-none text-[color:var(--foreground)] shadow-[var(--shadow-soft)] disabled:pointer-events-none disabled:opacity-50 sm:block"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="下一张灵感"
        disabled={n <= 1}
        onClick={() => goNext()}
        className="pointer-events-auto absolute right-1 top-1/2 z-30 hidden -translate-y-1/2 rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)]/90 px-3 py-2 text-[18px] leading-none text-[color:var(--foreground)] shadow-[var(--shadow-soft)] disabled:pointer-events-none disabled:opacity-50 sm:block"
      >
        ›
      </button>

      <div className="relative mx-auto h-[500px] w-full max-w-[335px] select-none sm:h-[520px] sm:max-w-[360px] md:h-[480px] md:max-w-[330px]">
        <div className="relative h-full w-full">
          {Array.from({ length: Math.min(STACK_DEPTH, n) }, (_, depth) => {
            const backToFront = STACK_DEPTH - 1 - depth;
            const recipeIndex = (index + backToFront) % n;
            const r = recipes[recipeIndex]!;
            const isFront = backToFront === 0;
            const offsetX = backToFront * 8;
            const offsetY = backToFront * 9;
            const scale = isFront ? 1 : 1 - backToFront * 0.035;
            const opacity = 1 - backToFront * 0.07;

            const tx = isFront ? drag.x : 0;
            const ty = isFront ? drag.y : 0;
            const rotate = isFront ? Math.max(-13, Math.min(13, drag.x / 14)) : backToFront * -1.5;
            const base = `translateX(${offsetX + tx}px) translateY(${offsetY + ty}px) rotate(${rotate}deg) scale(${scale})`;
            const likeOpacity = isFront ? Math.max(0, Math.min(1, drag.x / SWIPE_THRESHOLD)) : 0;
            const skipOpacity = isFront ? Math.max(0, Math.min(1, -drag.x / SWIPE_THRESHOLD)) : 0;

            const usePointer = isFront;
            const todaySelected = isTodaySelected(r.id);
            const todayCanAdd = !todaySelected && todayIds.length < todayMax;

            return (
              <div
                key={`stack-slot-${backToFront}`}
                className="absolute inset-0"
                style={{
                  zIndex: 10 - backToFront,
                  transform: base,
                  transition:
                    isFront && dragging
                      ? "none"
                      : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                  opacity,
                }}
              >
                <div
                  className={`relative h-full overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)] shadow-[var(--shadow-soft)] ${
                    usePointer ? "cursor-grab touch-pan-y active:cursor-grabbing" : ""
                  } ${!usePointer && isFront ? "cursor-default" : ""} ${!isFront ? "pointer-events-none" : ""}`}
                  onPointerDown={usePointer ? onPointerDown : undefined}
                  onPointerMove={usePointer ? onPointerMove : undefined}
                  onPointerUp={usePointer ? (e) => endDrag(e, r, todayCanAdd, todaySelected) : undefined}
                  onPointerCancel={usePointer ? (e) => endDrag(e, r, todayCanAdd, todaySelected) : undefined}
                  style={{
                    boxShadow:
                      backToFront > 0
                        ? "0 10px 28px rgba(0,0,0,0.08)"
                        : undefined,
                  }}
                >
                  {isFront ? (
                    <>
                      <div
                        className="pointer-events-none absolute left-4 top-4 z-20 rotate-[-10deg] rounded-md border-2 border-[color:var(--warm)] bg-[color:var(--paper)]/80 px-3 py-1 text-[18px] font-semibold text-[color:var(--warm)] shadow-[var(--shadow-soft)] backdrop-blur"
                        style={{ opacity: skipOpacity }}
                      >
                        换一张
                      </div>
                      <div
                        className="pointer-events-none absolute right-4 top-4 z-20 rotate-[10deg] rounded-md border-2 border-[color:var(--accent)] bg-[color:var(--paper)]/80 px-3 py-1 text-[18px] font-semibold text-[color:var(--accent)] shadow-[var(--shadow-soft)] backdrop-blur"
                        style={{ opacity: likeOpacity }}
                      >
                        想吃
                      </div>
                    </>
                  ) : null}
                  {isFront ? (
                    <div
                      className="block h-full"
                      role="link"
                      tabIndex={0}
                      onClick={() => {
                        if (dragging || movedRef.current) {
                          movedRef.current = false;
                          return;
                        }
                        router.push(recipeDetailHref(r.id));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(recipeDetailHref(r.id));
                        }
                      }}
                    >
                      <CardFace
                        r={r}
                        showTodayAction
                        todaySelected={todaySelected}
                        todayCanAdd={todayCanAdd}
                        onTodayAction={() => void addToToday(r.id)}
                      />
                    </div>
                  ) : (
                    <div
                      aria-hidden="true"
                      className="h-full opacity-75"
                    >
                      <CardFace r={r} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mx-auto mt-5 grid max-w-[335px] grid-cols-[1fr_1.2fr] gap-3 sm:max-w-[360px]">
        <Button
          variant="outline"
          className="h-11"
          disabled={n <= 1 || !!leaving}
          onClick={() => settleSwipe("left")}
        >
          换一张
        </Button>
        <Button
          className="h-11"
          disabled={n <= 0 || !!leaving}
          onClick={() => {
            const r = recipes[index];
            if (!r) return;
            const selected = isTodaySelected(r.id);
            const canAdd = !selected && todayIds.length < todayMax;
            settleSwipe("right", r, canAdd, selected);
          }}
        >
          今天吃这个
        </Button>
      </div>
    </div>
  );
}

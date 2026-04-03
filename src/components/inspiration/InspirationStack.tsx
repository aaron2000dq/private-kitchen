"use client";

import * as React from "react";
import type { Recipe } from "@/lib/recipes/types";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useTodayCookbook } from "@/lib/today/useTodayCookbook";

const STACK_DEPTH = 4;
const SWIPE_THRESHOLD = 56;
const WHEEL_ACCUM_THRESHOLD = 48;

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
  const tags = r.tags ?? [];
  return (
    <>
      <div className="h-36 w-full shrink-0 bg-black/[0.04] dark:bg-white/[0.06]">
        {r.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.images[0]}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] text-[color:var(--muted-2)]">
            无图
          </div>
        )}
      </div>
      <div className="space-y-2 px-4 py-3">
        <div className="font-[var(--font-noto-serif-sc)] text-[17px] leading-snug tracking-wide">
          {r.name}
        </div>
        <div className="text-[12px] text-[color:var(--muted-2)]">{r.category}</div>
        <div className="text-[12px] text-[color:var(--muted)]">
          评分：{r.rating > 0 ? `${r.rating}/5` : "未评分"}
        </div>
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t, i) => (
              <span
                key={`${t}-${i}`}
                className="rounded-md border border-[color:var(--line)] bg-black/[0.03] px-2 py-0.5 text-[11px] leading-tight text-[color:var(--muted)] dark:bg-white/[0.06]"
              >
                {t}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-[color:var(--muted-2)]">标签：无</div>
        )}
      </div>

      {showTodayAction ? (
        <div className="mt-4 px-2">
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
    </>
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
  const [dragX, setDragX] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const dragRef = React.useRef<{ startX: number } | null>(null);
  const wheelRootRef = React.useRef<HTMLDivElement>(null);
  const wheelAccum = React.useRef(0);
  const wheelClearRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pointerDrag, setPointerDrag] = React.useState(true);
  React.useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const sync = () => setPointerDrag(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const goNext = React.useCallback(() => {
    if (n <= 1) return;
    setIndex((i) => (i + 1) % n);
    setDragX(0);
  }, [n]);

  const goPrev = React.useCallback(() => {
    if (n <= 1) return;
    setIndex((i) => (i - 1 + n) % n);
    setDragX(0);
  }, [n]);

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
    dragRef.current = { startX: e.clientX };
    setDragging(true);
    setDragX(0);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    setDragX(dx);
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const dx = d ? e.clientX - d.startX : dragX;
    dragRef.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (d && dx < -SWIPE_THRESHOLD) {
      goNext();
    } else if (d && dx > SWIPE_THRESHOLD) {
      goPrev();
    } else {
      setDragX(0);
    }
  };

  if (n === 0) {
    return (
      <div className="rounded-2xl border border-[color:var(--line)] bg-black/[0.02] px-4 py-8 text-center text-[13px] text-[color:var(--muted)] dark:bg-white/[0.03]">
        添加菜谱后，这里会按本地规则为你叠一摞「灵感卡」。
      </div>
    );
  }

  return (
    <div ref={wheelRootRef} className="relative pt-9 outline-none">
      <div className="pointer-events-none absolute right-1 top-0 z-20 flex items-center gap-1.5 text-[12px] font-medium text-[color:var(--accent)]">
        <GridIcon className="opacity-90" />
        <span>{n} 道菜</span>
      </div>

      <button
        type="button"
        aria-label="上一张灵感"
        disabled={n <= 1}
        onClick={() => goPrev()}
        className="absolute left-1 top-1/2 z-30 -translate-y-1/2 pointer-events-auto rounded-full border border-[color:var(--line)] bg-[color:var(--paper)]/90 px-3 py-2 text-[18px] leading-none text-[color:var(--foreground)] shadow-[var(--shadow)] disabled:opacity-50 disabled:pointer-events-none"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="下一张灵感"
        disabled={n <= 1}
        onClick={() => goNext()}
        className="absolute right-1 top-1/2 z-30 -translate-y-1/2 pointer-events-auto rounded-full border border-[color:var(--line)] bg-[color:var(--paper)]/90 px-3 py-2 text-[18px] leading-none text-[color:var(--foreground)] shadow-[var(--shadow)] disabled:opacity-50 disabled:pointer-events-none"
      >
        ›
      </button>

      <div className="relative mx-auto flex min-h-[min(52vh,380px)] w-full max-w-[300px] select-none items-center justify-center">
        <div className="relative h-[min(52vh,380px)] w-full max-w-[280px]">
          {Array.from({ length: Math.min(STACK_DEPTH, n) }, (_, depth) => {
            const backToFront = STACK_DEPTH - 1 - depth;
            const recipeIndex = (index + backToFront) % n;
            const r = recipes[recipeIndex]!;
            const isFront = backToFront === 0;
            const offsetX = backToFront * 11;
            const offsetY = backToFront * 3;
            const scale = isFront ? 1.04 : 1 - backToFront * 0.024;
            const opacity = 1 - backToFront * 0.07;

            const tx = isFront ? dragX : 0;
            const base = `translateX(${offsetX + tx}px) translateY(${offsetY}px) scale(${scale})`;

            const usePointer = isFront && pointerDrag;
            const todaySelected = isTodaySelected(r.id);
            const todayCanAdd = !todaySelected && todayIds.length < todayMax;

            return (
              <div
                key={`stack-slot-${backToFront}`}
                className="absolute inset-x-0 top-1/2 -translate-y-1/2"
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
                  className={`overflow-hidden rounded-[22px] border border-[color:var(--line)] bg-[color:var(--paper)] shadow-[var(--shadow)] ${
                    usePointer ? "cursor-grab touch-pan-y active:cursor-grabbing" : ""
                  } ${!usePointer && isFront ? "cursor-default" : ""} ${!isFront ? "pointer-events-none" : ""}`}
                  onPointerDown={usePointer ? onPointerDown : undefined}
                  onPointerMove={usePointer ? onPointerMove : undefined}
                  onPointerUp={usePointer ? endDrag : undefined}
                  onPointerCancel={usePointer ? endDrag : undefined}
                  style={{
                    boxShadow:
                      backToFront > 0
                        ? "0 10px 28px rgba(0,0,0,0.08)"
                        : undefined,
                  }}
                >
                  <div
                    className="block"
                    role={isFront ? "link" : undefined}
                    tabIndex={isFront ? 0 : -1}
                    onClick={
                      isFront
                        ? () => {
                            if (dragging) return;
                            router.push(`/recipes/${r.id}`);
                          }
                        : undefined
                    }
                    onKeyDown={
                      isFront
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              router.push(`/recipes/${r.id}`);
                            }
                          }
                        : undefined
                    }
                  >
                    <CardFace
                      r={r}
                      showTodayAction={isFront}
                      todaySelected={todaySelected}
                      todayCanAdd={todayCanAdd}
                      onTodayAction={() => void addToToday(r.id)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-center text-[12px] text-[color:var(--muted-2)]">
        在卡片区域双指左右轻扫触控板即可翻页（手机可拖拽）；点击查看详情。
      </p>
    </div>
  );
}

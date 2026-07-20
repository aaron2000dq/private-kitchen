"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import type { Recipe, RecipeStep } from "@/lib/recipes/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type ProgressSnapshot = {
  stepIndex: number;
  completedOrders: number[];
};

const KEY_PREFIX = "private-kitchen:cooking-mode:";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function storageKey(recipeId: string) {
  return `${KEY_PREFIX}${recipeId}`;
}

function readProgress(recipeId: string, maxIndex: number): ProgressSnapshot {
  if (typeof window === "undefined" || !window.localStorage) {
    return { stepIndex: 0, completedOrders: [] };
  }
  try {
    const raw = window.localStorage.getItem(storageKey(recipeId));
    if (!raw) return { stepIndex: 0, completedOrders: [] };
    const parsed = JSON.parse(raw) as Partial<ProgressSnapshot>;
    const stepIndex =
      typeof parsed.stepIndex === "number"
        ? Math.min(Math.max(0, parsed.stepIndex), maxIndex)
        : 0;
    const completedOrders = Array.isArray(parsed.completedOrders)
      ? parsed.completedOrders.filter((order): order is number => typeof order === "number")
      : [];
    return { stepIndex, completedOrders };
  } catch {
    return { stepIndex: 0, completedOrders: [] };
  }
}

function writeProgress(recipeId: string, snapshot: ProgressSnapshot) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(storageKey(recipeId), JSON.stringify(snapshot));
  } catch {
    // Local progress is helpful, but the cooking screen should never fail because storage is full.
  }
}

function inferMinutes(step: RecipeStep | undefined): number {
  const text = `${step?.content ?? ""} ${step?.tip ?? ""}`;
  const exact = text.match(/(\d{1,2})\s*(分钟|min)/i);
  if (exact?.[1]) return Math.max(1, Math.min(60, Number(exact[1])));
  if (/(炖|煲|焖|卤|烤)/.test(text)) return 20;
  if (/(腌|泡|醒)/.test(text)) return 15;
  if (/(蒸|煮|煎至|煎到)/.test(text)) return 10;
  if (/(炒|煎|焯|汆|烫)/.test(text)) return 5;
  return 3;
}

function formatTimer(seconds: number): string {
  const minute = Math.floor(seconds / 60);
  const second = seconds % 60;
  return `${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

function stepLabel(index: number, total: number) {
  return `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
}

export function RecipeCookingMode({ recipe }: { recipe: Recipe }) {
  const steps = React.useMemo(
    () => [...(recipe.steps ?? [])].sort((a, b) => a.order - b.order),
    [recipe.steps],
  );
  const ingredients = React.useMemo(
    () => [...(recipe.mainIngredients ?? []), ...(recipe.auxiliaryIngredients ?? [])].slice(0, 10),
    [recipe.auxiliaryIngredients, recipe.mainIngredients],
  );
  const [open, setOpen] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [completedOrders, setCompletedOrders] = React.useState<Set<number>>(new Set());
  const [timerSeconds, setTimerSeconds] = React.useState(0);
  const [timerRunning, setTimerRunning] = React.useState(false);
  const [portalTarget, setPortalTarget] = React.useState<HTMLElement | null>(null);
  const touchStartX = React.useRef<number | null>(null);

  const activeStep = steps[stepIndex];
  const total = steps.length;
  const completedCount = completedOrders.size;
  const progress = total ? Math.round((completedCount / total) * 100) : 0;
  const inferredMinutes = inferMinutes(activeStep);
  const timerPresets = React.useMemo(
    () => Array.from(new Set([inferredMinutes, 5, 10])).filter((minute) => minute > 0).slice(0, 3),
    [inferredMinutes],
  );

  React.useEffect(() => {
    const snapshot = readProgress(recipe.id, Math.max(0, total - 1));
    const validOrders = new Set(steps.map((step) => step.order));
    setStepIndex(snapshot.stepIndex);
    setCompletedOrders(new Set(snapshot.completedOrders.filter((order) => validOrders.has(order))));
    setHydrated(true);
  }, [recipe.id, steps, total]);

  React.useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    writeProgress(recipe.id, {
      stepIndex,
      completedOrders: Array.from(completedOrders),
    });
  }, [completedOrders, hydrated, recipe.id, stepIndex]);

  React.useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setTimerSeconds((current) => {
        if (current <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  React.useEffect(() => {
    if (!open) {
      setTimerRunning(false);
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "ArrowRight") setStepIndex((current) => Math.min(total - 1, current + 1));
      if (event.key === "ArrowLeft") setStepIndex((current) => Math.max(0, current - 1));
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, total]);

  const goNext = React.useCallback(() => {
    setStepIndex((current) => Math.min(total - 1, current + 1));
    setTimerRunning(false);
  }, [total]);

  const goPrev = React.useCallback(() => {
    setStepIndex((current) => Math.max(0, current - 1));
    setTimerRunning(false);
  }, []);

  const toggleDone = React.useCallback(() => {
    if (!activeStep) return;
    setCompletedOrders((current) => {
      const next = new Set(current);
      if (next.has(activeStep.order)) {
        next.delete(activeStep.order);
      } else {
        next.add(activeStep.order);
      }
      return next;
    });
  }, [activeStep]);

  const resetProgress = React.useCallback(() => {
    setStepIndex(0);
    setCompletedOrders(new Set());
    setTimerSeconds(0);
    setTimerRunning(false);
  }, []);

  const startTimer = React.useCallback((minutes: number) => {
    setTimerSeconds(minutes * 60);
    setTimerRunning(true);
  }, []);

  const activeDone = activeStep ? completedOrders.has(activeStep.order) : false;

  return (
    <>
      <Button
        size="sm"
        className="w-full sm:w-auto"
        disabled={!steps.length}
        onClick={() => setOpen(true)}
      >
        进入厨房模式
      </Button>

      {open && portalTarget ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${recipe.name}厨房模式`}
          className="fixed inset-0 z-[100] overflow-y-auto bg-[color:var(--background)] text-[color:var(--foreground)]"
        >
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-[var(--app-gutter)] pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-6">
            <header className="sticky top-0 z-10 -mx-[var(--app-gutter)] border-b border-[color:var(--line)] bg-[color:var(--background)]/96 px-[var(--app-gutter)] pb-3 pt-2 backdrop-blur sm:-mx-6 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone="warm">厨房模式</Badge>
                    <span className="text-[12px] text-[color:var(--muted-2)]">
                      {hydrated ? `${completedCount}/${total} 完成` : "读取中"}
                    </span>
                  </div>
                  <h2 className="pk-serif mt-2 line-clamp-2 text-[24px] leading-tight sm:text-[30px]">
                    {recipe.name}
                  </h2>
                </div>
                <button
                  type="button"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)] text-[18px]"
                  aria-label="关闭厨房模式"
                  onClick={() => setOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color:rgba(24,33,29,0.08)]">
                <div
                  className="h-full rounded-full bg-[color:var(--accent)] transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </header>

            <main className="flex flex-1 flex-col gap-4 py-4">
              <section className="rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)] p-3 shadow-[var(--shadow-soft)]">
                <div className="pk-scrollbar flex gap-2 overflow-x-auto pb-1">
                  {steps.map((step, index) => {
                    const active = index === stepIndex;
                    const done = completedOrders.has(step.order);
                    return (
                      <button
                        key={step.order}
                        type="button"
                        aria-pressed={active}
                        className={cn(
                          "flex h-12 min-w-12 shrink-0 items-center justify-center rounded-lg border px-3 text-[13px] transition-colors",
                          active
                            ? "border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]"
                            : done
                              ? "border-[color:rgba(63,111,85,0.30)] bg-[color:rgba(63,111,85,0.10)] text-[color:var(--accent)]"
                              : "border-[color:var(--menu-line-soft)] bg-[color:var(--paper-strong)] text-[color:var(--muted)]",
                        )}
                        onClick={() => {
                          setStepIndex(index);
                          setTimerRunning(false);
                        }}
                      >
                        {done && !active ? "✓ " : ""}
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section
                className="flex flex-1 flex-col rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)] p-5 shadow-[var(--shadow-soft)] sm:p-6"
                onTouchStart={(event) => {
                  touchStartX.current = event.touches[0]?.clientX ?? null;
                }}
                onTouchEnd={(event) => {
                  const start = touchStartX.current;
                  touchStartX.current = null;
                  if (start == null) return;
                  const end = event.changedTouches[0]?.clientX ?? start;
                  const delta = end - start;
                  if (Math.abs(delta) < 54) return;
                  if (delta < 0) goNext();
                  if (delta > 0) goPrev();
                }}
              >
                {activeStep ? (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[12px] text-[color:var(--muted-2)]">
                          当前步骤
                        </div>
                        <div className="pk-serif mt-1 text-[34px] leading-none text-[color:var(--accent)] sm:text-[44px]">
                          {stepLabel(stepIndex, total)}
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-pressed={activeDone}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-[13px]",
                          activeDone
                            ? "border-[color:rgba(63,111,85,0.34)] bg-[color:rgba(63,111,85,0.10)] text-[color:var(--accent)]"
                            : "border-[color:var(--menu-line)] bg-[color:var(--paper-strong)] text-[color:var(--foreground)]",
                        )}
                        onClick={toggleDone}
                      >
                        {activeDone ? "已完成" : "标记完成"}
                      </button>
                    </div>

                    <div className="mt-6 flex min-h-[13rem] items-center">
                      <p className="whitespace-pre-wrap break-words text-[25px] leading-[1.75] tracking-normal sm:text-[30px]">
                        {activeStep.content}
                      </p>
                    </div>

                    {activeStep.tip ? (
                      <div className="mt-4 rounded-lg border border-[color:rgba(184,92,56,0.24)] bg-[color:rgba(184,92,56,0.07)] px-4 py-3 text-[14px] leading-7 text-[color:var(--warm)]">
                        提示：{activeStep.tip}
                      </div>
                    ) : null}

                    <div className="mt-5 grid gap-3 rounded-lg border border-[color:var(--menu-line-soft)] bg-[color:var(--paper-strong)]/74 p-3 sm:grid-cols-[1fr_auto]">
                      <div>
                        <div className="text-[12px] text-[color:var(--muted-2)]">计时器</div>
                        <div className="pk-serif mt-1 text-[36px] leading-none">
                          {formatTimer(timerSeconds)}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 sm:flex sm:items-center">
                        {timerPresets.map((minute) => (
                          <button
                            key={minute}
                            type="button"
                            className="h-10 rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)] px-2 text-[12px]"
                            onClick={() => startTimer(minute)}
                          >
                            {minute}分
                          </button>
                        ))}
                        <button
                          type="button"
                          className="h-10 rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)] px-2 text-[12px]"
                          disabled={timerSeconds === 0}
                          onClick={() => setTimerRunning((value) => !value)}
                        >
                          {timerRunning ? "暂停" : "继续"}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[18rem] items-center justify-center text-[14px] text-[color:var(--muted)]">
                    这道菜还没有步骤。
                  </div>
                )}
              </section>

              {ingredients.length ? (
                <section className="rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)] p-4">
                  <div className="text-[12px] text-[color:var(--muted-2)]">手边用料</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ingredients.map((item, index) => (
                      <span
                        key={`${item.name}-${index}`}
                        className="rounded-lg border border-[color:var(--menu-line-soft)] bg-[color:var(--paper-strong)] px-3 py-2 text-[12px] leading-5 text-[color:var(--muted)]"
                      >
                        {item.name}
                        {item.amount ? ` · ${item.amount}` : ""}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}
            </main>

            <footer className="sticky bottom-0 -mx-[var(--app-gutter)] border-t border-[color:var(--line)] bg-[color:var(--background)]/96 px-[var(--app-gutter)] py-3 backdrop-blur sm:-mx-6 sm:px-6">
              <div className="grid grid-cols-[1fr_1.3fr_1fr] gap-2">
                <Button variant="outline" disabled={stepIndex === 0} onClick={goPrev}>
                  上一步
                </Button>
                <Button onClick={toggleDone}>
                  {activeDone ? "取消完成" : "完成本步"}
                </Button>
                <Button variant="outline" disabled={stepIndex >= total - 1} onClick={goNext}>
                  下一步
                </Button>
              </div>
              <button
                type="button"
                className="mt-2 h-9 w-full rounded-lg text-[12px] text-[color:var(--muted-2)]"
                onClick={resetProgress}
              >
                从头开始
              </button>
            </footer>
          </div>
        </div>,
        portalTarget,
      ) : null}
    </>
  );
}

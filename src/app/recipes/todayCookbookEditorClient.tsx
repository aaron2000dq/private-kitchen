"use client";

import * as React from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useRecipes } from "@/lib/recipes/useRecipes";
import { useTodayCookbook } from "@/lib/today/useTodayCookbook";
import { exportTodayCookbookToPng } from "@/lib/today/exportTodayCookbookToImage";
import { recipeImageThumbUrl, recipeImageUrl } from "@/lib/recipes/recipeImageUrl";
import { VisuallyLosslessThumb } from "@/components/recipes/VisuallyLosslessThumb";

export function TodayCookbookEditorClient() {
  const { recipes, hydrated: recipesHydrated } = useRecipes();
  const {
    hydrated: todayHydrated,
    ids: todayIds,
    remove,
    clear,
    max: todayMax,
  } = useTodayCookbook();

  const selectedRecipes = React.useMemo(() => {
    if (!todayIds.length) return [];
    const order = new Map(todayIds.map((id, i) => [id, i]));
    return recipes
      .filter((r) => order.has(r.id))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .slice(0, todayMax);
  }, [recipes, todayIds, todayMax]);

  /**
   * 今日已选了 id，但菜谱列表仍为空：通常是首次灌库尚未完成，避免误显示「空」。
   * 若菜谱已有数据却匹配不到 id，则视为失效选择，走下面的空态。
   */
  const waitingForRecipeList =
    todayHydrated &&
    recipesHydrated &&
    todayIds.length > 0 &&
    selectedRecipes.length === 0 &&
    recipes.length === 0;

  const [busy, setBusy] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);

  const onClear = async () => {
    const ok = window.confirm("确认清空今日菜谱？");
    if (!ok) return;
    await clear();
  };

  const onExport = async () => {
    if (!selectedRecipes.length) return;
    setBusy(true);
    setExportError(null);
    try {
      await exportTodayCookbookToPng(selectedRecipes);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "分享失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="pk-section-label">今日家宴</div>
          <h1 className="pk-serif text-[28px] tracking-wide">
            编辑今日的菜谱
          </h1>
          <p className="text-[13px] leading-6 text-[color:var(--muted)]">
            在「今日」和「分类」的菜品卡片里点「今天吃这个」，这里可以清空、删除、分享小票。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={onClear}
            disabled={!todayHydrated || todayIds.length === 0 || busy}
          >
            清空
          </Button>
          <Button onClick={onExport} disabled={!todayHydrated || selectedRecipes.length === 0 || busy}>
            {busy ? "生成中..." : "分享小票"}
          </Button>
        </div>
      </div>

      {exportError ? (
        <div className="rounded-lg border border-[color:rgba(201,138,99,0.35)] bg-[color:rgba(201,138,99,0.10)] px-4 py-3 text-[13px]">
          {exportError}
        </div>
      ) : null}

      {!recipesHydrated || !todayHydrated || waitingForRecipeList ? (
        <div className="pk-panel-plain p-8 text-[13px] text-[color:var(--muted-2)]">
          读取中…
        </div>
      ) : selectedRecipes.length === 0 ? (
        <div className="pk-panel-plain p-8">
          <Badge tone="muted">空</Badge>
          <p className="mt-3 text-[13px] leading-7 text-[color:var(--muted)]">
            还没有设置今日菜谱。去「今日」或「分类」挑最多 10 道吧。
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {selectedRecipes.map((r) => (
            <div
              key={r.id}
              className="overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)] shadow-[var(--shadow-soft)]"
            >
              <div className="relative">
                <div className="min-w-0">
                  {r.images?.[0] ? (
                    <VisuallyLosslessThumb
                      src={recipeImageThumbUrl(r.images[0])}
                      fallbackSrc={recipeImageUrl(r.images[0])}
                      alt={r.name}
                      className="h-36 w-full border-b border-[color:var(--line)] bg-[color:var(--wash)] object-cover"
                    />
                  ) : (
                    <div className="flex h-36 w-full items-center justify-center border-b border-[color:var(--line)] bg-[color:var(--wash)] text-[12px] text-[color:var(--muted-2)]">
                      无图
                    </div>
                  )}
                </div>
                <div className="absolute right-3 top-3 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void remove(r.id)}
                  >
                    删除
                  </Button>
                </div>
              </div>

              <div className="space-y-2 p-4">
                <div className="pk-serif truncate text-[18px] tracking-wide">
                  {r.name}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="accent">{r.category}</Badge>
                  {r.rating ? (
                    <Badge tone="muted">评分：{r.rating}/5</Badge>
                  ) : (
                    <Badge tone="muted">未评分</Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

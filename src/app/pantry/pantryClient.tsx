"use client";

import * as React from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useRecipes } from "@/lib/recipes/useRecipes";
import { buildTodayMenuInsights } from "@/lib/today/menuInsights";
import { PANTRY_CATEGORIES, buildPantryCoverage, type PantryCategoryKey, type PantryItem } from "@/lib/today/pantry";
import { usePantry } from "@/lib/today/usePantry";
import { useTodayCookbook } from "@/lib/today/useTodayCookbook";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const QUICK_ITEMS = ["鸡蛋", "豆腐", "青菜", "番茄", "土豆", "大米", "挂面", "生抽", "食用油", "葱", "姜", "蒜"];

export function PantryClient() {
  const { recipes } = useRecipes();
  const { ids } = useTodayCookbook();
  const pantry = usePantry();
  const [name, setName] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [tip, setTip] = React.useState<string | null>(null);

  const selectedRecipes = React.useMemo(() => {
    if (!ids.length) return [];
    const order = new Map(ids.map((id, index) => [id, index]));
    return recipes
      .filter((recipe) => order.has(recipe.id))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }, [ids, recipes]);
  const insights = React.useMemo(() => buildTodayMenuInsights(selectedRecipes), [selectedRecipes]);
  const coverage = React.useMemo(
    () => buildPantryCoverage(insights.shoppingList, pantry.items),
    [insights.shoppingList, pantry.items],
  );
  const grouped = React.useMemo(() => {
    const map = new Map<PantryCategoryKey, PantryItem[]>();
    for (const category of PANTRY_CATEGORIES) {
      map.set(category.key, []);
    }
    for (const item of pantry.items) {
      map.set(item.category, [...(map.get(item.category) ?? []), item]);
    }
    return PANTRY_CATEGORIES.map((category) => ({
      ...category,
      items: map.get(category.key) ?? [],
    }));
  }, [pantry.items]);

  const addItem = (itemName = name, itemAmount = amount) => {
    const trimmed = itemName.trim();
    if (!trimmed) return;
    const item = pantry.add(trimmed, itemAmount.trim() || "有");
    setName("");
    setAmount("");
    setTip(`已放入冰箱：${item.name}`);
  };

  const copyMissing = async () => {
    if (!coverage.missing.length) return;

    try {
      await navigator.clipboard.writeText(
        [
          "今日菜单 · 还需要采购",
          ...coverage.missing.map((item) => `□ ${item}`),
          coverage.inStock.length ? `家里已有：${coverage.inStock.slice(0, 8).join("、")}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      setTip("缺口清单已复制。");
    } catch {
      setTip("复制失败，可以直接截图缺口清单。");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="pk-section-label">冰箱库存</div>
          <h1 className="pk-serif text-[30px] leading-tight">家里有什么</h1>
          <p className="text-[13px] leading-6 text-[color:var(--muted)]">
            把常备食材记下来，今日菜单会自动区分“家里有”和“还要买”。
          </p>
        </div>
        <ButtonLink href="/recipes" className="shrink-0">
          去配菜
        </ButtonLink>
      </div>

      <section className="pk-panel p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Badge tone="accent">采购缺口</Badge>
            <div className="pk-serif mt-3 text-[25px] leading-tight">
              {coverage.total ? `家里已有 ${coverage.inStock.length} 项` : "先定一桌菜单"}
            </div>
            <p className="mt-2 text-[13px] leading-6 text-[color:var(--muted)]">
              {coverage.total
                ? `${coverage.missing.length} 项还需要买，库存命中率 ${coverage.ratio}%。`
                : "去菜谱页配好今日菜单后，这里会生成采购缺口。"}
            </p>
          </div>
          <div className="grid h-[82px] w-[82px] shrink-0 place-items-center rounded-lg border border-[color:var(--menu-line)] bg-[radial-gradient(circle_at_50%_38%,rgba(63,111,85,0.14),rgba(255,253,246,0.68))]">
            <div className="text-center">
              <div className="pk-serif text-[25px] leading-none text-[color:var(--accent)]">{coverage.ratio}</div>
              <div className="mt-1 text-[10px] text-[color:var(--muted-2)]">命中率</div>
            </div>
          </div>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[color:rgba(24,33,29,0.08)]">
          <div
            className="h-full rounded-full bg-[color:var(--accent)] transition-[width]"
            style={{ width: `${coverage.ratio}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)]/72 px-3 py-2">
            <div className="text-[11px] text-[color:var(--muted-2)]">还要买</div>
            <div className="pk-serif mt-1 text-[20px] text-[color:var(--warm)]">{coverage.missing.length}</div>
          </div>
          <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)]/72 px-3 py-2">
            <div className="text-[11px] text-[color:var(--muted-2)]">库存</div>
            <div className="pk-serif mt-1 text-[20px] text-[color:var(--accent)]">{pantry.items.length}</div>
          </div>
        </div>

        {coverage.missing.length ? (
          <div className="mt-4 rounded-lg border border-[color:rgba(184,92,56,0.22)] bg-[color:rgba(184,92,56,0.06)] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="pk-serif text-[17px]">还需要买</div>
                <div className="mt-1 text-[11px] text-[color:var(--muted-2)]">按今日菜单自动生成</div>
              </div>
              <Button size="sm" variant="outline" className="h-8 px-2.5 text-[12px]" onClick={copyMissing}>
                复制
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {coverage.missing.slice(0, 12).map((item) => (
                <span
                  key={item}
                  className="rounded-md border border-[color:rgba(184,92,56,0.20)] bg-[color:var(--paper)]/74 px-2.5 py-1 text-[12px] text-[color:var(--warm)]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {coverage.inStock.length ? (
          <div className="mt-3 rounded-lg border border-[color:rgba(63,111,85,0.20)] bg-[color:rgba(63,111,85,0.06)] p-3">
            <div className="pk-serif text-[17px]">家里已有</div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {coverage.inStock.slice(0, 12).map((item) => (
                <span
                  key={item}
                  className="rounded-md border border-[color:rgba(63,111,85,0.20)] bg-[color:var(--paper)]/74 px-2.5 py-1 text-[12px] text-[color:var(--accent)]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="pk-panel p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge tone="warm">补库存</Badge>
            <div className="pk-serif mt-3 text-[22px] leading-tight">常备食材</div>
          </div>
          <Button size="sm" variant="outline" onClick={pantry.seedDefaults} disabled={!pantry.hydrated}>
            放入常备
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_5.2rem] gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="食材名"
            className="h-10 text-[13px]"
          />
          <Input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="数量"
            className="h-10 text-[13px]"
          />
        </div>
        <Button className="mt-2 w-full" onClick={() => addItem()} disabled={!name.trim()}>
          加入冰箱
        </Button>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {QUICK_ITEMS.map((item) => (
            <button
              key={item}
              type="button"
              className="rounded-md border border-[color:var(--menu-line-soft)] bg-[color:var(--paper)]/72 px-2.5 py-1 text-[12px] text-[color:var(--muted)]"
              onClick={() => addItem(item, "有")}
            >
              {item}
            </button>
          ))}
        </div>

        {tip ? (
          <div className="mt-3 rounded-lg border border-[color:rgba(63,111,85,0.22)] bg-[color:rgba(63,111,85,0.07)] px-3 py-2 text-[12px] text-[color:var(--accent)]">
            {tip}
          </div>
        ) : null}
      </section>

      <section className="grid gap-3">
        {grouped.map((group) => (
          <div key={group.key} className="pk-panel-plain p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="pk-serif text-[18px] leading-tight">{group.label}</div>
                <div className="mt-1 text-[11px] text-[color:var(--muted-2)]">{group.hint}</div>
              </div>
              <Badge tone={group.items.length ? "accent" : "muted"}>{group.items.length}项</Badge>
            </div>

            {group.items.length ? (
              <div className="mt-3 grid gap-2">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)]/72 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[13px] text-[color:var(--foreground)]">{item.name}</div>
                      <div className="mt-0.5 truncate text-[11px] text-[color:var(--muted-2)]">{item.amount}</div>
                    </div>
                    <button
                      type="button"
                      className={cn(
                        "h-8 rounded-md border border-[color:var(--menu-line-soft)] px-2.5 text-[12px] text-[color:var(--muted)]",
                        "hover:bg-[color:rgba(184,92,56,0.07)] hover:text-[color:var(--warm)]",
                      )}
                      onClick={() => pantry.remove(item.id)}
                    >
                      用完
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-[color:var(--menu-line-soft)] px-3 py-4 text-[12px] leading-5 text-[color:var(--muted)]">
                暂时没有记录这一类食材。
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

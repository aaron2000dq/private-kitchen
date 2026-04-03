"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useRecipes } from "@/lib/recipes/useRecipes";
import { Recipe, RecipeDifficulty, RecipeIngredient, RecipeStep } from "@/lib/recipes/types";
import { recipeDetailHref } from "@/lib/recipes/recipeRoutes";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { StarRating } from "@/components/ui/StarRating";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function normalizeSteps(raw: Array<{ content: string; tip?: string }>): RecipeStep[] {
  const cleaned = raw
    .map((s) => ({ content: s.content.trim(), tip: s.tip?.trim() }))
    .filter((s) => s.content.length > 0);
  return cleaned.map((s, idx) => ({ order: idx + 1, ...s }));
}

function normalizeIngredients(raw: Array<{ name: string; amount: string; note?: string }>): RecipeIngredient[] {
  return raw
    .map((i) => ({
      name: i.name.trim(),
      amount: i.amount.trim(),
      note: i.note?.trim(),
    }))
    .filter((i) => i.name.length > 0 || i.amount.length > 0);
}

const difficultyOptions: Array<{ value: RecipeDifficulty; label: string }> = [
  { value: "easy", label: "简单" },
  { value: "medium", label: "适中" },
  { value: "hard", label: "费心" },
];

export function RecipeFormClient({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: Recipe | null;
}) {
  const router = useRouter();
  const { create, update, remove, hydrated } = useRecipes();

  const [name, setName] = React.useState(initial?.name ?? "");
  const [category, setCategory] = React.useState(initial?.category ?? "");
  const [rating, setRating] = React.useState<number>(initial?.rating ?? 0);
  const [difficulty, setDifficulty] = React.useState<RecipeDifficulty>(
    initial?.difficulty ?? "medium",
  );
  const [tags, setTags] = React.useState<string>((initial?.tags ?? []).join(" "));
  const [description, setDescription] = React.useState(initial?.description ?? "");

  const [ingredients, setIngredients] = React.useState<
    Array<{ name: string; amount: string; note?: string }>
  >(
    initial?.ingredients?.length
      ? initial.ingredients.map((i) => ({ name: i.name, amount: i.amount, note: i.note }))
      : [{ name: "", amount: "", note: "" }],
  );

  const [steps, setSteps] = React.useState<Array<{ content: string; tip?: string }>>(
    initial?.steps?.length
      ? initial.steps
          .sort((a, b) => a.order - b.order)
          .map((s) => ({ content: s.content, tip: s.tip }))
      : [{ content: "", tip: "" }],
  );

  const [images, setImages] = React.useState<string[]>(initial?.images ?? []);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canDelete = mode === "edit" && initial?.id;

  const onPickImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const urls = await Promise.all(Array.from(files).map(fileToDataUrl));
      setImages((prev) => [...urls, ...prev].slice(0, 12));
    } catch {
      setError("图片读取失败，请重试。");
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async () => {
    setError(null);
    const n = name.trim();
    const c = category.trim();
    if (!n) {
      setError("请填写菜名。");
      return;
    }
    if (!c) {
      setError("请填写分类（例如：家常菜 / 煎炸烧烤 / 汤羹 / 火锅）。");
      return;
    }

    const normalizedSteps = normalizeSteps(steps);
    if (normalizedSteps.length === 0) {
      setError("至少需要 1 个步骤。");
      return;
    }

    setBusy(true);
    try {
      const input = {
        name: n,
        category: c,
        rating,
        difficulty,
        tags: tags
          .split(/\s+/g)
          .map((t) => t.trim())
          .filter(Boolean),
        description: description.trim(),
        ingredients: normalizeIngredients(ingredients),
        steps: normalizedSteps,
        images,
      } as const;

      if (mode === "create") {
        const r = await create(input);
        router.push(recipeDetailHref(r.id));
      } else {
        const id = initial?.id;
        if (!id) return;
        const updated = await update(id, input);
        router.push(recipeDetailHref(updated?.id ?? id));
      }
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    if (!initial?.id) return;
    const ok = window.confirm("确认删除这道菜谱？此操作不可撤销。");
    if (!ok) return;
    void remove(initial.id).then(() => router.push("/recipes/all"));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="font-[var(--font-noto-serif-sc)] text-[26px] tracking-wide">
            {mode === "create" ? "新增菜谱" : "编辑菜谱"}
          </h1>
          <p className="text-[13px] leading-6 text-[color:var(--muted)]">
            {mode === "create"
              ? "把你会做的菜写下来，之后会更轻松。"
              : "细微的调整，会让味道更接近你的习惯。"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canDelete ? (
            <Button variant="ghost" onClick={onDelete} disabled={!hydrated || busy}>
              删除
            </Button>
          ) : null}
          <Button onClick={onSubmit} disabled={!hydrated || busy}>
            {busy ? "保存中…" : "保存"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-[color:rgba(201,138,99,0.35)] bg-[color:rgba(201,138,99,0.10)] px-4 py-3 text-[13px] text-[color:var(--foreground)]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper)] p-6">
            <div className="flex items-center justify-between gap-4">
              <Badge tone="muted">基本信息</Badge>
              <StarRating value={rating} onChange={setRating} label="评分" />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-[12px] text-[color:var(--muted)]">菜名</div>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：番茄炒蛋" />
              </div>
              <div className="space-y-2">
                <div className="text-[12px] text-[color:var(--muted)]">分类</div>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="例如：家常菜 / 煎炸烧烤 / 煲仔 / 粥面粉 / 火锅"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-[12px] text-[color:var(--muted)]">难度</div>
                <div className="grid grid-cols-3 gap-2">
                  {difficultyOptions.map((opt) => {
                    const active = opt.value === difficulty;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        className={cn(
                          "h-11 rounded-xl border text-[13px] transition-colors",
                          active
                            ? "border-[color:rgba(107,142,107,0.35)] bg-[color:rgba(107,142,107,0.10)] text-[color:var(--foreground)]"
                            : "border-[color:var(--line)] bg-transparent text-[color:var(--muted)] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
                        )}
                        onClick={() => setDifficulty(opt.value)}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-[12px] text-[color:var(--muted)]">标签（空格分隔）</div>
                <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="例如：快手 清爽 下饭" />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="text-[12px] text-[color:var(--muted)]">简介</div>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="一句话描述它的味道、场景或心得。" />
            </div>
          </div>

          <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper)] p-6">
            <div className="flex items-center justify-between gap-4">
              <Badge tone="muted">用料</Badge>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setIngredients((prev) => [...prev, { name: "", amount: "", note: "" }])}
              >
                添加
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              {ingredients.map((row, idx) => (
                <div key={idx} className="grid gap-2 md:grid-cols-[1fr_0.7fr_1fr_auto]">
                  <Input
                    value={row.name}
                    onChange={(e) =>
                      setIngredients((prev) =>
                        prev.map((p, i) => (i === idx ? { ...p, name: e.target.value } : p)),
                      )
                    }
                    placeholder="食材"
                  />
                  <Input
                    value={row.amount}
                    onChange={(e) =>
                      setIngredients((prev) =>
                        prev.map((p, i) => (i === idx ? { ...p, amount: e.target.value } : p)),
                      )
                    }
                    placeholder="用量"
                  />
                  <Input
                    value={row.note ?? ""}
                    onChange={(e) =>
                      setIngredients((prev) =>
                        prev.map((p, i) => (i === idx ? { ...p, note: e.target.value } : p)),
                      )
                    }
                    placeholder="备注（可选）"
                  />
                  <button
                    type="button"
                    className="h-11 rounded-xl border border-[color:var(--line)] px-3 text-[12px] text-[color:var(--muted)] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
                    onClick={() =>
                      setIngredients((prev) => prev.filter((_, i) => i !== idx).length ? prev.filter((_, i) => i !== idx) : [{ name: "", amount: "", note: "" }])
                    }
                    aria-label="删除用料"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper)] p-6">
            <div className="flex items-center justify-between gap-4">
              <Badge tone="muted">步骤</Badge>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setSteps((prev) => [...prev, { content: "", tip: "" }])}
              >
                添加
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              {steps.map((row, idx) => (
                <div key={idx} className="rounded-2xl border border-[color:var(--line)] bg-black/[0.01] p-3 dark:bg-white/[0.03]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[12px] text-[color:var(--muted)]">步骤 {idx + 1}</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-xl border border-[color:var(--line)] px-2.5 py-1 text-[12px] text-[color:var(--muted)] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
                        onClick={() =>
                          setSteps((prev) => {
                            if (idx === 0) return prev;
                            const copy = [...prev];
                            [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
                            return copy;
                          })
                        }
                        aria-label="上移步骤"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-[color:var(--line)] px-2.5 py-1 text-[12px] text-[color:var(--muted)] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
                        onClick={() =>
                          setSteps((prev) => {
                            if (idx === prev.length - 1) return prev;
                            const copy = [...prev];
                            [copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]];
                            return copy;
                          })
                        }
                        aria-label="下移步骤"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-[color:var(--line)] px-2.5 py-1 text-[12px] text-[color:var(--muted)] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
                        onClick={() =>
                          setSteps((prev) =>
                            prev.filter((_, i) => i !== idx).length ? prev.filter((_, i) => i !== idx) : [{ content: "", tip: "" }],
                          )
                        }
                        aria-label="删除步骤"
                      >
                        删除
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 space-y-2">
                    <Textarea
                      value={row.content}
                      onChange={(e) =>
                        setSteps((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, content: e.target.value } : p)),
                        )
                      }
                      placeholder="做法描述"
                      className="min-h-24"
                    />
                    <Input
                      value={row.tip ?? ""}
                      onChange={(e) =>
                        setSteps((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, tip: e.target.value } : p)),
                        )
                      }
                      placeholder="小提示（可选）"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper)] p-6">
            <div className="flex items-center justify-between gap-4">
              <Badge tone="muted">图片</Badge>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[color:var(--line)] bg-transparent px-3 py-2 text-[13px] text-[color:var(--muted)] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]">
                添加图片
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => onPickImages(e.target.files)}
                />
              </label>
            </div>

            {images.length === 0 ? (
              <p className="mt-4 text-[13px] leading-6 text-[color:var(--muted-2)]">
                你可以一次选择多张图片，会以 Base64 形式保存在本地（适合少量图片）。
              </p>
            ) : (
              <div className="mt-5 grid grid-cols-3 gap-3">
                {images.map((src, idx) => (
                  <div
                    key={idx}
                    className="group relative overflow-hidden rounded-2xl border border-[color:var(--line)] bg-black/[0.03] dark:bg-white/[0.05]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`图片 ${idx + 1}`} className="h-28 w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-2 top-2 rounded-lg bg-black/60 px-2 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label="移除图片"
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}


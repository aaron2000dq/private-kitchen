"use client";

import * as React from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { RecipeInput } from "@/lib/recipes/types";
import { RecipeRepository } from "@/lib/recipes/repository";

type ImportDraft = {
  recipe: RecipeInput;
  issues: string[];
};

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function safeJsonParse(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(String).map((s) => s.trim()).filter(Boolean);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeDraft(raw: Record<string, unknown>): ImportDraft {
  const issues: string[] = [];

  const name = String(raw.name ?? "").trim();
  const category = String(raw.category ?? "").trim();
  const rating = Number(raw.rating ?? 0);
  const difficultyRaw = String(raw.difficulty ?? "medium");
  const difficulty =
    difficultyRaw === "easy" || difficultyRaw === "hard" || difficultyRaw === "medium"
      ? difficultyRaw
      : "medium";

  if (!name) issues.push("缺少菜名 name");
  if (!category) issues.push("缺少分类 category");

  const tags = asStringArray(raw.tags);
  const description = String(raw.description ?? "").trim();

  const mapRows = (arr: unknown[]) =>
    arr
      .map((i) => ({
        name: String((i as { name?: unknown }).name ?? "").trim(),
        amount: String((i as { amount?: unknown }).amount ?? "").trim(),
        note: (i as { note?: unknown }).note ? String((i as { note?: unknown }).note).trim() : undefined,
      }))
      .filter((i) => i.name || i.amount);

  const legacyFlat =
    Array.isArray(raw.ingredients) && raw.ingredients.every(isObject)
      ? mapRows(raw.ingredients as unknown[])
      : [];

  const mainFromKeys =
    Array.isArray(raw.mainIngredients) && raw.mainIngredients.every(isObject)
      ? mapRows(raw.mainIngredients as unknown[])
      : [];
  const auxFromKeys =
    Array.isArray(raw.auxiliaryIngredients) && raw.auxiliaryIngredients.every(isObject)
      ? mapRows(raw.auxiliaryIngredients as unknown[])
      : [];

  const hasSplit =
    (Array.isArray(raw.mainIngredients) && raw.mainIngredients.every(isObject)) ||
    (Array.isArray(raw.auxiliaryIngredients) && raw.auxiliaryIngredients.every(isObject));

  const mainIngredients = hasSplit ? mainFromKeys : legacyFlat;
  const auxiliaryIngredients = hasSplit ? auxFromKeys : [];

  const steps =
    Array.isArray(raw.steps) && raw.steps.every(isObject)
      ? raw.steps
          .map((s, idx) => ({
            order: idx + 1,
            content: String(s.content ?? "").trim(),
            tip: s.tip ? String(s.tip).trim() : undefined,
          }))
          .filter((s) => s.content.length > 0)
      : [];

  if (steps.length === 0) issues.push("至少需要 1 个步骤 steps");

  const images = asStringArray(raw.images);

  const recipe: RecipeInput = {
    name,
    category,
    rating: Number.isFinite(rating) ? Math.max(0, Math.min(5, Math.round(rating))) : 0,
    difficulty,
    tags,
    description,
    mainIngredients,
    auxiliaryIngredients,
    steps,
    images,
  };

  return { recipe, issues };
}

export function ImportClient() {
  const [jsonText, setJsonText] = React.useState<string>(
    `{\n  "recipes": [\n    {\n      "name": "番茄炒蛋",\n      "category": "家常菜",\n      "rating": 5,\n      "tags": ["快手"],\n      "description": "酸甜开胃，下饭。",\n      "mainIngredients": [{ "name": "鸡蛋", "amount": "2个" }, { "name": "番茄", "amount": "2个" }],\n      "auxiliaryIngredients": [{ "name": "盐", "amount": "少许" }, { "name": "糖", "amount": "少许" }],\n      "steps": [{ "content": "鸡蛋打散炒熟盛出。" }, { "content": "番茄炒出汁，回锅鸡蛋翻匀。" }],\n      "images": ["image-1.jpg"]\n    }\n  ]\n}\n`,
  );

  const [files, setFiles] = React.useState<File[]>([]);
  const [fileMap, setFileMap] = React.useState<Record<string, string>>({});
  const [drafts, setDrafts] = React.useState<ImportDraft[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [doneMsg, setDoneMsg] = React.useState<string | null>(null);

  const MAX_FILES = 500;

  const onPickFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy(true);
    setError(null);
    setDoneMsg(null);
    try {
      const picked = Array.from(list).filter((f) => f.type.startsWith("image/"));
      const urls = await Promise.all(picked.map(async (f) => [f.name, await fileToDataUrl(f)] as const));
      const nextMap: Record<string, string> = {};
      for (const [name, url] of urls) nextMap[name] = url;
      setFiles((prev) => [...picked, ...prev].slice(0, MAX_FILES));
      setFileMap((prev) => ({ ...nextMap, ...prev }));
    } catch {
      setError("读取图片失败，请重试。");
    } finally {
      setBusy(false);
    }
  };

  const parse = () => {
    setError(null);
    setDoneMsg(null);

    const parsed = safeJsonParse(jsonText);
    if (!parsed || !isObject(parsed)) {
      setError("JSON 格式不正确。");
      return;
    }

    const rawRecipes = (parsed as Record<string, unknown>).recipes;
    if (!Array.isArray(rawRecipes)) {
      setError("JSON 里需要包含 recipes 数组。");
      return;
    }

    const nextDrafts: ImportDraft[] = rawRecipes
      .filter(isObject)
      .map((r) => normalizeDraft(r as Record<string, unknown>))
      .map((d) => {
        const images = (d.recipe.images ?? []).map((nameOrUrl) => {
          const match = fileMap[nameOrUrl];
          return match ?? nameOrUrl;
        });
        return { ...d, recipe: { ...d.recipe, images } };
      });

    setDrafts(nextDrafts);
  };

  const apply = async () => {
    setError(null);
    setDoneMsg(null);
    if (drafts.length === 0) {
      setError("请先解析 JSON。");
      return;
    }

    const blocking = drafts.filter((d) => d.issues.length > 0);
    if (blocking.length > 0) {
      setError(`有 ${blocking.length} 条数据存在问题，请先修正后再导入。`);
      return;
    }

    setBusy(true);
    try {
      const inputs = drafts.map((d) => d.recipe);
      await RecipeRepository.upsertMany(inputs);
      setDoneMsg(`已导入 ${inputs.length} 道菜谱。`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败，请重试。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-[var(--font-noto-serif-sc)] text-[26px] tracking-wide">
          批量导入
        </h1>
        <p className="text-[13px] leading-6 text-[color:var(--muted)]">
          先上传图片（可选），再粘贴 JSON。JSON 里的 images 里写文件名（如 image-1.jpg），会自动匹配上传的同名图片。
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-[color:rgba(201,138,99,0.35)] bg-[color:rgba(201,138,99,0.10)] px-4 py-3 text-[13px]">
          {error}
        </div>
      ) : null}
      {doneMsg ? (
        <div className="rounded-2xl border border-[color:rgba(107,142,107,0.35)] bg-[color:rgba(107,142,107,0.10)] px-4 py-3 text-[13px]">
          {doneMsg}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper)] p-6">
          <div className="flex items-center justify-between gap-4">
            <Badge tone="muted">图片（可选）</Badge>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[color:var(--line)] px-3 py-2 text-[13px] text-[color:var(--muted)] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]">
              选择多张
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => onPickFiles(e.target.files)}
              />
            </label>
          </div>

          <div className="mt-4">
            <div className="text-[12px] text-[color:var(--muted-2)]">
              已选择 {files.length} 张
            </div>
            {files.length ? (
              <div className="mt-3 grid grid-cols-3 gap-3">
                {files.slice(0, 9).map((f) => (
                  <div
                    key={f.name}
                    className="rounded-2xl border border-[color:var(--line)] bg-black/[0.03] p-2 text-[12px] text-[color:var(--muted)] dark:bg-white/[0.05]"
                    title={f.name}
                  >
                    <div className="truncate">{f.name}</div>
                    <div className="mt-1 text-[11px] text-[color:var(--muted-2)]">
                      {(f.size / 1024).toFixed(0)} KB
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper)] p-6">
          <div className="flex items-center justify-between gap-4">
            <Badge tone="muted">JSON</Badge>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={parse} disabled={busy}>
                解析 + 预览
              </Button>
              <Button size="sm" onClick={apply} disabled={busy}>
                导入
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="text-[12px] text-[color:var(--muted)]">
              你可以在本地编辑好 JSON 后粘贴到这里
            </div>
            <Textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="min-h-[280px] font-mono text-[12px]"
            />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-[12px] text-[color:var(--muted)]">快速检查</div>
              <Input readOnly value={`recipes: ${drafts.length}`} />
            </div>
            <div className="space-y-2">
              <div className="text-[12px] text-[color:var(--muted)]">问题条数</div>
              <Input
                readOnly
                value={`${drafts.filter((d) => d.issues.length > 0).length}`}
              />
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper)] p-6">
        <div className="flex items-center justify-between gap-4">
          <Badge tone="muted">预览</Badge>
          <span className="text-[12px] text-[color:var(--muted-2)]">
            {drafts.length ? "导入前确认一下" : "解析后显示"}
          </span>
        </div>

        {drafts.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {drafts.map((d, idx) => (
              <div
                key={idx}
                className="rounded-3xl border border-[color:var(--line)] bg-black/[0.01] p-5 dark:bg-white/[0.03]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-[var(--font-noto-serif-sc)] text-[18px] tracking-wide">
                      {d.recipe.name || "（未命名）"}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone="accent">{d.recipe.category || "（未分类）"}</Badge>
                      {d.recipe.tags?.slice(0, 2).map((t) => (
                        <Badge key={t} tone="muted">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-[12px] text-[color:var(--muted-2)]">
                    {d.recipe.rating ? `${d.recipe.rating}/5` : "—"}
                  </div>
                </div>

                {d.issues.length ? (
                  <div className="mt-4 rounded-2xl border border-[color:rgba(201,138,99,0.35)] bg-[color:rgba(201,138,99,0.10)] px-3 py-2 text-[12px] leading-6">
                    {d.issues.map((x) => (
                      <div key={x}>- {x}</div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 text-[12px] text-[color:var(--muted-2)]">
                    用料{" "}
                    {(d.recipe.mainIngredients?.length ?? 0) + (d.recipe.auxiliaryIngredients?.length ?? 0)} ·
                    步骤 {d.recipe.steps?.length ?? 0} · 图片{" "}
                    {d.recipe.images?.length ?? 0}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-[13px] text-[color:var(--muted-2)]">
            点击「解析 + 预览」后，这里会显示每道菜谱的导入摘要与问题提示。
          </p>
        )}
      </section>
    </div>
  );
}


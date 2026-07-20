"use client";

import * as React from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { useRecipes } from "@/lib/recipes/useRecipes";
import { Recipe, RecipeInput } from "@/lib/recipes/types";
import { RecipeRepository } from "@/lib/recipes/repository";

type ImportDraft = {
  recipe: RecipeInput;
  issues: string[];
};

type RecipeBackup = {
  app: "private-kitchen";
  version: 1;
  exportedAt: string;
  recipeCount: number;
  recipes: Recipe[];
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

function formatDateSlug(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function downloadTextFile(filename: string, content: string, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildBackup(recipes: Recipe[]): RecipeBackup {
  return {
    app: "private-kitchen",
    version: 1,
    exportedAt: new Date().toISOString(),
    recipeCount: recipes.length,
    recipes,
  };
}

async function shareOrDownloadBackup(payload: RecipeBackup): Promise<"shared" | "downloaded"> {
  const filename = `private-kitchen-backup-${formatDateSlug()}.json`;
  const content = JSON.stringify(payload, null, 2);
  const blob = new Blob([content], { type: "application/json" });

  if (typeof File !== "undefined" && navigator.canShare && navigator.share) {
    const file = new File([blob], filename, { type: "application/json" });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "私人厨房菜谱备份",
        text: `${payload.recipeCount} 道私房菜谱备份`,
        files: [file],
      });
      return "shared";
    }
  }

  downloadTextFile(filename, content);
  return "downloaded";
}

export function ImportClient() {
  const { recipes, hydrated, refresh } = useRecipes();
  const [jsonText, setJsonText] = React.useState<string>(
    `{\n  "recipes": [\n    {\n      "name": "番茄炒蛋",\n      "category": "家常菜",\n      "rating": 5,\n      "tags": ["快手"],\n      "description": "酸甜开胃，下饭。",\n      "mainIngredients": [{ "name": "鸡蛋", "amount": "2个" }, { "name": "番茄", "amount": "2个" }],\n      "auxiliaryIngredients": [{ "name": "盐", "amount": "少许" }, { "name": "糖", "amount": "少许" }],\n      "steps": [{ "content": "鸡蛋打散炒熟盛出。" }, { "content": "番茄炒出汁，回锅鸡蛋翻匀。" }],\n      "images": ["image-1.jpg"]\n    }\n  ]\n}\n`,
  );

  const [files, setFiles] = React.useState<File[]>([]);
  const [fileMap, setFileMap] = React.useState<Record<string, string>>({});
  const [drafts, setDrafts] = React.useState<ImportDraft[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [doneMsg, setDoneMsg] = React.useState<string | null>(null);
  const [backupMsg, setBackupMsg] = React.useState<string | null>(null);

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
    setBackupMsg(null);

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
    setBackupMsg(null);
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
      await refresh();
      setDoneMsg(`已导入 ${inputs.length} 道菜谱。`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败，请重试。");
    } finally {
      setBusy(false);
    }
  };

  const exportBackup = async () => {
    setError(null);
    setDoneMsg(null);
    setBackupMsg(null);
    setBusy(true);
    try {
      const allRecipes = await RecipeRepository.exportAll();
      const result = await shareOrDownloadBackup(buildBackup(allRecipes));
      setBackupMsg(
        result === "shared"
          ? `已唤起系统分享，正在交接 ${allRecipes.length} 道菜谱备份。`
          : `已导出 ${allRecipes.length} 道菜谱，文件可用于换机或长期备份。`,
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setBackupMsg("已取消分享，菜谱数据没有离开这台设备。");
      } else {
        setError(e instanceof Error ? e.message : "导出失败，请重试。");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="pk-section-label">批量收录</div>
        <h1 className="pk-serif text-[28px] tracking-wide">
          批量导入
        </h1>
        <p className="text-[13px] leading-6 text-[color:var(--muted)]">
          先上传图片（可选），再粘贴 JSON。JSON 里的 images 里写文件名（如 image-1.jpg），会自动匹配上传的同名图片。
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-[color:rgba(201,138,99,0.35)] bg-[color:rgba(201,138,99,0.10)] px-4 py-3 text-[13px]">
          {error}
        </div>
      ) : null}
      {doneMsg ? (
        <div className="rounded-lg border border-[color:rgba(107,142,107,0.35)] bg-[color:rgba(107,142,107,0.10)] px-4 py-3 text-[13px]">
          {doneMsg}
        </div>
      ) : null}
      {backupMsg ? (
        <div className="rounded-lg border border-[color:rgba(107,142,107,0.35)] bg-[color:rgba(107,142,107,0.10)] px-4 py-3 text-[13px]">
          {backupMsg}
        </div>
      ) : null}

      <section className="pk-panel overflow-hidden p-5 sm:p-6">
        <div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr] md:items-end">
          <div className="space-y-4">
            <Badge tone="accent">本地备份</Badge>
            <div>
              <h2 className="pk-serif text-[24px] tracking-wide">
                数据管家
              </h2>
              <p className="mt-2 max-w-[34rem] text-[13px] leading-6 text-[color:var(--muted)]">
                生成一份完整 JSON 备份，包含菜名、分类、评分、食材、步骤与图片引用。数据只在这台设备上读取和下载。
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["菜谱", hydrated ? recipes.length : "-"],
                ["格式", "JSON"],
                ["位置", "本机"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-[color:var(--menu-line-soft)] bg-[color:var(--paper)]/68 px-3 py-3"
                >
                  <div className="text-[11px] text-[color:var(--muted-2)]">{label}</div>
                  <div className="pk-serif mt-1 text-[18px] tracking-wide">{value}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-[color:var(--menu-line-soft)] bg-[color:var(--paper-strong)]/72 p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.38)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[12px] text-[color:var(--muted-2)]">建议频率</div>
                <div className="mt-1 text-[15px] font-medium">每次大批量更新后导出一次</div>
              </div>
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[color:var(--menu-line)] text-[18px]">
                ↓
              </div>
            </div>
            <Button
              className="mt-4 w-full"
              onClick={exportBackup}
              disabled={busy || !hydrated}
            >
              导出整库备份
            </Button>
            <p className="mt-3 text-[12px] leading-5 text-[color:var(--muted-2)]">
              这份文件可以放进 iCloud、网盘或电脑文件夹里，后续迁移到小程序时也能作为基础数据源。
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="pk-panel-plain p-5 sm:p-6">
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
                    className="rounded-lg border border-[color:var(--line)] bg-[color:var(--paper-strong)]/70 p-2 text-[12px] text-[color:var(--muted)]"
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

        <section className="pk-panel-plain p-5 sm:p-6">
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

      <section className="pk-panel-plain p-5 sm:p-6">
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
                className="rounded-lg border border-[color:var(--line)] bg-[color:var(--paper-strong)]/70 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="pk-serif truncate text-[18px] tracking-wide">
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
                  <div className="mt-4 rounded-lg border border-[color:rgba(201,138,99,0.35)] bg-[color:rgba(201,138,99,0.10)] px-3 py-2 text-[12px] leading-6">
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

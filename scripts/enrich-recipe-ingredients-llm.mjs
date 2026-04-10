import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { Agent, setGlobalDispatcher } from "undici";

// Usage:
//   OPENAI_API_KEY=... node scripts/enrich-recipe-ingredients-llm.mjs
//   node scripts/enrich-recipe-ingredients-llm.mjs --force
//   node scripts/enrich-recipe-ingredients-llm.mjs --retry-failed
//
// Writes generated/recipes.json; checkpoint: generated/recipes.ingredients.checkpoint.json
// API 与 enrich-recipe-descriptions-llm.mjs 一致（默认 MiniMax Anthropic 兼容端点）

const ROOT = process.cwd();
const INPUT = path.join(ROOT, "generated", "recipes.json");
// v2：主料/辅料分两组，与旧 checkpoint 不兼容
const CHECKPOINT = path.join(ROOT, "generated", "recipes.ingredients.v2.checkpoint.json");

dotenv.config({ path: path.join(ROOT, ".env.local") });

function getEnv(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : undefined;
}

function isTruthyEnv(v) {
  if (!v) return false;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

if (isTruthyEnv(getEnv("OPENAI_INSECURE_TLS"))) {
  setGlobalDispatcher(new Agent({ connect: { rejectUnauthorized: false } }));
}

const apiKey = getEnv("OPENAI_API_KEY");
if (!apiKey) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}
const baseUrl = (getEnv("OPENAI_BASE_URL") ?? "https://api.minimaxi.com/anthropic").replace(/\/$/, "");
const model = getEnv("OPENAI_MODEL") ?? "MiniMax-M2.7";
const isAnthropic = baseUrl.includes("/anthropic");
const FORCE = process.argv.includes("--force");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractJsonObject(text) {
  const s = String(text ?? "");
  const start = s.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (ch === "\\") {
        esc = true;
      } else if (ch === '"') {
        inStr = false;
      }
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0) {
      return safeJsonParse(s.slice(start, i + 1));
    }
  }
  return null;
}

function namedCount(rows) {
  if (!Array.isArray(rows)) return 0;
  return rows.filter((x) => String(x?.name ?? "").trim()).length;
}

/** 已由模型拆成「主料 + 辅料」两组且数量合理 */
function hasValidModelSplit(r) {
  if (!Array.isArray(r.mainIngredients) || !Array.isArray(r.auxiliaryIngredients)) return false;
  if (namedCount(r.mainIngredients) < 2) return false;
  if (namedCount(r.auxiliaryIngredients) < 1) return false;
  return true;
}

function isMissingIngredients(r) {
  if (hasValidModelSplit(r)) return false;
  return true;
}

function normalizeIngredients(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((x) => x && typeof x === "object")
    .map((x) => ({
      name: String(x.name ?? "").trim(),
      amount: String(x.amount ?? "").trim(),
      note: x.note != null && String(x.note).trim() ? String(x.note).trim() : undefined,
    }))
    .filter((x) => x.name || x.amount);
}

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT)) return { done: {} };
  const raw = fs.readFileSync(CHECKPOINT, "utf8");
  return safeJsonParse(raw) ?? { done: {} };
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify(cp, null, 2) + "\n", "utf8");
}

async function llmIngredientsBatch(items) {
  const compact = items.map((x) => ({
    name: x.name,
    category: x.category ?? "",
    description: String(x.description ?? "").slice(0, 160),
    tags: Array.isArray(x.tags) ? x.tags.slice(0, 6).map(String) : [],
  }));

  const system = [
    "你是中式家常菜用料助手。根据菜名、类别与简介推断常见家庭做法的用料，并拆成两组。",
    "只输出合法 JSON，不能包含 Markdown、不能包含多余解释文字。",
    "mainIngredients：主要食材（占菜量主体的肉禽蛋水产、蔬菜豆谷、豆腐菌菇、米面主食原料等）。",
    "auxiliaryIngredients：辅料——油盐糖醋酱、生抽、老抽、蚝油、料酒、淀粉、香料、花椒八角等干料，以及葱姜蒜等作料头；生抽、老抽、盐、糖、淀粉一律放在辅料。",
    "两组都用数组；每项含 name、amount（如「约300g」「1小勺」「少许」）、note（可选）。同一食材不得重复出现在两组。",
    "主料至少 2 项有名称；辅料至少 1 项有名称。总量按 2～4 人份估算。",
    "输出顶层 items，与输入顺序一一对应；每项含 name（菜名与输入一致）、mainIngredients、auxiliaryIngredients。",
  ].join("");

  const user = [
    "请为下面每一道菜写出 mainIngredients 与 auxiliaryIngredients。",
    "必须只返回如下结构的 JSON：",
    '{ "items": [ { "name": "菜名", "mainIngredients": [ { "name": "", "amount": "", "note": "" } ], "auxiliaryIngredients": [ { "name": "", "amount": "", "note": "" } ] } ] }',
    "",
    "输入：",
    JSON.stringify({ items: compact }, null, 0),
  ].join("\n");

  const url = isAnthropic ? `${baseUrl}/v1/messages` : `${baseUrl}/chat/completions`;
  const body = isAnthropic
    ? {
        model,
        max_tokens: 8192,
        temperature: 0.15,
        system,
        messages: [{ role: "user", content: [{ type: "text", text: user }] }],
      }
    : {
        model,
        temperature: 0.15,
        max_tokens: 8192,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      };

  const headers = isAnthropic
    ? {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      }
    : {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6 * 60 * 1000);
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  const raw = await resp.text();
  if (!resp.ok) {
    throw new Error(`LLM failed ${resp.status}: ${raw.slice(0, 400)}`);
  }

  const parsed = safeJsonParse(raw);
  const content = isAnthropic
    ? String(
        Array.isArray(parsed?.content)
          ? parsed.content
              .filter((b) => b?.type === "text")
              .map((b) => b?.text ?? "")
              .join("\n")
          : "",
      )
    : String(parsed?.choices?.[0]?.message?.content ?? parsed?.choices?.[0]?.text ?? "");

  const obj = safeJsonParse(content) ?? extractJsonObject(content);
  if (!obj) throw new Error("LLM returned non-JSON");
  return obj;
}

const data = safeJsonParse(fs.readFileSync(INPUT, "utf8"));
if (!data?.recipes || !Array.isArray(data.recipes)) {
  console.error("Invalid recipes.json");
  process.exit(1);
}

const recipes = data.recipes;
const cp = loadCheckpoint();
cp.done = cp.done ?? {};
if (FORCE) cp.done = {};

const targets = recipes
  .map((r, idx) => ({ r, idx }))
  .filter(({ r }) => (FORCE ? true : isMissingIngredients(r)));

console.log(`ingredient targets: ${targets.length}/${recipes.length} ${FORCE ? "(force)" : ""}`);

let processed = 0;
const CHUNK = 5;

for (let offset = 0; offset < targets.length; offset += CHUNK) {
  const slice = targets.slice(offset, offset + CHUNK);
  const keys = slice.map(({ idx, r }) => `${idx}:${r.name}`);

  const pendingKeys = keys.filter((k) => cp.done[k]?.ok !== true);
  if (!pendingKeys.length) continue;

  const pendingSet = new Set(pendingKeys);
  const sliceToRun = slice.filter(({ idx, r }) => pendingSet.has(`${idx}:${r.name}`));

  const items = sliceToRun.map(({ r }) => ({
    name: String(r.name ?? "").trim(),
    category: String(r.category ?? "").trim(),
    description: String(r.description ?? "").trim(),
    tags: Array.isArray(r.tags) ? r.tags : [],
  }));
  if (items.some((x) => !x.name)) {
    for (let i = 0; i < sliceToRun.length; i++) {
      const k = `${sliceToRun[i].idx}:${sliceToRun[i].r.name}`;
      cp.done[k] = { ok: false, error: "empty name" };
    }
    saveCheckpoint(cp);
    continue;
  }

  try {
    let out = null;
    let lastErr = null;
    for (let attempt = 1; attempt <= 8; attempt++) {
      try {
        out = await llmIngredientsBatch(items);
        break;
      } catch (e) {
        lastErr = e;
        await sleep(1200 * 2 ** (attempt - 1));
      }
    }
    if (!out) throw lastErr ?? new Error("LLM failed");

    const rows = Array.isArray(out?.items) ? out.items : [];
    const byName = new Map(rows.map((x) => [String(x?.name ?? "").trim(), x]));

    for (let i = 0; i < sliceToRun.length; i++) {
      const { r, idx } = sliceToRun[i];
      const key = `${idx}:${r.name}`;
      const row = byName.get(String(r.name ?? "").trim());
      if (!row) {
        cp.done[key] = { ok: false, error: "missing item in batch output" };
        continue;
      }
      const main = normalizeIngredients(row?.mainIngredients);
      const aux = normalizeIngredients(row?.auxiliaryIngredients);
      if (namedCount(main) < 2) {
        cp.done[key] = { ok: false, error: "too few mainIngredients" };
        continue;
      }
      if (namedCount(aux) < 1) {
        cp.done[key] = { ok: false, error: "too few auxiliaryIngredients" };
        continue;
      }
      delete r.ingredients;
      r.mainIngredients = main;
      r.auxiliaryIngredients = aux;
      cp.done[key] = { ok: true };
      processed++;
    }
  } catch (e) {
    for (const k of keys) {
      if (pendingSet.has(k)) {
        cp.done[k] = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
  }

  fs.writeFileSync(INPUT, JSON.stringify({ ...data, recipes }, null, 2) + "\n", "utf8");
  saveCheckpoint(cp);
  console.log(`progress: ${processed} ok (batch offset ${offset}/${targets.length})`);

  await sleep(1000);
}

fs.writeFileSync(INPUT, JSON.stringify({ ...data, recipes }, null, 2) + "\n", "utf8");
saveCheckpoint(cp);
console.log("done");

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { Agent, setGlobalDispatcher } from "undici";

// Usage:
//   OPENAI_API_KEY=... OPENAI_BASE_URL=... OPENAI_MODEL=... node scripts/enrich-recipe-descriptions-llm.mjs
//
// Writes back to generated/recipes.json, with checkpoint file generated/recipes.descriptions.checkpoint.json

const ROOT = process.cwd();
const INPUT = path.join(ROOT, "generated", "recipes.json");
const CHECKPOINT = path.join(ROOT, "generated", "recipes.descriptions.checkpoint.json");

// Load local secrets if present
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

// Allow insecure TLS ONLY via env flag (same as API route behavior)
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
const RETRY_FAILED = process.argv.includes("--retry-failed") || FORCE;

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
  // Try to extract the first balanced {...} object, robust to extra text.
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
      } else if (ch === "\\\\") {
        esc = true;
      } else if (ch === "\"") {
        inStr = false;
      }
      continue;
    }
    if (ch === "\"") {
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

function isGenericDescription(desc) {
  const s = String(desc ?? "").trim();
  if (!s) return true;
  if (s === "按常规做法处理食材并烹饪至熟。") return true;
  if (s.includes("后续可补充")) return true;
  return false;
}

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT)) return { done: {} };
  const raw = fs.readFileSync(CHECKPOINT, "utf8");
  return safeJsonParse(raw) ?? { done: {} };
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify(cp, null, 2) + "\n", "utf8");
}

async function llmDescribeBatch(items) {
  // items: Array<{ name, category }>
  const compact = items.map((x) => ({ name: x.name, category: x.category ?? "" }));
  const system = [
    "你是一个私人厨房 App 的料理文案助手。",
    "必须只返回合法 JSON，不能包含 Markdown、不能包含多余文本。",
    "文案要求：简体中文，语气克制、安静、无表情符号；不要像菜谱步骤；不要泛泛而谈。",
    "必须避免套话/口癖（严禁出现或近似这些表达）：「一碗热汤」「慢慢回温」「热热上桌」「简单踏实耐吃」「做法不复杂但很耐吃」「一口下去就很踏实」「很适合放进常做清单」「没什么花哨」「越吃越顺口」「让人舒坦」「刚好」「很适合」「味道收得干净利落」「整体很家常」。",
    "同一批次里尽量不要复用同一个句式开头（例如不要连续以“这道菜…”开头）。",
    "输出字段：description（1句，尽量具体到口感/味型/关键食材线索），highlights（2-3个短词），tags（2-3个短词）。",
  ].join("");

  const user = [
    "请为下面每一道菜各写一条“像真人评价”的文案。",
    "要求：description 必须点到“口感/味型/关键食材线索”至少其一；不要写“热汤回温/踏实耐吃/没什么花哨”等套话。",
    "每道菜输出 description（1句），highlights（2-3个短词），tags（2-3个短词）。",
    "必须只返回合法 JSON，不能包含 Markdown、不能包含多余文本。",
    "",
    "只返回如下格式（items 与输入顺序一一对应）：",
    '{ "items": [ { "name": "...", "description": "...", "highlights": ["..."], "tags": ["..."] } ] }',
    "",
    "输入：",
    JSON.stringify({ items: compact }, null, 0),
  ].join("\n");

  const url = isAnthropic ? `${baseUrl}/v1/messages` : `${baseUrl}/chat/completions`;
  const body = isAnthropic
    ? {
        model,
        max_tokens: 2600,
        temperature: 0.1,
        system,
        messages: [{ role: "user", content: [{ type: "text", text: user }] }],
      }
    : {
        model,
        temperature: 0.1,
        max_tokens: 2600,
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
  // Large batches can be slow; allow up to 4 minutes
  const timeout = setTimeout(() => controller.abort(), 4 * 60 * 1000);
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  const raw = await resp.text();
  if (!resp.ok) {
    throw new Error(`LLM failed ${resp.status}: ${raw.slice(0, 200)}`);
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
// In force mode, we want a true full rerun: ignore any previous checkpoint.
if (FORCE) cp.done = {};

const targets = recipes
  .map((r, idx) => ({ r, idx }))
  .filter(({ r }) => (FORCE ? true : isGenericDescription(r.description)));

console.log(`targets: ${targets.length}/${recipes.length} ${FORCE ? "(force)" : ""}`);

let processed = 0;
const CHUNK = 6;
for (let offset = 0; offset < targets.length; offset += CHUNK) {
  const slice = targets.slice(offset, offset + CHUNK);
  const keys = slice.map(({ idx, r }) => `${idx}:${r.name}`);
  const allDone = keys.every((k) => cp.done[k]?.ok === true);
  if (allDone) continue;

  const items = slice.map(({ r }) => ({
    name: String(r.name ?? "").trim(),
    category: String(r.category ?? "").trim(),
  }));
  if (items.some((x) => !x.name)) {
    for (let i = 0; i < items.length; i++) {
      if (!items[i].name) cp.done[keys[i]] = { ok: false, error: "empty name" };
    }
    continue;
  }

  try {
    let out = null;
    let lastErr = null;
    for (let attempt = 1; attempt <= 6; attempt++) {
      try {
        out = await llmDescribeBatch(items);
        break;
      } catch (e) {
        lastErr = e;
        // backoff: 1.2s, 2.4s, 4.8s...
        await sleep(1200 * 2 ** (attempt - 1));
      }
    }
    if (!out) throw (lastErr ?? new Error("LLM failed"));

    const rows = Array.isArray(out?.items) ? out.items : [];
    const byName = new Map(rows.map((x) => [String(x?.name ?? ""), x]));

    for (let i = 0; i < slice.length; i++) {
      const { r, idx } = slice[i];
      const key = `${idx}:${r.name}`;
      const row = byName.get(String(r.name ?? "").trim());
      if (!row) {
        cp.done[key] = { ok: false, error: "missing item in batch output" };
        continue;
      }
      const desc = String(row?.description ?? "").trim();
      const highlights = Array.isArray(row?.highlights) ? row.highlights.map(String) : [];
      const tags = Array.isArray(row?.tags) ? row.tags.map(String) : [];
      if (desc) r.description = desc;
      r.tags = Array.from(new Set([...(Array.isArray(r.tags) ? r.tags.map(String) : []), ...highlights, ...tags]))
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10);
      cp.done[key] = { ok: true };
      processed++;
    }
  } catch (e) {
    for (const k of keys) {
      cp.done[k] = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  fs.writeFileSync(INPUT, JSON.stringify({ ...data, recipes }, null, 2) + "\n", "utf8");
  saveCheckpoint(cp);
  console.log(`progress: ${processed}/${targets.length} (offset ${offset}/${targets.length})`);

  await sleep(900);
}

fs.writeFileSync(INPUT, JSON.stringify({ ...data, recipes }, null, 2) + "\n", "utf8");
saveCheckpoint(cp);
console.log("done");


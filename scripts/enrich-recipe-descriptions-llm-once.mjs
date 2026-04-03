import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { Agent, setGlobalDispatcher } from "undici";

// One-shot (or 2-shot fallback) description enrichment.
//
// Usage:
//   node scripts/enrich-recipe-descriptions-llm-once.mjs
//
// Notes:
// - Reads generated/recipes.json
// - Sends ALL recipes as one JSON input to the LLM
// - Expects one JSON output: { items: [{ name, description, tags }] }
// - Writes back description + merges tags
// - If the single request fails (timeout / truncated / non-JSON), automatically retries in 2 halves.

const ROOT = process.cwd();
const INPUT = path.join(ROOT, "generated", "recipes.json");

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
      if (esc) esc = false;
      else if (ch === "\\\\") esc = true;
      else if (ch === "\"") inStr = false;
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

function mergeTags(oldTags, newTags) {
  const a = Array.isArray(oldTags) ? oldTags.map(String) : [];
  const b = Array.isArray(newTags) ? newTags.map(String) : [];
  return Array.from(new Set([...a, ...b]))
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 10);
}

async function callOnce(inputItems) {
  const system = [
    "你是一个私人厨房 App 的料理文案助手。",
    "必须只返回合法 JSON，不能包含 Markdown、不能包含多余文本。",
    "每道菜输出 description（1句，尽量短、像真人评价，不要步骤），tags（2-4个短词）。",
    "不要编造具体克数、时间、品牌；可以基于菜名的常识推断口味与场景。",
  ].join("");

  const user = [
    "请为下列每一道菜生成文案。",
    "只返回 JSON，格式如下（items 数量必须与输入一致，顺序必须一致）：",
    '{ "items": [ { "name": "...", "description": "...", "tags": ["..."] } ] }',
    "",
    "输入：",
    JSON.stringify({ items: inputItems }, null, 0),
  ].join("\n");

  const url = isAnthropic ? `${baseUrl}/v1/messages` : `${baseUrl}/chat/completions`;
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

  const body = isAnthropic
    ? {
        model,
        max_tokens: 8000,
        temperature: 0.15,
        system,
        messages: [{ role: "user", content: [{ type: "text", text: user }] }],
      }
    : {
        model,
        max_tokens: 8000,
        temperature: 0.15,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      };

  const controller = new AbortController();
  const timeoutMs = 8 * 60 * 1000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  const raw = await resp.text();
  if (!resp.ok) {
    throw new Error(`LLM failed ${resp.status}: ${raw.slice(0, 300)}`);
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

function validateOutput(out, expectedCount) {
  const items = Array.isArray(out?.items) ? out.items : null;
  if (!items) return { ok: false, error: "missing items" };
  if (items.length !== expectedCount) return { ok: false, error: `items length ${items.length} != ${expectedCount}` };
  for (const it of items) {
    if (typeof it?.name !== "string") return { ok: false, error: "item missing name" };
    if (typeof it?.description !== "string") return { ok: false, error: "item missing description" };
  }
  return { ok: true, items };
}

const data = safeJsonParse(fs.readFileSync(INPUT, "utf8"));
if (!data?.recipes || !Array.isArray(data.recipes)) {
  console.error("Invalid recipes.json");
  process.exit(1);
}

const recipes = data.recipes;
const inputItems = recipes.map((r) => ({
  name: String(r.name ?? "").trim(),
  category: String(r.category ?? "").trim(),
}));

async function runAllOnceOrSplit() {
  console.log(`recipes: ${recipes.length}`);
  try {
    const out = await callOnce(inputItems);
    const v = validateOutput(out, inputItems.length);
    if (!v.ok) throw new Error(v.error);
    return v.items;
  } catch (e) {
    console.warn(`one-shot failed: ${e instanceof Error ? e.message : String(e)}`);
    console.warn("retrying in 2 halves...");
    const mid = Math.floor(inputItems.length / 2);
    const leftIn = inputItems.slice(0, mid);
    const rightIn = inputItems.slice(mid);

    const leftOut = await callOnce(leftIn);
    const lv = validateOutput(leftOut, leftIn.length);
    if (!lv.ok) throw new Error(`left half failed: ${lv.error}`);

    const rightOut = await callOnce(rightIn);
    const rv = validateOutput(rightOut, rightIn.length);
    if (!rv.ok) throw new Error(`right half failed: ${rv.error}`);

    return [...lv.items, ...rv.items];
  }
}

const items = await runAllOnceOrSplit();

for (let i = 0; i < recipes.length; i++) {
  const r = recipes[i];
  const it = items[i];
  if (!it) continue;
  // ensure name matches the same index; if not, still write by index to honor "same order"
  const desc = String(it.description ?? "").trim();
  if (desc) r.description = desc;
  r.tags = mergeTags(r.tags, it.tags);
}

fs.writeFileSync(INPUT, JSON.stringify({ ...data, recipes }, null, 2) + "\n", "utf8");
console.log("updated generated/recipes.json");


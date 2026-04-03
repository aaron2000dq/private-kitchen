import { NextResponse } from "next/server";
import { Agent } from "undici";
import { seasonHintForPrompt } from "@/lib/recommendation/seasonal";

type RecommendRequest = {
  date?: string;
  recipes?: Array<{
    id: string;
    name: string;
    category: string;
    rating?: number;
    tags?: string[];
  }>;
};

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

function getEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function isTruthyEnv(v: string | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function getDispatcher() {
  // Some environments (corporate proxies / MITM) break TLS chain verification.
  // Allow opting into insecure TLS ONLY via env flag.
  if (!isTruthyEnv(getEnv("OPENAI_INSECURE_TLS"))) return undefined;
  return new Agent({ connect: { rejectUnauthorized: false } });
}

function extractJsonObject(text: string): unknown | null {
  // Try best-effort extraction of a single JSON object from arbitrary text.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const apiKey = getEnv("OPENAI_API_KEY");
    if (!apiKey) {
      return json(
        {
          error:
            "Missing OPENAI_API_KEY. Please set it in environment variables (server-side only).",
        },
        { status: 500 },
      );
    }

    // Defaults: MiniMax Anthropic-compatible gateway (works with many MiniMax keys).
    // You can override via environment variables.
    const baseUrl = getEnv("OPENAI_BASE_URL") ?? "https://api.minimaxi.com/anthropic";
    const model = getEnv("OPENAI_MODEL") ?? "MiniMax-M2.7";
    const dispatcher = getDispatcher();

    let body: RecommendRequest | null = null;
    try {
      body = (await req.json()) as RecommendRequest;
    } catch {
      body = null;
    }

    const date = body?.date ?? new Date().toISOString().slice(0, 10);
    const recipes = Array.isArray(body?.recipes) ? body?.recipes : [];

    // Deterministic fallback when no recipes exist.
    if (recipes.length === 0) {
      return json({
        recommendedRecipeIds: [],
        reason: "你还没有添加菜谱。先新增几道拿手菜，我再为你做搭配推荐。",
      });
    }

    const system = [
      "你是一个私人厨房 App 的料理助手。",
      "必须只返回合法 JSON，不能包含 Markdown、不能包含多余文本。",
      "reason 必须为简体中文，语气克制、安静、无表情符号。",
    ].join("");

    const seasonalLine = seasonHintForPrompt(new Date(date + "T12:00:00"));
    const user = [
      `今天日期：${date}。`,
      seasonalLine,
      "请从我的菜谱库里推荐恰好 3 道菜作为今天的组合（若菜谱总数不足 3，则返回能选出的最多数量并在 reason 说明）。",
      "要求：强结合当日节气、季节与当季常见食材来选菜；理由里要点出时令依据。",
      "尽量覆盖不同类别/做法（汤/主食/蔬菜/肉或海鲜等，在菜谱允许的前提下）。",
      "",
      "只返回 JSON，格式如下：",
      '{ "recommendedRecipeIds": ["..."], "reason": "..." }',
      "",
      "菜谱库（只是一份摘要）：",
      JSON.stringify(
        recipes.map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
          rating: r.rating ?? 0,
          tags: r.tags ?? [],
        })),
      ),
    ].join("\n");

    const base = baseUrl.replace(/\/$/, "");
    const isAnthropic = base.includes("/anthropic");

    const resp = isAnthropic
      ? await fetch(`${base}/v1/messages`, {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          ...(dispatcher ? ({ dispatcher } as any) : {}),
          body: JSON.stringify({
            model,
            max_tokens: 1200,
            temperature: 0.7,
            system,
            messages: [
              {
                role: "user",
                content: [{ type: "text", text: user }],
              },
            ],
          }),
        })
      : await fetch(`${base}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          ...(dispatcher ? ({ dispatcher } as any) : {}),
          body: JSON.stringify({
            model,
            temperature: 0.7,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
          }),
        });

    const raw = await resp.text();
    if (!resp.ok) {
      return json(
        {
          error: "LLM request failed",
          status: resp.status,
          details: raw.slice(0, 1200),
        },
        { status: 502 },
      );
    }

    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }

    const content: string = isAnthropic
      ? String(
          Array.isArray(data?.content)
            ? data.content
                .filter((b: any) => b?.type === "text")
                .map((b: any) => b?.text ?? "")
                .join("\n")
            : "",
        )
      : String(data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? "");

    const parsed =
      (() => {
        try {
          return JSON.parse(content);
        } catch {
          return extractJsonObject(content);
        }
      })() as any;

    const ids: string[] = Array.isArray(parsed?.recommendedRecipeIds)
      ? parsed.recommendedRecipeIds.map(String)
      : [];

    const reason =
      typeof parsed?.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim()
        : "为你挑了几道更适合今天的组合。";

    // Filter to existing ids, keep order.
    const existing = new Set(recipes.map((r) => r.id));
    const cleaned = ids.filter((x) => existing.has(x)).slice(0, 3);

    return json({
      recommendedRecipeIds: cleaned,
      reason,
    });
  } catch (e) {
    return json(
      {
        error: "Recommend handler failed",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}


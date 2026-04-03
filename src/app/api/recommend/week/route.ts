import { NextResponse } from "next/server";
import { Agent } from "undici";
import { seasonHintForPrompt } from "@/lib/recommendation/seasonal";

type RecipeBrief = {
  id: string;
  name: string;
  category: string;
  rating?: number;
  tags?: string[];
};

type WeekRequest = {
  dates?: string[];
  recipes?: RecipeBrief[];
};

type DayOut = {
  date: string;
  recommendedRecipeIds: string[];
  reason: string;
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
  if (!isTruthyEnv(getEnv("OPENAI_INSECURE_TLS"))) return undefined;
  return new Agent({ connect: { rejectUnauthorized: false } });
}

function extractJsonObject(text: string): unknown | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function cleanDay(
  date: string,
  ids: unknown,
  reason: unknown,
  existing: Set<string>,
  max: number,
): DayOut {
  const arr = Array.isArray(ids) ? ids.map(String) : [];
  const cleaned = arr.filter((x) => existing.has(x)).slice(0, max);
  const r =
    typeof reason === "string" && reason.trim()
      ? reason.trim()
      : "结合当日时令，为你搭配了三道菜。";
  return { date, recommendedRecipeIds: cleaned, reason: r };
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

    const baseUrl = getEnv("OPENAI_BASE_URL") ?? "https://api.minimaxi.com/anthropic";
    const model = getEnv("OPENAI_MODEL") ?? "MiniMax-M2.7";
    const dispatcher = getDispatcher();

    let body: WeekRequest | null = null;
    try {
      body = (await req.json()) as WeekRequest;
    } catch {
      body = null;
    }

    const dates = Array.isArray(body?.dates) ? body!.dates!.map(String) : [];
    const recipes = Array.isArray(body?.recipes) ? body!.recipes! : [];
    const existing = new Set(recipes.map((r) => r.id));

    if (dates.length === 0) {
      return json({ error: "dates required" }, { status: 400 });
    }

    if (recipes.length === 0) {
      const empty: Record<string, DayOut> = {};
      for (const d of dates) {
        empty[d] = {
          date: d,
          recommendedRecipeIds: [],
          reason: "你还没有添加菜谱。先新增几道拿手菜，我再为你做搭配推荐。",
        };
      }
      return json({ days: empty });
    }

    const maxPerDay = Math.min(3, recipes.length);

    const system = [
      "你是一个私人厨房 App 的料理助手。",
      "必须只返回合法 JSON，不能包含 Markdown、不能包含多余文本。",
      "每一天的 reason 必须为简体中文，语气克制、安静、无表情符号。",
      "你必须严格结合该日期的节气、季节与当季常见食材来选菜并写理由。",
    ].join("");

    const dateLines = dates.map((d) => {
      const hint = seasonHintForPrompt(new Date(d + "T12:00:00"));
      return `- ${d}：${hint}`;
    });

    const user = [
      "请为下列每一个日期各推荐恰好 " + String(maxPerDay) + " 道菜（从菜谱 id 中选，不可重复于同一天内）。",
      "要求：强结合当日时令与节气（理由里要点出当季食材或饮食倾向）；三天尽量覆盖汤/主食/蔬菜/肉或海鲜等不同类型（在菜谱允许的前提下）。",
      "若菜谱总数不足 " + String(maxPerDay) + "，则该日只返回能选出的数量，并在 reason 里简短说明。",
      "",
      "日期与时令参考：",
      ...dateLines,
      "",
      "只返回 JSON，格式如下（days 数组长度必须与下列日期顺序一致）：",
      '{ "days": [ { "date": "YYYY-MM-DD", "recommendedRecipeIds": ["id1","id2","id3"], "reason": "..." } ] }',
      "",
      "日期顺序（须逐一输出）：",
      JSON.stringify(dates),
      "",
      "菜谱库摘要：",
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
            max_tokens: 8192,
            temperature: 0.55,
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
            temperature: 0.55,
            max_tokens: 8192,
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

    const daysArr: unknown[] = Array.isArray(parsed?.days) ? parsed.days : [];
    const byDateFromLlm = new Map<string, DayOut>();
    for (const row of daysArr) {
      const r = row as any;
      const dt = typeof r?.date === "string" ? r.date : "";
      if (!dt) continue;
      byDateFromLlm.set(
        dt,
        cleanDay(dt, r?.recommendedRecipeIds, r?.reason, existing, maxPerDay),
      );
    }

    const daysOut: Record<string, DayOut> = {};
    for (const d of dates) {
      const got = byDateFromLlm.get(d);
      if (got && got.recommendedRecipeIds.length > 0) {
        daysOut[d] = got;
      } else {
        daysOut[d] = {
          date: d,
          recommendedRecipeIds: [],
          reason: "本周推荐解析不完整，请稍后重试或检查网络。",
        };
      }
    }

    return json({ days: daysOut });
  } catch (e) {
    return json(
      {
        error: "Week recommend handler failed",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}

"use client";

import type { Recipe } from "@/lib/recipes/types";
import { recipeImageUrl } from "@/lib/recipes/recipeImageUrl";

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (img as any).decode?.();
    return img;
  } catch {
    return null;
  }
}

function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split("");
  const lines: string[] = [];
  let line = "";
  for (const ch of words) {
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function exportTodayCookbookToPng(selected: Recipe[], fileName = "today-cookbook.png") {
  const items = selected.slice(0, 10);
  const W = 1200;
  const H = items.length <= 3 ? 820 : 980;
  const margin = 54;
  const gap = 28;
  const cols = items.length <= 3 ? 3 : 5;
  const rows = items.length <= 3 ? 1 : 2;
  const cardW = (W - margin * 2 - gap * (cols - 1)) / cols;
  const cardH = items.length <= 3 ? 560 : 390;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // background
  ctx.fillStyle = "#F6F6F3";
  ctx.fillRect(0, 0, W, H);

  // header
  ctx.fillStyle = "#111";
  ctx.font = "700 56px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", sans-serif";
  ctx.fillText("今日菜谱", margin, 86);

  // pre-load images
  const images = await Promise.all(
    items.map(async (r) => (r.images?.[0] ? await loadImage(recipeImageUrl(r.images[0])) : null)),
  );

  const startY = 130;
  for (let i = 0; i < cols * rows; i++) {
    const r = items[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = margin + col * (cardW + gap);
    const y = startY + row * (cardH + gap);

    // card background
    ctx.fillStyle = "#FFFFFF";
    roundRectPath(ctx, x, y, cardW, cardH, 28);
    ctx.fill();

    // image area
    const pad = items.length <= 3 ? 26 : 18;
    const imgX = x + pad;
    const imgY = y + pad;
    const imgW = cardW - pad * 2;
    const imgH = items.length <= 3 ? 250 : 160;
    ctx.save();
    roundRectPath(ctx, imgX, imgY, imgW, imgH, 22);
    ctx.clip();
    ctx.fillStyle = "#EFEFEA";
    ctx.fillRect(imgX, imgY, imgW, imgH);

    const img = images[i] ?? null;
    if (img) {
      // cover
      const scale = Math.max(imgW / img.width, imgH / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const dx = imgX + (imgW - drawW) / 2;
      const dy = imgY + (imgH - drawH) / 2;
      ctx.drawImage(img, dx, dy, drawW, drawH);
    } else if (r) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.font = items.length <= 3 ? "600 28px ui-sans-serif, system-ui" : "600 20px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText("无图", imgX + imgW / 2, imgY + imgH / 2);
      ctx.textAlign = "left";
    }
    ctx.restore();

    // content
    ctx.fillStyle = "#111";
    ctx.font = items.length <= 3 ? "700 32px ui-sans-serif, system-ui" : "700 22px ui-sans-serif, system-ui";

    const title = r?.name ?? "（空位）";
    const lines = wrapTextLines(ctx, title, imgW);
    const titleLines = lines.slice(0, items.length <= 3 ? 2 : 1);
    const titleY = y + (items.length <= 3 ? 310 : 206);
    for (let li = 0; li < titleLines.length; li++) {
      ctx.fillText(titleLines[li]!, imgX, titleY + li * (items.length <= 3 ? 40 : 28));
    }

    ctx.fillStyle = "#666";
    ctx.font = items.length <= 3 ? "500 24px ui-sans-serif, system-ui" : "500 18px ui-sans-serif, system-ui";
    const meta = r
      ? `${r.category} · ${r.rating ? `${r.rating}/5` : "未评分"}`
      : "可添加菜谱";
    ctx.fillText(meta, imgX, y + cardH - (items.length <= 3 ? 62 : 44));

    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 2;
    roundRectPath(ctx, x, y, cardW, cardH, 28);
    ctx.stroke();
  }

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  if (!blob) throw new Error("Failed to export image");

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}


"use client";

import type { Recipe } from "@/lib/recipes/types";

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
  const W = 1200;
  const H = 820;
  const margin = 54;
  const gap = 36;
  const cardW = (W - margin * 2 - gap * 2) / 3;
  const cardH = 560;

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
    selected.slice(0, 3).map(async (r) => (r.images?.[0] ? await loadImage(r.images[0]) : null)),
  );

  for (let i = 0; i < 3; i++) {
    const r = selected[i];
    const x = margin + i * (cardW + gap);
    const y = 130;

    // card background
    ctx.fillStyle = "#FFFFFF";
    roundRectPath(ctx, x, y, cardW, cardH, 28);
    ctx.fill();

    // image area
    const imgX = x + 26;
    const imgY = y + 26;
    const imgW = cardW - 52;
    const imgH = 250;
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
      ctx.font = "600 28px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText("无图", imgX + imgW / 2, imgY + imgH / 2);
      ctx.textAlign = "left";
    }
    ctx.restore();

    // content
    ctx.fillStyle = "#111";
    ctx.font = "700 32px ui-sans-serif, system-ui";

    const title = r?.name ?? "（空位）";
    const lines = wrapTextLines(ctx, title, imgW);
    const titleLines = lines.slice(0, 2);
    const titleY = y + 310;
    for (let li = 0; li < titleLines.length; li++) {
      ctx.fillText(titleLines[li]!, imgX, titleY + li * 40);
    }

    ctx.fillStyle = "#666";
    ctx.font = "500 24px ui-sans-serif, system-ui";
    const meta = r
      ? `${r.category} · ${r.rating ? `${r.rating}/5` : "未评分"}`
      : "可添加菜谱";
    ctx.fillText(meta, imgX, y + cardH - 62);

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


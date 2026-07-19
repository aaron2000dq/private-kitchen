"use client";

import type { Recipe } from "@/lib/recipes/types";

type ReceiptRow = {
  lines: string[];
  height: number;
};

const RECEIPT_SERIF =
  '"Source Han Serif SC", "Source Han Serif CN", "Noto Serif CJK SC", "Noto Serif SC", "Songti SC", STSong, SimSun, serif';
const RECEIPT_MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';

function font(size: number, weight = 500, family = RECEIPT_SERIF) {
  return `${weight} ${size}px ${family}`;
}

async function ensureReceiptFonts() {
  if (!("fonts" in document)) return;

  try {
    await Promise.all([
      document.fonts.load(font(29, 560, RECEIPT_SERIF)),
      document.fonts.load(font(30, 520, RECEIPT_SERIF)),
      document.fonts.load(font(16, 620, RECEIPT_MONO)),
    ]);
    await document.fonts.ready;
  } catch {
    // System fallbacks are good enough for export if font loading is unavailable.
  }
}

function fitFontToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  initialSize: number,
  minSize: number,
  weight: number,
  family = RECEIPT_SERIF,
) {
  let size = initialSize;

  while (size > minSize) {
    ctx.font = font(size, weight, family);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }

  ctx.font = font(size, weight, family);
  return size;
}

function fillCenteredTextFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxWidth: number,
  initialSize: number,
  minSize: number,
  weight: number,
  family = RECEIPT_SERIF,
) {
  fitFontToWidth(ctx, text, maxWidth, initialSize, minSize, weight, family);
  ctx.fillText(text, cx, y);
}

function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";

  for (const ch of text.trim()) {
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [text];
}

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

function receiptDateParts(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const monthPadded = String(month).padStart(2, "0");
  const dayPadded = String(day).padStart(2, "0");

  return {
    title: `${year}年${month}月${day}日·私房家宴`,
    fileStamp: `${year}${monthPadded}${dayPadded}`,
  };
}

function drawDashedLine(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number, alpha = 0.22) {
  ctx.save();
  ctx.strokeStyle = `rgba(47, 55, 49, ${alpha})`;
  ctx.lineWidth = 1.25;
  ctx.setLineDash([6, 11]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

function drawPaperTexture(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, 16);
  ctx.clip();

  ctx.fillStyle = "rgba(24, 33, 29, 0.018)";
  for (let yy = y + 18; yy < y + h - 18; yy += 7) {
    ctx.fillRect(x + 22, yy, w - 44, 1);
  }

  ctx.strokeStyle = "rgba(82, 92, 78, 0.08)";
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 140; i += 1) {
    const sx = x + 26 + ((i * 47) % Math.max(1, w - 52));
    const sy = y + 24 + ((i * 61) % Math.max(1, h - 48));
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + ((i % 5) - 2) * 4, sy + 3 + (i % 4));
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(177, 143, 77, 0.055)";
  for (let i = 0; i < 90; i += 1) {
    const px = x + 24 + ((i * 31) % Math.max(1, w - 48));
    const py = y + 24 + ((i * 43) % Math.max(1, h - 48));
    ctx.fillRect(px, py, 1.4, 1.4);
  }

  ctx.restore();
}

function drawPerforation(ctx: CanvasRenderingContext2D, background: string, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = background;
  const r = 9;
  for (let px = x + 18; px <= x + w - 18; px += 26) {
    ctx.beginPath();
    ctx.arc(px, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, y + h, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCornerFrame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const gold = "rgba(161, 125, 62, 0.64)";
  const inset = 31;
  const r = 28;
  const left = x + inset;
  const right = x + w - inset;
  const top = y + inset;
  const bottom = y + h - inset;

  ctx.save();
  ctx.strokeStyle = gold;
  ctx.lineWidth = 1.45;

  ctx.beginPath();
  ctx.moveTo(left + r, top);
  ctx.lineTo(right - r, top);
  ctx.quadraticCurveTo(right - 4, top + 4, right, top + r);
  ctx.lineTo(right, bottom - r);
  ctx.quadraticCurveTo(right - 4, bottom - 4, right - r, bottom);
  ctx.lineTo(left + r, bottom);
  ctx.quadraticCurveTo(left + 4, bottom - 4, left, bottom - r);
  ctx.lineTo(left, top + r);
  ctx.quadraticCurveTo(left + 4, top + 4, left + r, top);
  ctx.stroke();

  ctx.strokeStyle = "rgba(161, 125, 62, 0.28)";
  ctx.lineWidth = 1;
  ctx.strokeRect(left + 16, top + 16, right - left - 32, bottom - top - 32);
  ctx.restore();
}

function drawBotanicalMark(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(63, 111, 85, 0.56)";
  ctx.fillStyle = "rgba(63, 111, 85, 0.36)";
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(cx, cy + 23);
  ctx.bezierCurveTo(cx - 2, cy + 7, cx + 2, cy - 8, cx, cy - 23);
  ctx.stroke();

  const leaves = [
    [-13, -13, -24, -19],
    [11, -5, 25, -11],
    [-10, 8, -25, 3],
    [9, 16, 23, 14],
  ] as const;
  for (const [dx, dy, tipX, tipY] of leaves) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * 0.2, cy + dy);
    ctx.quadraticCurveTo(cx + dx, cy + dy - 8, cx + tipX, cy + tipY);
    ctx.quadraticCurveTo(cx + dx + 3, cy + dy + 3, cx + dx * 0.2, cy + dy);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(161, 125, 62, 0.54)";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(cx, cy, 43, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSeal(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const size = 34;
  const x = cx - size / 2;
  const y = cy - size / 2;

  ctx.save();
  ctx.strokeStyle = "rgba(170, 50, 36, 0.82)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, size, size);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 5, y + 5, size - 10, size - 10);

  ctx.beginPath();
  ctx.moveTo(x + 10, y + 11);
  ctx.lineTo(x + 22, y + 11);
  ctx.lineTo(x + 22, y + 20);
  ctx.moveTo(x + 13, y + 15);
  ctx.lineTo(x + 13, y + 27);
  ctx.moveTo(x + 18, y + 16);
  ctx.lineTo(x + 27, y + 16);
  ctx.lineTo(x + 27, y + 26);
  ctx.moveTo(x + 10, y + 26);
  ctx.lineTo(x + 25, y + 26);
  ctx.stroke();
  ctx.restore();
}

function drawReceiptPaper(ctx: CanvasRenderingContext2D, canvasW: number, paperX: number, paperY: number, paperW: number, paperH: number) {
  const background = "#DDE3D6";
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvasW, paperH + paperY * 2);

  ctx.save();
  ctx.shadowColor = "rgba(24, 33, 29, 0.16)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 14;
  roundRectPath(ctx, paperX, paperY, paperW, paperH, 16);
  ctx.fillStyle = "#FFFDF6";
  ctx.fill();
  ctx.restore();

  drawPaperTexture(ctx, paperX, paperY, paperW, paperH);
  drawPerforation(ctx, background, paperX, paperY, paperW, paperH);
  drawCornerFrame(ctx, paperX, paperY, paperW, paperH);
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function shareOrDownload(blob: Blob, fileName: string, title: string) {
  const file = new File([blob], fileName, { type: "image/png" });
  const shareData: ShareData = {
    title,
    files: [file],
  };

  if (typeof navigator.share === "function" && navigator.canShare?.(shareData)) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (isAbortError(error)) return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportTodayCookbookToPng(selected: Recipe[], fileName?: string) {
  const items = selected.slice(0, 10);
  if (!items.length) throw new Error("还没有选择要分享的菜");

  await ensureReceiptFonts();

  const now = new Date();
  const { title, fileStamp } = receiptDateParts(now);
  const downloadName = fileName ?? `${fileStamp}-私房家宴小票.png`;

  const scale = 2;
  const W = 760;
  const paperX = 40;
  const paperY = 32;
  const paperW = W - paperX * 2;
  const padX = 64;
  const contentX = paperX + padX;
  const contentW = paperW - padX * 2;
  const numberW = 68;
  const dishX = contentX + numberW;
  const dishW = contentW - numberW - 32;
  const dishLineH = 38;
  const rowPadY = 18;

  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) throw new Error("Canvas not supported");
  probe.font = font(30, 520, RECEIPT_SERIF);

  const rows: ReceiptRow[] = items.map((recipe) => {
    const lines = wrapTextLines(probe, recipe.name, dishW).slice(0, 3);
    const textH = Math.max(40, lines.length * dishLineH);
    return {
      lines,
      height: textH + rowPadY * 2,
    };
  });

  const titleY = paperY + 124;
  const dividerY = paperY + 184;
  const listStartY = paperY + 214;
  const listHeight = rows.reduce((sum, row, index) => sum + row.height + (index < rows.length - 1 ? 10 : 0), 0);
  const footerH = 92;
  const paperH = Math.max(720, listStartY - paperY + listHeight + footerH);
  const H = paperH + paperY * 2;

  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.scale(scale, scale);

  drawReceiptPaper(ctx, W, paperX, paperY, paperW, paperH);

  const markY = paperY + 78;
  drawBotanicalMark(ctx, W / 2, markY);

  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  ctx.fillStyle = "#17211B";
  fillCenteredTextFit(ctx, title, W / 2, titleY, contentW - 24, 30, 24, 560, RECEIPT_SERIF);

  ctx.fillStyle = "rgba(161, 125, 62, 0.86)";
  ctx.beginPath();
  ctx.arc(W / 2 - 12, titleY + 50, 2.6, 0, Math.PI * 2);
  ctx.arc(W / 2 + 12, titleY + 50, 2.6, 0, Math.PI * 2);
  ctx.fill();

  drawDashedLine(ctx, contentX, dividerY, contentX + contentW, 0.28);

  let y = listStartY;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const top = y + rowPadY;
    const numberY = top + 4;

    ctx.save();
    ctx.strokeStyle = "rgba(161, 125, 62, 0.42)";
    ctx.fillStyle = "rgba(255, 253, 246, 0.72)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(contentX + 20, numberY + 15, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(23, 33, 27, 0.44)";
    ctx.font = font(16, 620, RECEIPT_MONO);
    ctx.fillText(String(index + 1).padStart(2, "0"), contentX + 20, numberY + 5.5);

    ctx.textAlign = "left";
    ctx.fillStyle = "#17211B";
    ctx.font = font(30, 520, RECEIPT_SERIF);
    for (let lineIndex = 0; lineIndex < row.lines.length; lineIndex += 1) {
      ctx.fillText(row.lines[lineIndex]!, dishX, top + lineIndex * dishLineH);
    }

    ctx.fillStyle = "rgba(63, 111, 85, 0.34)";
    ctx.beginPath();
    ctx.arc(contentX + contentW - 18, top + 18, 3.2, 0, Math.PI * 2);
    ctx.arc(contentX + contentW - 5, top + 18, 2.1, 0, Math.PI * 2);
    ctx.fill();

    y += row.height;
    if (index < rows.length - 1) {
      drawDashedLine(ctx, contentX, y, contentX + contentW, 0.18);
      y += 10;
    }
  }

  const footerY = paperY + paperH - 106;
  drawDashedLine(ctx, contentX + 102, footerY + 18, W / 2 - 28, 0.28);
  drawDashedLine(ctx, W / 2 + 28, footerY + 18, contentX + contentW - 102, 0.28);
  ctx.fillStyle = "rgba(161, 125, 62, 0.82)";
  ctx.beginPath();
  ctx.moveTo(W / 2, footerY + 10);
  ctx.lineTo(W / 2 + 8, footerY + 18);
  ctx.lineTo(W / 2, footerY + 26);
  ctx.lineTo(W / 2 - 8, footerY + 18);
  ctx.closePath();
  ctx.fill();
  drawSeal(ctx, W / 2, footerY + 56);

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  if (!blob) throw new Error("Failed to export image");

  await shareOrDownload(blob, downloadName, title);
}

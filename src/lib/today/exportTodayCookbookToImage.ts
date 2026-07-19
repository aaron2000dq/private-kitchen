"use client";

import type { Recipe } from "@/lib/recipes/types";

function font(size: number, weight = 500, family = "ui-sans-serif") {
  return `${weight} ${size}px ${family}, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`;
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

function drawDashedLine(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(35, 42, 36, 0.24)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 9]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

function drawReceiptPaper(ctx: CanvasRenderingContext2D, canvasW: number, paperX: number, paperY: number, paperW: number, paperH: number) {
  ctx.fillStyle = "#ECE9DF";
  ctx.fillRect(0, 0, canvasW, paperH + paperY * 2);

  ctx.save();
  ctx.shadowColor = "rgba(24, 33, 29, 0.13)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 10;
  roundRectPath(ctx, paperX, paperY, paperW, paperH, 10);
  ctx.fillStyle = "#FFFDF7";
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(24, 33, 29, 0.025)";
  for (let y = paperY + 18; y < paperY + paperH - 18; y += 7) {
    ctx.fillRect(paperX + 16, y, paperW - 32, 1);
  }

  ctx.fillStyle = "rgba(63, 111, 85, 0.035)";
  for (let i = 0; i < 110; i += 1) {
    const x = paperX + 18 + ((i * 37) % Math.max(1, paperW - 36));
    const y = paperY + 18 + ((i * 53) % Math.max(1, paperH - 36));
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.fillStyle = "#ECE9DF";
  const radius = 8;
  for (let x = paperX + 14; x < paperX + paperW - 10; x += 24) {
    ctx.beginPath();
    ctx.arc(x, paperY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, paperY + paperH, radius, 0, Math.PI * 2);
    ctx.fill();
  }
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

  const now = new Date();
  const { title, fileStamp } = receiptDateParts(now);
  const downloadName = fileName ?? `${fileStamp}-私房家宴小票.png`;

  const W = 760;
  const paperX = 42;
  const paperY = 34;
  const paperW = W - paperX * 2;
  const padX = 58;
  const contentX = paperX + padX;
  const contentW = paperW - padX * 2;
  const numberW = 68;
  const dishX = contentX + numberW;
  const dishW = contentW - numberW;
  const dishLineH = 42;
  const rowPadY = 20;

  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) throw new Error("Canvas not supported");
  probe.font = font(34, 700, 'ui-sans-serif, "Noto Serif SC"');

  const rows = items.map((recipe) => {
    const lines = wrapTextLines(probe, recipe.name, dishW).slice(0, 3);
    const textH = Math.max(46, lines.length * dishLineH);
    return {
      lines,
      height: textH + rowPadY * 2,
    };
  });

  const titleY = paperY + 66;
  const listStartY = paperY + 154;
  const listHeight = rows.reduce((sum, row) => sum + row.height + 10, 0);
  const paperH = Math.max(520, listStartY - paperY + listHeight + 42);
  const H = paperH + paperY * 2;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  drawReceiptPaper(ctx, W, paperX, paperY, paperW, paperH);

  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  ctx.fillStyle = "#17211B";
  ctx.font = font(34, 700, 'ui-sans-serif, "Noto Serif SC"');
  ctx.fillText(title, W / 2, titleY);

  drawDashedLine(ctx, contentX, paperY + 124, contentX + contentW);

  let y = listStartY;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const top = y + rowPadY;

    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(23, 33, 27, 0.48)";
    ctx.font = font(24, 700, "ui-monospace");
    ctx.fillText(String(index + 1).padStart(2, "0"), contentX, top + 4);

    ctx.fillStyle = "#17211B";
    ctx.font = font(34, 700, 'ui-sans-serif, "Noto Serif SC"');
    for (let lineIndex = 0; lineIndex < row.lines.length; lineIndex += 1) {
      ctx.fillText(row.lines[lineIndex]!, dishX, top + lineIndex * dishLineH);
    }

    y += row.height;
    if (index < rows.length - 1) {
      drawDashedLine(ctx, contentX, y, contentX + contentW);
      y += 10;
    }
  }

  drawDashedLine(ctx, contentX, paperY + paperH - 52, contentX + contentW);

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  if (!blob) throw new Error("Failed to export image");

  await shareOrDownload(blob, downloadName, title);
}

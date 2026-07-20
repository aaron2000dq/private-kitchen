"use client";

import type { Recipe } from "@/lib/recipes/types";
import { MEAL_ROLE_META, mealRoleOf, type MealRole } from "@/lib/recipes/mealRole";

type ReceiptRow = {
  lines: string[];
  height: number;
};

type ReceiptSection = {
  key: ReceiptRole;
  label: string;
  shortLabel: string;
  note: string;
  rows: ReceiptRow[];
  height: number;
};

type ReceiptRole = Exclude<MealRole, "home">;

const RECEIPT_SERIF =
  '"Source Han Serif SC", "Source Han Serif CN", "Noto Serif CJK SC", "Noto Serif SC", "Songti SC", STSong, SimSun, serif';
const RECEIPT_MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
const RECEIPT_BACKGROUND_SRC = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/images/private-kitchen-receipt-paper-v2.webp`;

function font(size: number, weight = 500, family = RECEIPT_SERIF) {
  return `${weight} ${size}px ${family}`;
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  const image = new Image();
  image.decoding = "async";

  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
  });

  image.src = src;

  try {
    await loaded;
    if (typeof image.decode === "function") {
      await image.decode().catch(() => undefined);
    }
    return image;
  } catch {
    return null;
  }
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

function receiptRole(recipe: Recipe): ReceiptRole {
  const role = mealRoleOf(recipe);
  return role === "home" ? "small" : role;
}

const RECEIPT_SECTION_META: Record<ReceiptRole, { label: string; shortLabel: string; note: string; order: number }> = {
  main: { ...MEAL_ROLE_META.main, label: MEAL_ROLE_META.main.receiptLabel },
  vegetable: { ...MEAL_ROLE_META.vegetable, label: MEAL_ROLE_META.vegetable.receiptLabel },
  soup: { ...MEAL_ROLE_META.soup, label: MEAL_ROLE_META.soup.receiptLabel },
  staple: { ...MEAL_ROLE_META.staple, label: MEAL_ROLE_META.staple.receiptLabel },
  small: { ...MEAL_ROLE_META.small, label: MEAL_ROLE_META.small.receiptLabel },
};

function buildReceiptSections(
  recipes: Recipe[],
  ctx: CanvasRenderingContext2D,
  dishW: number,
  dishLineH: number,
  rowPadY: number,
): ReceiptSection[] {
  const grouped = new Map<ReceiptRole, ReceiptRow[]>();

  recipes.forEach((recipe) => {
    const role = receiptRole(recipe);
    const lines = wrapTextLines(ctx, recipe.name, dishW).slice(0, 2);
    const textH = Math.max(38, lines.length * dishLineH);
    const row: ReceiptRow = {
      lines,
      height: textH + rowPadY * 2,
    };
    grouped.set(role, [...(grouped.get(role) ?? []), row]);
  });

  return Array.from(grouped.entries())
    .sort((a, b) => RECEIPT_SECTION_META[a[0]].order - RECEIPT_SECTION_META[b[0]].order)
    .map(([key, rows]) => {
      const meta = RECEIPT_SECTION_META[key];
      return {
        key,
        label: meta.label,
        shortLabel: meta.shortLabel,
        note: meta.note,
        rows,
        height: 42 + rows.reduce((sum, row) => sum + row.height, 0) + Math.max(0, rows.length - 1) * 7,
      };
    });
}

function receiptSummary(sections: ReceiptSection[], count: number): string {
  const labels = sections
    .map((section) => `${section.shortLabel}${section.rows.length}`)
    .join(" · ");
  return labels ? `共 ${count} 道 · ${labels}` : `共 ${count} 道`;
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

function drawGeneratedReceiptBackground(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const sourceW = image.naturalWidth || image.width;
  const sourceH = image.naturalHeight || image.height;
  const scale = width / sourceW;
  const topSourceH = 760;
  const bottomSourceY = 1500;
  const topTargetH = topSourceH * scale;
  const bottomTargetH = (sourceH - bottomSourceY) * scale;
  const middleTargetH = Math.max(1, height - topTargetH - bottomTargetH);

  ctx.drawImage(image, 0, 0, sourceW, topSourceH, 0, 0, width, topTargetH);
  ctx.drawImage(
    image,
    0,
    topSourceH,
    sourceW,
    bottomSourceY - topSourceH,
    0,
    topTargetH,
    width,
    middleTargetH,
  );
  ctx.drawImage(
    image,
    0,
    bottomSourceY,
    sourceW,
    sourceH - bottomSourceY,
    0,
    height - bottomTargetH,
    width,
    bottomTargetH,
  );
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function shareOrDownload(blob: Blob, fileName: string, title: string) {
  const file = new File([blob], fileName, { type: blob.type || "image/jpeg" });
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
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

export async function exportTodayCookbookToPng(selected: Recipe[], fileName?: string) {
  const items = selected.slice(0, 10);
  if (!items.length) throw new Error("还没有选择要分享的菜");

  await ensureReceiptFonts();
  const receiptBackground = await loadImage(RECEIPT_BACKGROUND_SRC);
  const hasGeneratedBackground = receiptBackground != null;

  const now = new Date();
  const { title, fileStamp } = receiptDateParts(now);
  const downloadName = fileName ?? `${fileStamp}-私房家宴小票.jpg`;

  const scale = 2;
  const W = 760;
  const paperX = hasGeneratedBackground ? 54 : 40;
  const paperY = hasGeneratedBackground ? 0 : 32;
  const paperW = W - paperX * 2;
  const padX = hasGeneratedBackground ? 72 : 64;
  const contentX = paperX + padX;
  const contentW = paperW - padX * 2;
  const numberW = hasGeneratedBackground ? 76 : 68;
  const dishX = contentX + numberW;
  const dishW = contentW - numberW - (hasGeneratedBackground ? 40 : 28);
  const dishLineH = hasGeneratedBackground ? 35 : 33;
  const rowPadY = hasGeneratedBackground ? 15 : 14;

  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) throw new Error("Canvas not supported");
  probe.font = font(30, 520, RECEIPT_SERIF);

  const sections = buildReceiptSections(items, probe, dishW, dishLineH, rowPadY);

  const titleY = hasGeneratedBackground ? 302 : paperY + 118;
  const subtitleY = titleY + (hasGeneratedBackground ? 58 : 50);
  const dividerY = subtitleY + 54;
  const listStartY = dividerY + 34;
  const listHeight = sections.reduce((sum, section) => sum + section.height, 0) + Math.max(0, sections.length - 1) * 17;
  const footerH = hasGeneratedBackground ? 230 : 120;
  const paperH = Math.max(720, listStartY - paperY + listHeight + footerH);
  const generatedFooterOffset = 276;
  const H = hasGeneratedBackground
    ? Math.max(1080, listStartY + listHeight + generatedFooterOffset)
    : paperH + paperY * 2;

  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (receiptBackground) {
    drawGeneratedReceiptBackground(ctx, receiptBackground, W, H);
  } else {
    drawReceiptPaper(ctx, W, paperX, paperY, paperW, paperH);
    const markY = paperY + 78;
    drawBotanicalMark(ctx, W / 2, markY);
  }

  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  ctx.fillStyle = "#17211B";
  fillCenteredTextFit(ctx, title, W / 2, titleY, contentW + (hasGeneratedBackground ? 58 : -24), hasGeneratedBackground ? 34 : 30, 24, 560, RECEIPT_SERIF);

  ctx.fillStyle = "rgba(161, 125, 62, 0.86)";
  ctx.beginPath();
  ctx.arc(W / 2 - 12, subtitleY - 11, 2.6, 0, Math.PI * 2);
  ctx.arc(W / 2 + 12, subtitleY - 11, 2.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(23, 33, 27, 0.54)";
  ctx.font = font(15, 520, RECEIPT_SERIF);
  ctx.fillText(`今日席单 · ${items.length} 道 · 仅含已选菜`, W / 2, subtitleY);

  drawDashedLine(ctx, contentX, dividerY, contentX + contentW, 0.28);

  let y = listStartY;
  let displayNumber = 1;
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex]!;

    ctx.save();
    roundRectPath(ctx, contentX, y, contentW, 32, 10);
    ctx.fillStyle = "rgba(63, 111, 85, 0.075)";
    ctx.fill();
    ctx.strokeStyle = "rgba(63, 111, 85, 0.22)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(23, 33, 27, 0.72)";
    ctx.font = font(16, 560, RECEIPT_SERIF);
    ctx.fillText(section.label, contentX + 14, y + 7);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(23, 33, 27, 0.42)";
    ctx.font = font(12, 520, RECEIPT_SERIF);
    ctx.fillText(`${section.note} · ${section.rows.length} 道`, contentX + contentW - 14, y + 10);

    y += 42;

    for (let rowIndex = 0; rowIndex < section.rows.length; rowIndex += 1) {
      const row = section.rows[rowIndex]!;
      const top = y + rowPadY;
      const numberY = top + 1;

      ctx.save();
      ctx.strokeStyle = "rgba(161, 125, 62, 0.40)";
      ctx.fillStyle = "rgba(255, 253, 246, 0.72)";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(contentX + 21, numberY + 15, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(23, 33, 27, 0.43)";
      ctx.font = font(15, 620, RECEIPT_MONO);
      ctx.fillText(String(displayNumber).padStart(2, "0"), contentX + 21, numberY + 5.5);
      displayNumber += 1;

      ctx.textAlign = "left";
      ctx.fillStyle = "#17211B";
      ctx.font = font(27, 540, RECEIPT_SERIF);
      for (let lineIndex = 0; lineIndex < row.lines.length; lineIndex += 1) {
        ctx.fillText(row.lines[lineIndex]!, dishX, top + lineIndex * dishLineH);
      }

      ctx.fillStyle = "rgba(63, 111, 85, 0.32)";
      ctx.beginPath();
      ctx.arc(contentX + contentW - 20, top + 17, 3.1, 0, Math.PI * 2);
      ctx.arc(contentX + contentW - 8, top + 17, 2.1, 0, Math.PI * 2);
      ctx.fill();

      y += row.height;
      if (rowIndex < section.rows.length - 1) {
        drawDashedLine(ctx, dishX, y, contentX + contentW, 0.12);
        y += 7;
      }
    }

    if (sectionIndex < sections.length - 1) {
      y += 17;
    }
  }

  const footerY = hasGeneratedBackground ? H - 256 : paperY + paperH - 110;
  drawDashedLine(ctx, contentX + 92, footerY + 18, W / 2 - 28, 0.28);
  drawDashedLine(ctx, W / 2 + 28, footerY + 18, contentX + contentW - 92, 0.28);
  ctx.fillStyle = "rgba(161, 125, 62, 0.82)";
  ctx.beginPath();
  ctx.moveTo(W / 2, footerY + 10);
  ctx.lineTo(W / 2 + 8, footerY + 18);
  ctx.lineTo(W / 2, footerY + 26);
  ctx.lineTo(W / 2 - 8, footerY + 18);
  ctx.closePath();
  ctx.fill();

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(23, 33, 27, 0.54)";
  ctx.font = font(14, 500, RECEIPT_SERIF);
  ctx.fillText(receiptSummary(sections, items.length), W / 2, footerY + 40);
  if (!hasGeneratedBackground) {
    drawSeal(ctx, W / 2, footerY + 78);
  }

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92));
  if (!blob) throw new Error("Failed to export image");

  await shareOrDownload(blob, downloadName, title);
}

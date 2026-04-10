"use client";

import * as React from "react";

const cache = new Map<string, string>();

function makeCacheKey(src: string, maxSide: number, quality: number) {
  return `${src}|${maxSide}|${quality}`;
}

/**
 * 首页列表用：将图片缩放到不超过 maxSide，并以较高质量 JPEG 重编码，减轻带宽与解码压力。
 * 若跨域导致 canvas 污染，则回退为原图。
 */
export function VisuallyLosslessThumb({
  src,
  alt,
  className,
  maxSide = 720,
  quality = 0.88,
  draggable,
}: {
  src: string;
  alt: string;
  className?: string;
  maxSide?: number;
  quality?: number;
  draggable?: boolean;
}) {
  const [out, setOut] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!src) return;
    const key = makeCacheKey(src, maxSide, quality);
    const hit = cache.get(key);
    if (hit) {
      setOut(hit);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) {
          if (!cancelled) setOut(src);
          return;
        }
        const scale = Math.min(1, maxSide / Math.max(w, h));
        const tw = Math.max(1, Math.round(w * scale));
        const th = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          if (!cancelled) setOut(src);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, tw, th);
        canvas.toBlob(
          (blob) => {
            if (cancelled) return;
            if (!blob) {
              setOut(src);
              return;
            }
            const url = URL.createObjectURL(blob);
            cache.set(key, url);
            setOut(url);
          },
          "image/jpeg",
          quality,
        );
      } catch {
        if (!cancelled) setOut(src);
      }
    };
    img.onerror = () => {
      if (!cancelled) setOut(src);
    };
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src, maxSide, quality]);

  const href = out ?? src;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={href}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      draggable={draggable}
    />
  );
}

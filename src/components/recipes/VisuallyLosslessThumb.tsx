"use client";

import * as React from "react";

export function VisuallyLosslessThumb({
  src,
  fallbackSrc,
  alt,
  className,
  draggable,
  loading = "lazy",
  fetchPriority,
}: {
  src: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  draggable?: boolean;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
}) {
  const [current, setCurrent] = React.useState(src);

  React.useEffect(() => {
    setCurrent(src);
  }, [src]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
      className={className}
      draggable={draggable}
      onError={() => {
        if (fallbackSrc && current !== fallbackSrc) setCurrent(fallbackSrc);
      }}
    />
  );
}

"use client";

import * as React from "react";

export function VisuallyLosslessThumb({
  src,
  fallbackSrc,
  alt,
  className,
  draggable,
  loading = "lazy",
}: {
  src: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  draggable?: boolean;
  loading?: "eager" | "lazy";
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
      decoding="async"
      className={className}
      draggable={draggable}
      onError={() => {
        if (fallbackSrc && current !== fallbackSrc) setCurrent(fallbackSrc);
      }}
    />
  );
}

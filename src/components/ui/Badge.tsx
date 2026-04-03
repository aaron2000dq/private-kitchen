"use client";

import * as React from "react";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Badge({
  className,
  tone = "muted",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "muted" | "accent" | "warm";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] leading-none",
        tone === "muted" &&
          "border-[color:var(--line)] text-[color:var(--muted)] bg-black/[0.02] dark:bg-white/[0.04]",
        tone === "accent" &&
          "border-[color:rgba(107,142,107,0.25)] text-[color:var(--accent)] bg-[color:rgba(107,142,107,0.08)]",
        tone === "warm" &&
          "border-[color:rgba(201,138,99,0.25)] text-[color:var(--warm)] bg-[color:rgba(201,138,99,0.10)]",
        className,
      )}
      {...props}
    />
  );
}


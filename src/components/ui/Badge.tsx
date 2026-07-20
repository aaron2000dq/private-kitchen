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
        "inline-flex items-center rounded-md border px-2 py-1 text-[12px] leading-none shadow-[0_1px_0_rgba(24,33,29,0.035)]",
        tone === "muted" &&
          "border-[color:var(--line)] text-[color:var(--muted)] bg-[color:var(--paper-strong)]/72",
        tone === "accent" &&
          "border-[color:rgba(63,111,85,0.26)] text-[color:var(--accent)] bg-[color:rgba(63,111,85,0.09)]",
        tone === "warm" &&
          "border-[color:rgba(184,92,56,0.28)] text-[color:var(--warm)] bg-[color:rgba(184,92,56,0.09)]",
        className,
      )}
      {...props}
    />
  );
}

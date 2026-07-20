"use client";

import * as React from "react";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)]/86",
        "px-3 text-[14px] text-[color:var(--foreground)] placeholder:text-[color:var(--muted-2)]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.62),0_1px_0_rgba(24,33,29,0.04)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
        className,
      )}
      {...props}
    />
  );
}

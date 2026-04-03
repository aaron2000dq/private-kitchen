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
        "h-11 w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)]",
        "px-3 text-[14px] text-[color:var(--foreground)] placeholder:text-[color:var(--muted-2)]",
        "shadow-[0_1px_0_rgba(20,22,20,0.04)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
        className,
      )}
      {...props}
    />
  );
}


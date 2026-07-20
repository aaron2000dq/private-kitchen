"use client";

import * as React from "react";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full resize-y rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)]/86",
        "px-3 py-2.5 text-[14px] text-[color:var(--foreground)] placeholder:text-[color:var(--muted-2)]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.62),0_1px_0_rgba(20,22,20,0.04)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
        className,
      )}
      {...props}
    />
  );
}

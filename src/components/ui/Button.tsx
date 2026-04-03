"use client";

import * as React from "react";

type Variant = "primary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl select-none",
        "transition-[transform,background-color,color,border-color,box-shadow,opacity] duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)]",
        "disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" ? "h-9 px-3 text-[13px]" : "h-11 px-4 text-[14px]",
        variant === "primary" &&
          "bg-[color:var(--foreground)] text-[color:var(--background)] shadow-[var(--shadow)] hover:bg-black/90 dark:hover:bg-white/90",
        variant === "outline" &&
          "bg-transparent border border-[color:var(--line)] text-[color:var(--foreground)] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
        variant === "ghost" &&
          "bg-transparent text-[color:var(--foreground)] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
        variant === "danger" &&
          "bg-[color:var(--warm)] text-[color:var(--foreground)] hover:brightness-[0.98]",
        className,
      )}
      {...props}
    />
  );
}


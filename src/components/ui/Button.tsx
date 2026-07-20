"use client";

import Link from "next/link";
import * as React from "react";

type Variant = "primary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function buttonClassName({
  className,
  variant = "primary",
  size = "md",
}: {
  className?: string;
  variant?: Variant;
  size?: Size;
}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg select-none font-medium",
    "transition-[transform,background-color,color,border-color,box-shadow,opacity] duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)]",
    "disabled:opacity-50 disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:pointer-events-none",
    size === "sm" ? "h-9 px-3 text-[13px]" : "h-11 px-4 text-[14px]",
    variant === "primary" &&
      "bg-[color:var(--foreground)] text-[color:var(--background)] shadow-[var(--shadow-soft)] hover:-translate-y-0.5 hover:bg-black/90 dark:hover:bg-white/90",
    variant === "outline" &&
      "bg-[color:var(--paper)]/70 border border-[color:var(--menu-line)] text-[color:var(--foreground)] hover:bg-[color:rgba(185,148,75,0.08)]",
    variant === "ghost" &&
      "bg-transparent text-[color:var(--foreground)] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
    variant === "danger" && "bg-[color:var(--warm)] text-white hover:brightness-[0.98]",
    className,
  );
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  type,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      type={type ?? "button"}
      className={buttonClassName({ className, variant, size })}
      {...props}
    />
  );
}

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
}) {
  return <Link className={buttonClassName({ className, variant, size })} {...props} />;
}

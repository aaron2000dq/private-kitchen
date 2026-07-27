"use client";

import * as React from "react";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function StarIcon({ filled, size = 18 }: { filled: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn(
        "transition-colors",
        filled ? "text-[color:var(--warm)]" : "text-black/20 dark:text-white/20",
      )}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M12 17.3l-6.18 3.55 1.64-6.96L2 9.24l7.19-.61L12 2l2.81 6.63 7.19.61-5.46 4.65 1.64 6.96L12 17.3z" />
    </svg>
  );
}

export function StarRating({
  value,
  onChange,
  max = 5,
  className,
  label,
  size = "md",
  disabled = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  max?: number;
  className?: string;
  label?: string;
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const current = hover ?? value;
  const iconSize = size === "sm" ? 14 : 18;

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {label ? (
        <span className={cn("text-[color:var(--muted)]", size === "sm" ? "text-[11px]" : "text-[13px]")}>{label}</span>
      ) : null}
      <div className="inline-flex items-center gap-0.5">
        {Array.from({ length: max }).map((_, idx) => {
          const v = idx + 1;
          const filled = v <= current;
          const interactive = typeof onChange === "function" && !disabled;

          return (
            <button
              key={v}
              type="button"
              className={cn(
                "flex items-center justify-center rounded-md",
                size === "sm" ? "h-6 w-6" : "h-9 w-9",
                interactive
                  ? "cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
                  : "cursor-default",
              )}
              disabled={disabled}
              aria-label={`评分 ${v} 星`}
              onMouseEnter={() => interactive && setHover(v)}
              onMouseLeave={() => interactive && setHover(null)}
              onClick={() => interactive && onChange(v)}
            >
              <StarIcon filled={filled} size={iconSize} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

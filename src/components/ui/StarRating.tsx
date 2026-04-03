"use client";

import * as React from "react";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
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
}: {
  value: number;
  onChange?: (v: number) => void;
  max?: number;
  className?: string;
  label?: string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const current = hover ?? value;

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {label ? (
        <span className="text-[13px] text-[color:var(--muted)]">{label}</span>
      ) : null}
      <div className="inline-flex items-center gap-1">
        {Array.from({ length: max }).map((_, idx) => {
          const v = idx + 1;
          const filled = v <= current;
          const interactive = typeof onChange === "function";

          return (
            <button
              key={v}
              type="button"
              className={cn(
                "rounded-md p-1",
                interactive
                  ? "cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
                  : "cursor-default",
              )}
              aria-label={`评分 ${v} 星`}
              onMouseEnter={() => interactive && setHover(v)}
              onMouseLeave={() => interactive && setHover(null)}
              onClick={() => interactive && onChange(v)}
            >
              <StarIcon filled={filled} />
            </button>
          );
        })}
      </div>
    </div>
  );
}


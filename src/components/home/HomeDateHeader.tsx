"use client";

import * as React from "react";
import { formatTodayZh, getSeasonalIntro } from "@/lib/recommendation/seasonal";

export function HomeDateHeader() {
  const [line1, setLine1] = React.useState<string>("");
  const [line2, setLine2] = React.useState<string>("");

  React.useEffect(() => {
    const d = new Date();
    setLine1(formatTodayZh(d));
    setLine2(getSeasonalIntro(d));
  }, []);

  if (!line1) {
    return (
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-black/[0.06] dark:bg-white/[0.08]" />
        <div className="h-16 w-full animate-pulse rounded-xl bg-black/[0.04] dark:bg-white/[0.06]" />
      </div>
    );
  }

  return (
    <header className="space-y-3">
      <p className="font-[var(--font-noto-serif-sc)] text-[26px] leading-snug tracking-wide text-[color:var(--foreground)]">
        {line1}
      </p>
      <p className="max-w-2xl text-[14px] leading-7 text-[color:var(--muted)]">{line2}</p>
    </header>
  );
}

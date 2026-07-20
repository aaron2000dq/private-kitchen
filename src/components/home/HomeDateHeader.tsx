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
        <div className="h-14 w-full animate-pulse rounded-lg bg-black/[0.04] dark:bg-white/[0.06]" />
      </div>
    );
  }

  return (
    <header className="pk-panel px-5 py-6 sm:px-7 sm:py-8">
      <div className="mx-auto max-w-2xl text-center">
        <div className="pk-section-label justify-center">今日席单</div>
        <p className="pk-serif mt-4 text-[25px] leading-snug text-[color:var(--foreground)] sm:text-[34px]">
          {line1}
        </p>
        <p className="mx-auto mt-4 max-w-xl text-[13px] leading-7 text-[color:var(--muted)] sm:text-[14px]">
          {line2}
        </p>
      </div>
    </header>
  );
}

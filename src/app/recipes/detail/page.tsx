import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RecipeDetailWithQuery } from "./recipeDetailWithQuery";

export default function RecipeDetailQueryPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper)] p-8 text-[13px] text-[color:var(--muted-2)]">
            载入中…
          </div>
        }
      >
        <RecipeDetailWithQuery />
      </Suspense>
    </AppShell>
  );
}

import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { EditRecipeWithQuery } from "./editRecipeWithQuery";

export default function RecipeEditQueryPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper)] p-8 text-[13px] text-[color:var(--muted-2)]">
            载入中…
          </div>
        }
      >
        <EditRecipeWithQuery />
      </Suspense>
    </AppShell>
  );
}

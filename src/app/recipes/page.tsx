import { AppShell } from "@/components/layout/AppShell";
import { TodayCookbookEditorClient } from "./todayCookbookEditorClient";

export default function RecipesPage() {
  return (
    <AppShell>
      <TodayCookbookEditorClient />
    </AppShell>
  );
}


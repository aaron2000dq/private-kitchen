import { AppShell } from "@/components/layout/AppShell";
import { RecipesListClient } from "./recipesListClient";

export default function RecipesPage() {
  return (
    <AppShell>
      <RecipesListClient showHeader showTodayShelf />
    </AppShell>
  );
}

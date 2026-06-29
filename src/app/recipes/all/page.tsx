import { AppShell } from "@/components/layout/AppShell";
import { RecipesListClient } from "../recipesListClient";

export default function RecipesAllPage() {
  return (
    <AppShell>
      <RecipesListClient showHeader showTodayShelf />
    </AppShell>
  );
}

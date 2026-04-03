import { AppShell } from "@/components/layout/AppShell";
import { RecipeFormClient } from "../recipeFormClient";

export default function NewRecipePage() {
  return (
    <AppShell>
      <RecipeFormClient mode="create" />
    </AppShell>
  );
}


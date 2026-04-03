import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { EditRecipeClient } from "./editRecipeClient";
import { getGeneratedRecipes } from "@/lib/recipes/generatedRecipes";
import { stableRecipeIdFromName } from "@/lib/recipes/stableRecipeId";
import { recipeDetailHref } from "@/lib/recipes/recipeRoutes";

export function generateStaticParams() {
  const recipes = getGeneratedRecipes();
  return recipes.map((r) => ({
    id: stableRecipeIdFromName(String(r.name ?? "").trim()),
  }));
}

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-4">
        <Link href={recipeDetailHref(id)}>
          <Button variant="ghost">← 返回</Button>
        </Link>
      </div>
      <div className="mt-6">
        <EditRecipeClient id={id} />
      </div>
    </AppShell>
  );
}


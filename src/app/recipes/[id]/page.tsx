import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { RecipeDetailClient } from "./recipeDetailClient";
import { Button } from "@/components/ui/Button";
import { getGeneratedRecipes } from "@/lib/recipes/generatedRecipes";
import { stableRecipeIdFromName } from "@/lib/recipes/stableRecipeId";
import { recipeEditHref } from "@/lib/recipes/recipeRoutes";

export function generateStaticParams() {
  const recipes = getGeneratedRecipes();
  return recipes.map((r) => ({
    id: stableRecipeIdFromName(String(r.name ?? "").trim()),
  }));
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-4">
        <Link href="/recipes/all">
          <Button variant="ghost">← 返回</Button>
        </Link>
        <Link href={recipeEditHref(id)}>
          <Button variant="outline">编辑</Button>
        </Link>
      </div>

      <div className="mt-6">
        <RecipeDetailClient id={id} />
      </div>
    </AppShell>
  );
}


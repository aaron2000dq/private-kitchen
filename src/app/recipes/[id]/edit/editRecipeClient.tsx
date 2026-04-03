"use client";

import * as React from "react";
import { RecipeRepository } from "@/lib/recipes/repository";
import { Recipe } from "@/lib/recipes/types";
import { RecipeFormClient } from "../../recipeFormClient";

export function EditRecipeClient({ id }: { id: string }) {
  const [recipe, setRecipe] = React.useState<Recipe | null>(null);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setHydrated(true);
    void RecipeRepository.get(id).then(setRecipe);
  }, [id]);

  if (!hydrated) return null;

  return <RecipeFormClient mode="edit" initial={recipe} />;
}


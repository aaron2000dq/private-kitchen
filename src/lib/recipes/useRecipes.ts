"use client";

import * as React from "react";
import { Recipe, RecipeInput } from "./types";
import { RecipeRepository } from "./repository";

export function useRecipes() {
  const [recipes, setRecipes] = React.useState<Recipe[]>([]);
  const [hydrated, setHydrated] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const list = await RecipeRepository.list();
    setRecipes(list);
  }, []);

  React.useEffect(() => {
    setHydrated(true);
    void refresh();
  }, [refresh]);

  const create = React.useCallback(async (input: RecipeInput) => {
    const r = await RecipeRepository.create(input);
    setRecipes(await RecipeRepository.list());
    return r;
  }, []);

  const update = React.useCallback(async (id: string, input: Partial<RecipeInput>) => {
    const r = await RecipeRepository.update(id, input);
    setRecipes(await RecipeRepository.list());
    return r;
  }, []);

  const remove = React.useCallback(async (id: string) => {
    await RecipeRepository.delete(id);
    setRecipes(await RecipeRepository.list());
  }, []);

  return { recipes, hydrated, refresh, create, update, remove };
}


export type RecipeDifficulty = "easy" | "medium" | "hard";

export type RecipeTag = string;

export interface RecipeIngredient {
  name: string;
  amount: string;
  note?: string;
}

export interface RecipeStep {
  order: number;
  content: string;
  tip?: string;
}

export interface Recipe {
  id: string;
  name: string;
  category: string;
  rating: number;
  difficulty: RecipeDifficulty;
  tags: RecipeTag[];
  description: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  images: string[];
  createdAt: string;
  updatedAt: string;
}

export type RecipeInput = Omit<
  Recipe,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: string;
};


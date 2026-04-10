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
  /** 主料：肉禽蛋蔬豆谷等 */
  mainIngredients: RecipeIngredient[];
  /** 辅料：调料、油盐糖酱、淀粉、葱姜蒜等 */
  auxiliaryIngredients: RecipeIngredient[];
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


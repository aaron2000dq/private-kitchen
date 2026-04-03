import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { RecipesListClient } from "../recipesListClient";

export default function RecipesAllPage() {
  return (
    <AppShell>
      <div className="flex items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="font-[var(--font-noto-serif-sc)] text-[26px] tracking-wide">
            菜谱库
          </h1>
          <p className="text-[13px] leading-6 text-[color:var(--muted)]">
            你会做的菜，按自己的方式慢慢积累。
          </p>
        </div>
        <Link href="/recipes/new">
          <Button>新增菜谱</Button>
        </Link>
      </div>

      <div className="mt-8">
        <RecipesListClient />
      </div>
    </AppShell>
  );
}


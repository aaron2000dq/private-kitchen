import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { HomeDateHeader } from "@/components/home/HomeDateHeader";
import { HomeInspirationSection } from "@/components/home/HomeInspirationSection";
import { ClientOnly } from "@/components/common/ClientOnly";
import { TodayRecommendationClient } from "./todayRecommendationClient";

export default function Home() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 md:space-y-8">
        <ClientOnly>
          <HomeDateHeader />
          <TodayRecommendationClient />
          <HomeInspirationSection />
        </ClientOnly>

        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3">
          <ButtonLink href="/recipes/new" className="w-full sm:w-auto">
            新增菜谱
          </ButtonLink>
          <ButtonLink href="/recipes" variant="outline" className="w-full sm:w-auto">
            查看菜谱库
          </ButtonLink>
        </div>

        <div className="pk-panel-plain p-4 sm:p-5">
          <Badge tone="warm">提示</Badge>
          <p className="mt-3 text-[13px] leading-6 text-[color:var(--muted)]">
            首版数据保存在浏览器本地。清理浏览器数据会导致菜谱丢失；后续我们会补充导出/备份。
          </p>
        </div>
      </div>
    </AppShell>
  );
}

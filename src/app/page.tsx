import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { HomeDateHeader } from "@/components/home/HomeDateHeader";
import { HomeInspirationSection } from "@/components/home/HomeInspirationSection";
import { TodayMenuConcierge } from "@/components/home/TodayMenuConcierge";
import { ClientOnly } from "@/components/common/ClientOnly";
import { TodayRecommendationClient } from "./todayRecommendationClient";

export default function Home() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 md:space-y-8">
        <ClientOnly>
          <HomeDateHeader />
          <TodayRecommendationClient />
          <TodayMenuConcierge />
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
          <Badge tone="warm">私密厨房</Badge>
          <p className="mt-3 text-[13px] leading-6 text-[color:var(--muted)]">
            菜谱和今日菜单保存在本机浏览器，适合私人厨房先轻量使用。正式收费版可以继续扩展云备份、多人点单和微信小程序同步。
          </p>
        </div>
      </div>
    </AppShell>
  );
}

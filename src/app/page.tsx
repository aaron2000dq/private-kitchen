import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { HomeDateHeader } from "@/components/home/HomeDateHeader";
import { HomeInspirationSection } from "@/components/home/HomeInspirationSection";
import { ClientOnly } from "@/components/common/ClientOnly";
import Link from "next/link";
import { TodayRecommendationClient } from "./todayRecommendationClient";

export default function Home() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-10">
        <ClientOnly>
          <HomeDateHeader />
          <TodayRecommendationClient />
          <HomeInspirationSection />
        </ClientOnly>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/recipes/new">
            <Button>新增菜谱</Button>
          </Link>
          <Link href="/recipes/all">
            <Button variant="outline">查看所有菜谱</Button>
          </Link>
        </div>

        <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper)] p-6">
          <Badge tone="warm">提示</Badge>
          <p className="mt-3 text-[13px] leading-7 text-[color:var(--muted)]">
            首版数据保存在浏览器本地。清理浏览器数据会导致菜谱丢失；后续我们会补充导出/备份。
          </p>
        </div>
      </div>
    </AppShell>
  );
}

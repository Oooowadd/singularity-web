import Link from "next/link";
import { Plus } from "lucide-react";

import type { AccountSummary } from "@/lib/dashboard-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AccountsOverview({ accounts }: { accounts: AccountSummary[] }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">我的账号</h2>
        <Button variant="ghost" size="sm" render={<Link href="/accounts/new" />}>
          <Plus data-icon="inline-start" />
          新建账号
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => (
          <Link key={a.id} href={`/accounts/${encodeURIComponent(a.slug)}`}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium">
                  <span className="truncate">{a.name}</span>
                  <Badge variant="secondary" className="shrink-0 font-mono text-[10px] uppercase">
                    {a.platform}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
                  <span>{a.projectCount} 个项目</span>
                  <span>{a.clerkVideos} 分析</span>
                  <span>{a.museIdeas} 选题</span>
                  <span>{a.poetScripts} 脚本</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

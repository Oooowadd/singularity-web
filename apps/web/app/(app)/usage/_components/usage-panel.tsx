"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

function QuotaRow({
  label,
  hint,
  used,
  base,
  bonus,
}: {
  label: string;
  hint?: string;
  used: number;
  base: number;
  bonus: number;
}) {
  const limit = base + bonus;
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {used} / {base}
          {bonus > 0 ? ` +${bonus}` : ""}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className={`h-2 rounded-full transition-all ${pct >= 100 ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function UsagePanel() {
  const usage = trpc.access.myUsage.useQuery();
  const [code, setCode] = useState("");
  const redeem = trpc.access.redeem.useMutation({
    onSuccess: (res) => {
      const parts = [
        res.granted.accounts ? `账号 +${res.granted.accounts}` : null,
        res.granted.contents ? `解析 +${res.granted.contents}` : null,
        res.granted.generations ? `生成 +${res.granted.generations}` : null,
      ].filter(Boolean);
      toast.success(`兑换成功：${parts.join("，")}`);
      setCode("");
      void usage.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>本月额度</CardTitle>
          <CardDescription>免费内测套餐，每月 1 日（北京时间）重置</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {usage.data ? (
            <>
              <QuotaRow
                label="账号"
                hint="自有 + 对标账号总数（不按月重置，删除账号可释放名额）"
                used={usage.data.accounts.used}
                base={usage.data.accounts.base}
                bonus={usage.data.accounts.bonus}
              />
              <QuotaRow
                label="解析"
                hint="拆解 / 巡视 / 图文分析的内容条数；超过 10 分钟的长视频按每 10 分钟计 1 条"
                used={usage.data.contents.used}
                base={usage.data.contents.base}
                bonus={usage.data.contents.bonus}
              />
              <QuotaRow
                label="生成"
                hint="写稿、频道圣经、选题分析、单视频 SOP"
                used={usage.data.generations.used}
                base={usage.data.generations.base}
                bonus={usage.data.generations.bonus}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">加载中…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>兑换额度码</CardTitle>
          <CardDescription>兑换的额度进入奖励池，不随月度重置，用完基础额度后自动使用</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SING-XXXX-XXXX"
              className="max-w-xs font-mono"
            />
            <Button
              disabled={redeem.isPending || code.trim().length < 6}
              onClick={() => redeem.mutate({ code })}
            >
              {redeem.isPending ? "兑换中…" : "兑换"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

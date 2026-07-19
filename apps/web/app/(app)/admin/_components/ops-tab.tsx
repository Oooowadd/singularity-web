"use client";

import { Fragment, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type RunStatus = "all" | "active" | "failed" | "stuck";

const STATUS_FILTERS: Array<{ value: RunStatus; label: string }> = [
  { value: "all", label: "全部" },
  { value: "active", label: "进行中" },
  { value: "failed", label: "失败" },
  { value: "stuck", label: "卡住" },
];

const AGENT_LABEL: Record<string, string> = {
  clerk: "拆解",
  muse: "巡视",
  poet: "写稿",
};

const RUN_STATUS_LABEL: Record<string, string> = {
  pending: "等待",
  running: "进行中",
  done: "完成",
  failed: "失败",
};

export function OpsTab() {
  const [status, setStatus] = useState<RunStatus>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const runs = trpc.admin.listRuns.useQuery({ status });
  const rows = runs.data?.rows ?? [];
  const counts = runs.data?.counts ?? { active: 0, stuck: 0, failed24h: 0 };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="进行中" value={counts.active} />
        <StatCard label="卡住（>30 分钟）" value={counts.stuck} alert={counts.stuck > 0} />
        <StatCard label="24h 失败" value={counts.failed24h} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>任务运行</CardTitle>
          <CardDescription>全站近期任务（只读）；卡住 = 进行中且开始超过 30 分钟，是清理 cron 的目标</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f.value}
                size="sm"
                variant={status === f.value ? "default" : "outline"}
                onClick={() => setStatus(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          {rows.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>代理</TableHead>
                  <TableHead>命令</TableHead>
                  <TableHead>用户</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">进度</TableHead>
                  <TableHead>配额</TableHead>
                  <TableHead>开始时间</TableHead>
                  <TableHead>错误</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const expanded = expandedId === r.id;
                  return (
                    <Fragment key={r.id}>
                      <TableRow className={cn(r.stuck && "border-l-2 border-l-destructive bg-destructive/5")}>
                        <TableCell>
                          <Badge variant="outline">{AGENT_LABEL[r.agent] ?? r.agent}</Badge>
                        </TableCell>
                        <TableCell className="max-w-40 truncate text-xs" title={r.command}>
                          {r.command}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.email ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              r.status === "done"
                                ? "success"
                                : r.status === "failed"
                                  ? "destructive"
                                  : r.status === "running"
                                    ? "default"
                                    : "secondary"
                            }
                          >
                            {RUN_STATUS_LABEL[r.status] ?? r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {r.progress}/{r.total}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="flex items-center gap-1">
                            <span className="font-mono">{r.quotaCharged}</span>
                            {r.quotaRefunded ? (
                              <Badge variant="secondary">已退</Badge>
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(r.startedAt).toLocaleString("zh-CN")}
                        </TableCell>
                        <TableCell className="max-w-40 text-xs">
                          {r.errorMessage ? (
                            <button
                              type="button"
                              className="block max-w-40 truncate text-left text-destructive hover:underline"
                              title={r.errorMessage}
                              onClick={() => setExpandedId(expanded ? null : r.id)}
                            >
                              {r.errorMessage}
                            </button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                      {expanded && r.errorMessage ? (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/30">
                            <p className="whitespace-pre-wrap py-1 text-xs">{r.errorMessage}</p>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              {runs.isLoading ? "加载中…" : "暂无任务"}
            </p>
          )}
          {/* TODO: manual refund / cancel actions — read-only this round. */}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <Card className={cn(alert && "border-destructive")}>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("text-2xl font-semibold tabular-nums", alert && "text-destructive")}>
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

"use client";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";

export const STATUS_LABEL: Record<string, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已拒绝",
  blocked: "已停用",
};

export const ROLE_LABEL: Record<string, string> = {
  member: "成员",
  admin: "管理员",
};

export const MINUTE_PRESETS = [50, 100, 300, 600];

export function statusBadge(status: string) {
  const variant =
    status === "approved" ? "success" : status === "pending" ? "secondary" : "destructive";
  return <Badge variant={variant}>{STATUS_LABEL[status] ?? status}</Badge>;
}

export function UserDetailSheet({
  userId,
  onClose,
}: {
  userId: string | null;
  onClose: () => void;
}) {
  const detail = trpc.admin.userDetail.useQuery(
    { userId: userId ?? "" },
    { enabled: !!userId },
  );
  const d = detail.data;
  return (
    <Sheet open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{d?.user.displayName ?? d?.user.email ?? "用户详情"}</SheetTitle>
          <SheetDescription>{d?.user.email}</SheetDescription>
        </SheetHeader>
        {d ? (
          <div className="flex flex-col gap-5 px-4 pb-8 text-sm">
            <div className="flex flex-wrap gap-2">
              {statusBadge(d.user.accessStatus)}
              <Badge variant="outline">{d.user.role === "admin" ? "管理员" : "成员"}</Badge>
              <Badge variant="outline">{d.user.plan}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <span className="text-muted-foreground">注册时间</span>
              <span>{new Date(d.user.createdAt).toLocaleString("zh-CN")}</span>
              <span className="text-muted-foreground">最近登录</span>
              <span>
                {d.user.lastSeenAt ? new Date(d.user.lastSeenAt).toLocaleString("zh-CN") : "—"}
              </span>
              <span className="text-muted-foreground">登录次数</span>
              <span>{d.loginCount}</span>
              <span className="text-muted-foreground">任务次数</span>
              <span>{d.runCount}</span>
              <span className="text-muted-foreground">本月时长</span>
              <span className="font-mono">
                {d.minutes.used} / {d.minutes.base}
                {d.minutes.bonus > 0 ? ` +${d.minutes.bonus}` : ""} 分钟
              </span>
            </div>

            {d.latestRequest ? (
              <div className="flex flex-col gap-1 rounded-md border p-3">
                <span className="text-xs text-muted-foreground">
                  内测申请（{STATUS_LABEL[d.latestRequest.status] ?? d.latestRequest.status}）
                </span>
                <p className="whitespace-pre-wrap">{d.latestRequest.message}</p>
                {d.latestRequest.contact ? (
                  <span className="text-xs text-muted-foreground">
                    联系方式：{d.latestRequest.contact}
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <span className="font-medium">用量（近 6 个月）</span>
              {d.usageByMonth.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>月份</TableHead>
                      <TableHead className="text-right">tokens 入/出</TableHead>
                      <TableHead className="text-right">ASR 分</TableHead>
                      <TableHead className="text-right">成本</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.usageByMonth.map((row) => (
                      <TableRow key={row.month}>
                        <TableCell className="font-mono text-xs">{row.month}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {Number(row.llmInputTokens).toLocaleString()}/
                          {Number(row.llmOutputTokens).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {(Number(row.asrSeconds) / 60).toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          ${Number(row.costUsd).toFixed(3)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-xs text-muted-foreground">暂无用量记录</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-medium">最近登录（10 次）</span>
              {d.logins.length ? (
                <div className="flex flex-col gap-1.5">
                  {d.logins.map((l, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">
                        {new Date(l.createdAt).toLocaleString("zh-CN")}
                      </span>
                      <span className="font-mono">{l.ip ?? "—"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  暂无记录（登录跟踪自本版本上线起生效）
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="px-4 text-sm text-muted-foreground">加载中…</p>
        )}
      </SheetContent>
    </Sheet>
  );
}

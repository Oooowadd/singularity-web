"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";

const STATUS_LABEL: Record<string, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已拒绝",
  blocked: "已停用",
};

function statusBadge(status: string) {
  const variant =
    status === "approved" ? "success" : status === "pending" ? "secondary" : "destructive";
  return <Badge variant={variant}>{STATUS_LABEL[status] ?? status}</Badge>;
}

export function AdminPanel() {
  const utils = trpc.useUtils();
  const requests = trpc.admin.listRequests.useQuery();
  const allowed = trpc.admin.listAllowedEmails.useQuery();
  const usersQuery = trpc.admin.listUsers.useQuery();
  const usage = trpc.admin.usageSummary.useQuery();

  const decide = trpc.admin.decideRequest.useMutation({
    onSuccess: (res, vars) => {
      if (vars.decision === "approve") {
        toast.success(
          res.emailSent ? "已批准，通知邮件已发送" : "已批准（邮件未配置，请人工通知对方）",
        );
      } else {
        toast.success("已拒绝");
      }
      void utils.admin.listRequests.invalidate();
      void utils.admin.listUsers.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const addAllowed = trpc.admin.addAllowedEmail.useMutation({
    onSuccess: () => {
      toast.success("已加入预邀请名单");
      setInviteEmail("");
      void utils.admin.listAllowedEmails.invalidate();
      void utils.admin.listUsers.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const removeAllowed = trpc.admin.removeAllowedEmail.useMutation({
    onSuccess: () => void utils.admin.listAllowedEmails.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  const setAccess = trpc.admin.setUserAccess.useMutation({
    onSuccess: () => {
      toast.success("已更新");
      void utils.admin.listUsers.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const codes = trpc.admin.listCodes.useQuery();
  const [codeForm, setCodeForm] = useState({ contents: "50", generations: "20", accounts: "0" });
  const createCode = trpc.admin.createCode.useMutation({
    onSuccess: (created) => {
      toast.success(`已生成：${created.code}`);
      void utils.admin.listCodes.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const disableCode = trpc.admin.disableCode.useMutation({
    onSuccess: () => void utils.admin.listCodes.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>内测申请</CardTitle>
          <CardDescription>批准后对方即可使用（配置邮件后会自动通知）</CardDescription>
        </CardHeader>
        <CardContent>
          {requests.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>申请人</TableHead>
                  <TableHead>说明</TableHead>
                  <TableHead>联系方式</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{r.displayName ?? "—"}</span>
                        <span className="text-xs text-muted-foreground">{r.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-72 whitespace-pre-wrap text-sm">
                      {r.message}
                    </TableCell>
                    <TableCell className="text-sm">{r.contact ?? "—"}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-right">
                      {r.status === "pending" ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            disabled={decide.isPending}
                            onClick={() => decide.mutate({ requestId: r.id, decision: "approve" })}
                          >
                            批准
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={decide.isPending}
                            onClick={() => decide.mutate({ requestId: r.id, decision: "reject" })}
                          >
                            拒绝
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              {requests.isLoading ? "加载中…" : "暂无申请"}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>预邀请邮箱</CardTitle>
          <CardDescription>名单内的邮箱登录后自动获得内测资格</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="someone@example.com"
              className="max-w-sm"
            />
            <Button
              disabled={addAllowed.isPending || !inviteEmail.includes("@")}
              onClick={() => addAllowed.mutate({ email: inviteEmail })}
            >
              添加
            </Button>
          </div>
          {allowed.data?.length ? (
            <div className="flex flex-wrap gap-2">
              {allowed.data.map((a) => (
                <Badge key={a.email} variant="secondary" className="gap-1">
                  {a.email}
                  <button
                    type="button"
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    onClick={() => removeAllowed.mutate({ email: a.email })}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>用户</CardTitle>
          <CardDescription>全部注册用户与访问状态</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>注册时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(usersQuery.data ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{u.displayName ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>{statusBadge(u.accessStatus)}</TableCell>
                  <TableCell className="text-sm">{u.role === "admin" ? "管理员" : "成员"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString("zh-CN")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {u.accessStatus !== "approved" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={setAccess.isPending}
                          onClick={() => setAccess.mutate({ userId: u.id, accessStatus: "approved" })}
                        >
                          放行
                        </Button>
                      ) : null}
                      {u.accessStatus !== "blocked" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={setAccess.isPending}
                          onClick={() => setAccess.mutate({ userId: u.id, accessStatus: "blocked" })}
                        >
                          停用
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>兑换码</CardTitle>
          <CardDescription>生成后发给用户，在「用量与额度」页兑换；额度进奖励池不随月重置</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            {(
              [
                ["解析（条）", "contents"],
                ["生成（次）", "generations"],
                ["账号（个）", "accounts"],
              ] as const
            ).map(([label, key]) => (
              <div key={key} className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Input
                  value={codeForm[key]}
                  onChange={(e) =>
                    setCodeForm((f) => ({ ...f, [key]: e.target.value.replace(/\D/g, "") }))
                  }
                  className="w-24 font-mono"
                />
              </div>
            ))}
            <Button
              disabled={createCode.isPending}
              onClick={() =>
                createCode.mutate({
                  contents: Number(codeForm.contents) || 0,
                  generations: Number(codeForm.generations) || 0,
                  accounts: Number(codeForm.accounts) || 0,
                  maxUses: 1,
                })
              }
            >
              生成兑换码
            </Button>
          </div>
          {codes.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>码</TableHead>
                  <TableHead>额度</TableHead>
                  <TableHead>使用</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.data.map((c) => {
                  const expired = c.expiresAt && new Date(c.expiresAt) < new Date();
                  const exhausted = c.usedCount >= c.maxUses;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.code}</TableCell>
                      <TableCell className="text-xs">
                        {[
                          c.grant?.contents ? `解析${c.grant.contents}` : null,
                          c.grant?.generations ? `生成${c.grant.generations}` : null,
                          c.grant?.accounts ? `账号${c.grant.accounts}` : null,
                        ]
                          .filter(Boolean)
                          .join(" / ")}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.usedCount}/{c.maxUses}
                      </TableCell>
                      <TableCell>
                        {expired ? (
                          <Badge variant="destructive">已失效</Badge>
                        ) : exhausted ? (
                          <Badge variant="secondary">已用完</Badge>
                        ) : (
                          <Badge variant="success">可用</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!expired && !exhausted ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={disableCode.isPending}
                            onClick={() => disableCode.mutate({ codeId: c.id })}
                          >
                            作废
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>用量</CardTitle>
          <CardDescription>按用户按月的资源消耗与估算成本（内部遥测）</CardDescription>
        </CardHeader>
        <CardContent>
          {usage.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>月份</TableHead>
                  <TableHead>用户</TableHead>
                  <TableHead className="text-right">LLM tokens</TableHead>
                  <TableHead className="text-right">ASR 分钟</TableHead>
                  <TableHead className="text-right">抓取调用</TableHead>
                  <TableHead className="text-right">估算成本</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.data.map((row) => (
                  <TableRow key={`${row.month}-${row.userId}`}>
                    <TableCell className="font-mono text-xs">{row.month}</TableCell>
                    <TableCell className="text-sm">{row.email}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {Number(row.llmTokens).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {(Number(row.asrSeconds) / 60).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {Number(row.scrapeCalls).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      ${Number(row.costUsd).toFixed(3)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              {usage.isLoading ? "加载中…" : "暂无用量数据（新任务运行后开始记录）"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

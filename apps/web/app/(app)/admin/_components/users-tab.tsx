"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { APP_VERSION } from "@/lib/version";

import { ROLE_LABEL, STATUS_LABEL, statusBadge, UserDetailSheet } from "./shared";

const CURRENT_MINOR = APP_VERSION.split(".").slice(0, 2).join(".");
const minorOf = (v: string) => v.split(".").slice(0, 2).join(".");

const ACCESS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "all", label: "全部" },
  { value: "pending", label: "待审核" },
  { value: "approved", label: "已通过" },
  { value: "blocked", label: "已停用" },
];

export function UsersTab({ selfId }: { selfId: string }) {
  const utils = trpc.useUtils();
  const usersQuery = trpc.admin.listUsers.useQuery();
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [accessFilter, setAccessFilter] = useState("all");

  const setAccess = trpc.admin.setUserAccess.useMutation({
    onSuccess: (res, vars) => {
      if (vars.accessStatus === "approved") {
        toast.success(
          res.emailSent ? "已通过，通知邮件已发送" : "已通过（邮件未配置，请人工通知对方）",
        );
      } else {
        toast.success("已更新");
      }
      void utils.admin.listUsers.invalidate();
      void utils.admin.listRequests.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const setRole = trpc.admin.setUserRole.useMutation({
    onSuccess: () => {
      toast.success("角色已更新");
      void utils.admin.listUsers.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteUser = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("用户已删除");
      void utils.admin.listUsers.invalidate();
      void utils.admin.listRequests.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const q = search.trim().toLowerCase();
  const filtered = (usersQuery.data ?? []).filter((u) => {
    if (accessFilter !== "all" && u.accessStatus !== accessFilter) return false;
    if (!q) return true;
    return [u.email, u.displayName].some((v) => v?.toLowerCase().includes(q));
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>用户</CardTitle>
        <CardDescription>状态与角色可直接切换；点击「详情」查看用量、登录记录与申请信息</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索邮箱 / 昵称"
            className="max-w-xs"
          />
          <Select value={accessFilter} onValueChange={(v) => setAccessFilter(v ?? "all")}>
            <SelectTrigger size="sm" className="w-28">
              {ACCESS_FILTERS.find((f) => f.value === accessFilter)?.label ?? "全部"}
            </SelectTrigger>
            <SelectContent>
              {ACCESS_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>角色</TableHead>
              <TableHead className="text-right">本月时长</TableHead>
              <TableHead>版本</TableHead>
              <TableHead>最近登录</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => {
              const isSelf = u.id === selfId;
              const stale = !!u.lastSeenVersion && minorOf(u.lastSeenVersion) !== CURRENT_MINOR;
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>
                        {u.displayName ?? "—"}
                        {isSelf ? (
                          <span className="ml-1 text-xs text-muted-foreground">(我)</span>
                        ) : null}
                      </span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isSelf ? (
                      statusBadge(u.accessStatus)
                    ) : (
                      <Select
                        value={u.accessStatus}
                        onValueChange={(v) =>
                          setAccess.mutate({
                            userId: u.id,
                            accessStatus: v as "pending" | "approved" | "blocked",
                          })
                        }
                      >
                        <SelectTrigger size="sm" className="w-28">
                          {STATUS_LABEL[u.accessStatus] ?? u.accessStatus}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="approved">已通过</SelectItem>
                          <SelectItem value="pending">待审核</SelectItem>
                          <SelectItem value="blocked">已停用</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    {isSelf ? (
                      <span className="text-sm">管理员</span>
                    ) : (
                      <Select
                        value={u.role}
                        onValueChange={(v) =>
                          setRole.mutate({ userId: u.id, role: v as "member" | "admin" })
                        }
                      >
                        <SelectTrigger size="sm" className="w-28">
                          {ROLE_LABEL[u.role] ?? u.role}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">成员</SelectItem>
                          <SelectItem value="admin">管理员</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {Number(u.minutesUsed)}
                    {Number(u.bonusMinutes) > 0 ? ` (+${Number(u.bonusMinutes)})` : ""} 分
                  </TableCell>
                  <TableCell>
                    {u.lastSeenVersion ? (
                      stale ? (
                        <Badge
                          variant="outline"
                          className="font-mono text-xs text-muted-foreground"
                          title="未看新版"
                        >
                          {u.lastSeenVersion}
                        </Badge>
                      ) : (
                        <span className="font-mono text-xs">{u.lastSeenVersion}</span>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString("zh-CN") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setDetailUserId(u.id)}>
                        详情
                      </Button>
                      {!isSelf ? (
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={deleteUser.isPending}
                              />
                            }
                          >
                            删除
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>删除用户 {u.email}？</AlertDialogTitle>
                              <AlertDialogDescription>
                                将永久删除该用户及其全部账号、项目、分析、SOP、圣经、选题与脚本，不可恢复。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteUser.mutate({ userId: u.id })}>
                                确认删除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {usersQuery.data && filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">没有匹配的用户</p>
        ) : null}

        <UserDetailSheet userId={detailUserId} onClose={() => setDetailUserId(null)} />
      </CardContent>
    </Card>
  );
}

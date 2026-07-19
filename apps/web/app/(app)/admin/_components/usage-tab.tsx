"use client";

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

export function UsageTab() {
  const usage = trpc.admin.usageSummary.useQuery();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>套餐与额度规则</CardTitle>
          <CardDescription>
            「本月时长」是免费套餐的判断依据；下面是每种操作扣多少分钟（与 /usage 用户侧一致）
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
          <div className="flex justify-between sm:col-span-2">
            <span className="font-medium">免费套餐</span>
            <span className="text-muted-foreground">
              300 分钟/月（每月 1 日北京时间重置）· 账号上限 30 个
            </span>
          </div>
          <div className="flex justify-between">
            <span>分析视频</span>
            <span className="font-mono text-muted-foreground">实际时长（向上取整，≥1）</span>
          </div>
          <div className="flex justify-between">
            <span>分析图文笔记</span>
            <span className="font-mono text-muted-foreground">5 分钟/篇</span>
          </div>
          <div className="flex justify-between">
            <span>写稿</span>
            <span className="font-mono text-muted-foreground">目标时长（≥2）</span>
          </div>
          <div className="flex justify-between">
            <span>频道圣经</span>
            <span className="font-mono text-muted-foreground">5 分钟</span>
          </div>
          <div className="flex justify-between">
            <span>文件导入圣经</span>
            <span className="font-mono text-muted-foreground">10 分钟/次</span>
          </div>
          <div className="flex justify-between">
            <span>选题分析</span>
            <span className="font-mono text-muted-foreground">3 分钟</span>
          </div>
          <div className="flex justify-between">
            <span>单视频 SOP</span>
            <span className="font-mono text-muted-foreground">2 分钟</span>
          </div>
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

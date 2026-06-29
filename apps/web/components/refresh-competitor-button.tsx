"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export function RefreshCompetitorButton({
  competitorAccountId,
  iconOnly = false,
}: {
  competitorAccountId: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const refresh = trpc.competitors.refreshStats.useMutation({
    onSuccess: () => {
      toast.success("已刷新账号信息");
      utils.invalidate();
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Button
      size="sm"
      variant={iconOnly ? "ghost" : "outline"}
      disabled={refresh.isPending}
      onClick={() => refresh.mutate({ competitorAccountId })}
      title="刷新粉丝数、头像等账号信息"
    >
      <RefreshCw data-icon={iconOnly ? undefined : "inline-start"} className={refresh.isPending ? "animate-spin" : undefined} />
      {iconOnly ? null : "刷新"}
    </Button>
  );
}

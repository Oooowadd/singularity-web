"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export function RefreshOwnAccountButton({ channelId }: { channelId: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const refresh = trpc.channels.refreshStats.useMutation({
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
      variant="outline"
      disabled={refresh.isPending}
      onClick={() => refresh.mutate({ channelId })}
      title="刷新粉丝数等账号信息"
    >
      <RefreshCw data-icon="inline-start" className={refresh.isPending ? "animate-spin" : undefined} />
      刷新
    </Button>
  );
}

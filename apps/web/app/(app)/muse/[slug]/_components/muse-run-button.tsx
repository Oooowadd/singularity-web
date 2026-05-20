"use client";

import { Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

type Props = {
  channelId: string;
  channelName: string;
  competitorCount: number;
  isActive: boolean;
};

export function MuseRunButton({ channelId, channelName, competitorCount, isActive }: Props) {
  const router = useRouter();
  const startMutation = trpc.muse.startMonitor.useMutation({
    onSuccess: () => {
      toast.info(`已开始巡视「${channelName}」的对标频道`);
      router.refresh();
    },
    onError: (err) => toast.error(`启动失败：${err.message}`),
  });

  const handleStart = () => {
    startMutation.mutate({
      channelId,
      maxVideosPerCompetitor: 10,
      numIdeasPerVideo: 5,
      language: "zh",
    });
  };

  const disabled = startMutation.isPending || isActive || competitorCount === 0;

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={handleStart} disabled={disabled} size="sm">
        {isActive ? (
          <Loader2 data-icon="inline-start" className="animate-spin" />
        ) : (
          <Play data-icon="inline-start" />
        )}
        {isActive ? "巡视中…" : "开始巡视"}
      </Button>
      {competitorCount === 0 ? (
        <span className="text-xs text-muted-foreground">先添加对标频道再启动</span>
      ) : null}
    </div>
  );
}

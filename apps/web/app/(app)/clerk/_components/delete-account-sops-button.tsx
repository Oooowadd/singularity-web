"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { trpc } from "@/lib/trpc";

type Owner = { channelId: string } | { competitorAccountId: string };

export function DeleteAccountSopsButton({ owner, name }: { owner: Owner; name: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [pending, setPending] = useState(false);

  const remove = trpc.clerk.deleteSopsForOwner.useMutation({
    onSuccess: (r) => {
      toast.success(`已清空「${name}」的 ${r.deleted} 份 SOP`);
      utils.invalidate();
      router.refresh();
    },
    onError: (err) => toast.error(`清空失败：${err.message}`),
    onSettled: () => setPending(false),
  });

  return (
    <ConfirmDialog
      title={`清空「${name}」的全部 SOP？`}
      description="删除这个账号的所有 SOP（不影响已分析的视频）。当前选用了这些 SOP 写稿的项目会被解除绑定。删除后无法恢复。"
      confirmLabel="清空 SOP"
      disabled={pending}
      onConfirm={() => {
        setPending(true);
        remove.mutate(owner);
      }}
      trigger={
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          disabled={pending}
        >
          {pending ? (
            <Loader2 data-icon="inline-start" className="size-3 animate-spin" />
          ) : (
            <Trash2 data-icon="inline-start" className="size-3" />
          )}
          清空 SOP
        </Button>
      }
    />
  );
}

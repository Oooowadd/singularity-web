"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

type Props = {
  projectId: string;
  name: string;
  accountSlug: string;
};

export function DeleteProjectButton({ projectId, name, accountSlug }: Props) {
  const router = useRouter();
  const deleteMutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      toast.success(`已删除项目「${name}」`);
      router.push(`/accounts/${encodeURIComponent(accountSlug)}`);
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            aria-label={`删除项目 ${name}`}
          />
        }
      >
        <Trash2 />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除项目？</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-mono">{name}</span>{" "}
            及其选题、自定义选题、脚本将被永久删除，无法恢复。账号与 SOP 库不受影响。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteMutation.mutate({ projectId })}
            disabled={deleteMutation.isPending}
          >
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

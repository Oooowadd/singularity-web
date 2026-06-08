import Link from "next/link";
import { ArrowRightIcon, SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type Step = {
  title: string;
  description: string;
  cta: string;
  href: string;
};

type Props = {
  channelCount: number;
  clerkTotal: number;
  museTotal: number;
  poetTotal: number;
  pendingMuseIdeas: number;
};

function pickStep({
  channelCount,
  clerkTotal,
  museTotal,
  poetTotal,
  pendingMuseIdeas,
}: Props): Step {
  if (channelCount === 0) {
    return {
      title: "先建一个自己的频道",
      description: "Singularity 围绕你自己的频道运转 — 配置好定位和对标后，三个 agent 才能工作。",
      cta: "创建频道",
      href: "/accounts/new",
    };
  }
  if (clerkTotal === 0) {
    return {
      title: "让 Clerk 拆解对标频道",
      description: `你有 ${channelCount} 个频道还没有 SOP — Clerk 会分析对标频道的爆款机制，Muse 和 Poet 后续都靠它输出的套路。`,
      cta: "去 Clerk",
      href: "/clerk",
    };
  }
  if (museTotal === 0) {
    return {
      title: "让 Muse 巡视一遍对标",
      description: "Muse 会抓取最新对标视频、提取爆款触发因素，并按你的频道定位生成可写的选题。",
      cta: "去 Muse",
      href: "/muse",
    };
  }
  if (pendingMuseIdeas > 0 && poetTotal === 0) {
    return {
      title: "审一下选题再开始写稿",
      description: `你有 ${pendingMuseIdeas} 个未审选题。挑出值得写的，Poet 就能按频道圣经把它写出来。`,
      cta: "去审选题",
      href: "/muse",
    };
  }
  if (poetTotal === 0) {
    return {
      title: "用 Poet 写第一篇稿",
      description: "选一个你审过的选题，Poet 会按频道圣经 + 爆款套路写出可发布的脚本，60 秒出稿。",
      cta: "去 Poet",
      href: "/poet",
    };
  }
  if (pendingMuseIdeas >= 5) {
    return {
      title: `你有 ${pendingMuseIdeas} 个未审选题`,
      description: "处理一下选题积压，决定哪些值得写、哪些归档。审完就能直接派给 Poet 写稿。",
      cta: "去审选题",
      href: "/muse",
    };
  }
  return {
    title: "继续推进",
    description: `已经全员上线：${clerkTotal} 个分析、${museTotal} 个选题、${poetTotal} 个脚本。下一步可以扩对标频道或回到任一 agent 继续。`,
    cta: "去 Muse",
    href: "/muse",
  };
}

export function NextStepCard(props: Props) {
  const step = pickStep(props);
  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden rounded-lg border-2 border-dashed border-poet/40 bg-poet/5 p-5">
      <div className="flex items-center gap-2">
        <SparklesIcon className="size-4 text-poet" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Next step
        </span>
      </div>
      <h3 className="text-base font-semibold leading-tight">{step.title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
      <Button render={<Link href={step.href} />} size="sm" className="mt-auto self-start">
        {step.cta}
        <ArrowRightIcon data-icon="inline-end" />
      </Button>
    </div>
  );
}

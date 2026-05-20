"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const AUTO_REFRESH_MS = 30_000;

export function DashboardRefresher() {
  const router = useRouter();
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const auto = setInterval(() => {
      router.refresh();
      setLastRefreshedAt(Date.now());
    }, AUTO_REFRESH_MS);
    return () => clearInterval(auto);
  }, [router]);

  const ageS = Math.max(0, Math.floor((now - lastRefreshedAt) / 1000));
  const label = ageS < 60 ? `${ageS}s 前` : `${Math.floor(ageS / 60)}m 前`;

  const handleClick = () => {
    setIsRefreshing(true);
    router.refresh();
    setLastRefreshedAt(Date.now());
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="font-mono text-[10px]">更新于 {label}</span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0"
        onClick={handleClick}
        disabled={isRefreshing}
        title="刷新数据"
      >
        <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}

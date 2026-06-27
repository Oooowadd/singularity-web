import Link from "next/link";

// 频道圣经 indicator — account-level, read-only everywhere except the account bible page.
// "header" = compact pill for the top context-header (persists across the account's pages);
// "band" = a light read-only band for the project hub.
export function BibleChip({
  name,
  manageHref,
  variant = "header",
}: {
  name: string | null;
  manageHref: string;
  variant?: "header" | "band";
}) {
  if (variant === "band") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-dashed bg-muted/30 px-3 py-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5 text-xs">
            <span>📖</span>
            <span className="shrink-0 text-muted-foreground">频道圣经：</span>
            <span className="truncate font-medium">{name ?? "未设置"}</span>
          </span>
          <span className="text-[10px] text-muted-foreground">账号通用 · 在这里只读</span>
        </div>
        <Link
          href={manageHref}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          {name ? "在账号页管理 →" : "去生成 →"}
        </Link>
      </div>
    );
  }
  return (
    <Link
      href={manageHref}
      title="账号通用圣经 · 全部项目共用，点击管理"
      className={`flex min-w-0 shrink items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] transition-colors ${
        name
          ? "text-muted-foreground hover:text-foreground"
          : "border-amber-500/50 text-amber-600 dark:text-amber-400"
      }`}
    >
      <span>📖</span>
      <span className="max-w-[10rem] truncate">{name ? `圣经·${name}` : "圣经·未设置"}</span>
    </Link>
  );
}

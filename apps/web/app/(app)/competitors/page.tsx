import { CompetitorsManager } from "./_components/competitors-manager";

export default function CompetitorsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">对标账号</h1>
        <p className="text-sm text-muted-foreground">
          统一管理你关注的对标账号。在项目里绑定后，Muse 会定期巡视它们并生成选题。
        </p>
      </div>
      <CompetitorsManager />
    </div>
  );
}

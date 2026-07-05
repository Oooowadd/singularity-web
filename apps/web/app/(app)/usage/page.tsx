import { UsagePanel } from "./_components/usage-panel";

export default function UsagePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">用量与额度</h1>
        <p className="text-sm text-muted-foreground">
          内测期免费额度按月重置；额度不够可输入兑换码或联系我们
        </p>
      </div>
      <UsagePanel />
    </div>
  );
}

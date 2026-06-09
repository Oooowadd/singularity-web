import { ChannelsList } from "./_components/channels-list";

export default function ChannelsPage() {
  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-6 p-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">账号</h1>
      </header>
      <ChannelsList />
    </div>
  );
}

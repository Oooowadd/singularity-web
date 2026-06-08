import { permanentRedirect } from "next/navigation";

export default async function ChannelSlugRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/accounts/${encodeURIComponent(slug)}`);
}

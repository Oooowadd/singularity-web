import { permanentRedirect } from "next/navigation";

// §5: the explicit account namespace owns the project hub at /accounts/[slug]/projects/[project].
// Bare /projects/[slug] 308s to the account hub.
export default async function ProjectHubRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/accounts/${encodeURIComponent(slug)}`);
}

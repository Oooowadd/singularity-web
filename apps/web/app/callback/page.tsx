import { handleSignIn } from "@logto/next/server-actions";

import { Splash } from "@/components/splash";
import { logtoConfig } from "@/lib/logto";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toURLSearchParams(
  params: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") sp.append(key, value);
    else if (Array.isArray(value)) value.forEach((v) => sp.append(key, v));
  }
  return sp;
}

export default async function CallbackPage({ searchParams }: Props) {
  const params = await searchParams;
  await handleSignIn(logtoConfig, toURLSearchParams(params));
  return <Splash redirectTo="/" />;
}

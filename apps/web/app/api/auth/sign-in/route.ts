import { signIn } from "@logto/next/server-actions";

import { logtoConfig } from "@/lib/logto";

export async function GET() {
  await signIn(logtoConfig);
  return new Response(null, { status: 200 });
}

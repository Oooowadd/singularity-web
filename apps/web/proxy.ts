import { getLogtoContext } from "@logto/next/server-actions";
import { NextResponse, type NextRequest } from "next/server";

import { logtoConfig } from "@/lib/logto";

export async function proxy(request: NextRequest) {
  const { isAuthenticated } = await getLogtoContext(logtoConfig);
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }
}

export const config = {
  matcher: [
    "/clerk/:path*",
    "/muse/:path*",
    "/poet/:path*",
    "/channels/:path*",
  ],
};

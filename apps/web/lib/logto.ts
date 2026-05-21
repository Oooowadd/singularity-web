import "server-only";

// Resolve baseUrl with this priority:
//   1. explicit LOGTO_BASE_URL (lets dev override; lets prod bind to a custom domain)
//   2. Vercel-injected VERCEL_PROJECT_PRODUCTION_URL (stable prod alias, auto-updates on domain bind)
//   3. Vercel-injected VERCEL_URL (per-deployment preview URL)
//   4. localhost fallback for `pnpm dev`
function resolveBaseUrl(): string {
  if (process.env.LOGTO_BASE_URL) return process.env.LOGTO_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const logtoConfig = {
  endpoint: process.env.LOGTO_ENDPOINT!,
  appId: process.env.LOGTO_APP_ID!,
  appSecret: process.env.LOGTO_APP_SECRET!,
  baseUrl: resolveBaseUrl(),
  cookieSecret: process.env.LOGTO_COOKIE_SECRET!,
  cookieSecure: process.env.NODE_ENV === "production",
  scopes: ["email", "profile"],
};

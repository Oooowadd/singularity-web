import "server-only";

// baseUrl priority: explicit override → Vercel stable prod alias (auto-updates on domain
// bind) → per-deployment preview URL → localhost dev.
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

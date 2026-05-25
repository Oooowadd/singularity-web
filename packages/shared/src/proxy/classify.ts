import type { ErrorKind } from "./types";

export function classifyError(err: unknown, statusCode?: number): ErrorKind {
  if (statusCode === 403) return "consecutive_403";
  if (statusCode === 407) return "auth_failed";
  const msg = (err as Error)?.message ?? String(err);
  if (/auth(entication)? required|407/i.test(msg)) return "auth_failed";
  if (/timeout|ETIMEDOUT|aborted/i.test(msg)) return "timeout";
  if (/ECONNREFUSED|ENOTFOUND/i.test(msg)) return "other";
  return "other";
}

import type { Instrumentation } from "next";

// Next's own control-flow signals throw — notFound() / redirect() / not-found fallback.
// They are not real errors; logging them would flood the table with every 404/redirect.
const CONTROL_FLOW = /^NEXT_(NOT_FOUND|REDIRECT|HTTP_ERROR_FALLBACK)/;

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const err = error as { message?: unknown; stack?: unknown; digest?: unknown };
  const digest = typeof err.digest === "string" ? err.digest : undefined;
  if (digest && CONTROL_FLOW.test(digest)) return;

  try {
    // Lazy import keeps postgres-js (Node-only) out of edge bundles; a failed import
    // in an edge context is swallowed here rather than surfacing as a new error.
    const { logServerError } = await import("./lib/log-error");
    await logServerError({
      message: typeof err.message === "string" ? err.message : String(error),
      stack: typeof err.stack === "string" ? err.stack : null,
      route: request.path,
      method: request.method,
      kind: context.routerKind,
      digest,
      meta: { routePath: context.routePath, renderSource: context.renderSource },
    });
  } catch (e) {
    // Swallow so observability never breaks the request, but leave a function-log trace.
    console.error("onRequestError capture failed:", e);
  }
};

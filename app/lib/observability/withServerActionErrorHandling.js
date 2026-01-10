import { headers } from "next/headers";
import { getRequestIdFromHeaders, reportError } from "./reportError";

async function getRequestIdFromServerAction() {
  try {
    if (typeof headers !== "function") return null;
    const h = await headers();
    return getRequestIdFromHeaders(h);
  } catch {
    return null;
  }
}

export function withServerActionErrorHandling(action, options) {
  const opts = options || {};

  return async function wrapped(...args) {
    try {
      return await action(...args);
    } catch (error) {
      const requestId = await getRequestIdFromServerAction();

      let dynamicCtx = null;
      if (typeof opts.getContext === "function") {
        try {
          dynamicCtx = await opts.getContext({ error, requestId, args });
        } catch {
          dynamicCtx = null;
        }
      }

      const ctx = {
        ...(dynamicCtx && typeof dynamicCtx === "object" ? dynamicCtx : {}),
        route: opts.route || dynamicCtx?.route || null,
        method: opts.method || dynamicCtx?.method || null,
        status: opts.status || dynamicCtx?.status || 500,
        requestId,
        userId: opts.userId || dynamicCtx?.userId || null,
        tag: opts.tag || dynamicCtx?.tag || "server_action",
      };

      const { requestId: finalRequestId, fingerprint } = await reportError(error, ctx);

      if (typeof opts.onError === "function") {
        return await opts.onError({
          error,
          requestId: finalRequestId || requestId || null,
          fingerprint,
          ctx,
          args,
        });
      }

      throw error;
    }
  };
}

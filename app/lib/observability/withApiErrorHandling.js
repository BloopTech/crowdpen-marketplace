import { NextResponse } from "next/server";
import { getRequestIdFromHeaders, reportError } from "./reportError";

export function withApiErrorHandling(handler, options) {
  const opts = options || {};

  return async function wrapped(request, params) {
    try {
      return await handler(request, params);
    } catch (error) {
      const requestIdFromHeaders = getRequestIdFromHeaders(request?.headers) || null;

      let dynamicCtx = null;
      if (typeof opts.getContext === "function") {
        try {
          dynamicCtx = await opts.getContext({
            request,
            params,
            error,
            requestId: requestIdFromHeaders,
          });
        } catch {
          dynamicCtx = null;
        }
      }

      const ctx = {
        ...(dynamicCtx && typeof dynamicCtx === "object" ? dynamicCtx : {}),
        route: opts.route || dynamicCtx?.route || null,
        method: opts.method || request?.method || dynamicCtx?.method || null,
        status: opts.status || dynamicCtx?.status || 500,
        requestId: requestIdFromHeaders,
        userId: opts.userId || dynamicCtx?.userId || null,
        tag: opts.tag || dynamicCtx?.tag || "api",
      };

      const { requestId: finalRequestId, fingerprint } = await reportError(error, ctx);

      if (typeof opts.onError === "function") {
        return await opts.onError({
          request,
          params,
          error,
          requestId: finalRequestId || requestIdFromHeaders || null,
          fingerprint,
          ctx,
        });
      }

      return NextResponse.json(
        {
          status: "error",
          message: "Server error",
          requestId: finalRequestId || null,
          errorId: fingerprint,
        },
        { status: 500 }
      );
    }
  };
}

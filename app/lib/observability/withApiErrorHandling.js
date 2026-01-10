import { NextResponse } from "next/server";
import { getRequestIdFromHeaders, reportError } from "./reportError";

export function withApiErrorHandling(handler, options) {
  const opts = options || {};

  return async function wrapped(request, params) {
    try {
      return await handler(request, params);
    } catch (error) {
      const requestId = getRequestIdFromHeaders(request?.headers) || null;

      const { requestId: finalRequestId, fingerprint } = await reportError(error, {
        route: opts.route || null,
        method: opts.method || request?.method || null,
        status: opts.status || 500,
        requestId,
        userId: opts.userId || null,
        tag: opts.tag || "api",
      });

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

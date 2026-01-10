import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getRequestIdFromHeaders, reportError } from "../../../lib/observability/reportError";

export const runtime = "nodejs";

export async function POST(request) {
  const requestId = getRequestIdFromHeaders(request?.headers) || null;

  let userId = null;
  try {
    const session = await getServerSession(authOptions);
    userId = session?.user?.id || null;
  } catch {
    userId = null;
  }

  try {
    const body = await request.json().catch(() => ({}));

    const message =
      typeof body?.message === "string" && body.message
        ? body.message.slice(0, 2000)
        : "ClientError";

    const error = new Error(message);

    if (typeof body?.errorName === "string" && body.errorName) {
      error.name = body.errorName.slice(0, 200);
    }

    if (typeof body?.stack === "string" && body.stack) {
      error.stack = body.stack.slice(0, 8000);
    }

    const tag =
      typeof body?.tag === "string" && body.tag
        ? body.tag.slice(0, 100)
        : "client_error";

    const url = typeof body?.url === "string" && body.url ? body.url : null;
    const userAgent =
      typeof body?.userAgent === "string" && body.userAgent
        ? body.userAgent
        : null;

    const extra = {
      ...(body?.extra && typeof body.extra === "object" ? body.extra : {}),
      ...(url ? { url: url.slice(0, 2048) } : {}),
      ...(userAgent ? { userAgent: userAgent.slice(0, 512) } : {}),
    };

    await reportError(error, {
      tag,
      route: "client",
      method: "CLIENT",
      status: 500,
      requestId,
      userId,
      extra,
    });
  } catch (e) {
    try {
      await reportError(e, {
        tag: "client_error_route_failed",
        route: "/api/observability/client-error",
        method: "POST",
        status: 500,
        requestId,
        userId,
      });
    } catch {
    }
  }

  return new NextResponse(null, { status: 204 });
}

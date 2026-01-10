export async function reportClientError(error, context = {}) {
  try {
    const err =
      error instanceof Error
        ? error
        : new Error(
            typeof error === "string"
              ? error
              : (error && typeof error === "object" && "message" in error
                    ? String(error.message)
                    : "ClientError")
          );

    const payload = {
      errorName: err?.name || "Error",
      message: err?.message || "",
      stack: err?.stack || null,
      tag: context?.tag || null,
      url:
        context?.url ||
        (typeof window !== "undefined" ? window.location.href : null),
      userAgent:
        context?.userAgent ||
        (typeof navigator !== "undefined" ? navigator.userAgent : null),
      extra: context?.extra && typeof context.extra === "object" ? context.extra : null,
    };

    await fetch("/api/observability/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
  }
}

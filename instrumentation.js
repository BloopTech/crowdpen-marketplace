import { reportError } from "./app/lib/observability/reportError";

export async function register() {
  if (globalThis.__crowdpenInstrumentationInstalled) return;
  globalThis.__crowdpenInstrumentationInstalled = true;

  process.on("unhandledRejection", async (reason) => {
    try {
      const err = reason instanceof Error ? reason : new Error(String(reason));
      await reportError(err, { tag: "unhandledRejection", status: 500 });
    } catch {
      // best-effort
    }
  });

  process.on("uncaughtException", async (error) => {
    try {
      await reportError(error, { tag: "uncaughtException", status: 500 });
    } catch {
      // best-effort
    }
  });
}

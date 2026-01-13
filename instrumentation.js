export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const [{ registerNodeInstrumentation }] = await Promise.all([
    import("./instrumentation.node.js"),
  ]);

  await registerNodeInstrumentation();

  if (process.env.ENABLE_PG_BOSS === "true") {
    Promise.all([import("./workers/cleanupProductDraftsWorker.js")])
      .then(([workerModule]) => {
        if (!workerModule?.registerCleanupProductDraftsWorker) {
          throw new Error("registerCleanupProductDraftsWorker export not found");
        }
        return workerModule.registerCleanupProductDraftsWorker();
      })
      .catch((error) => {
        console.error(
          JSON.stringify({
            level: "error",
            event: "instrumentation.worker_start_failed",
            worker: "cleanupProductDrafts",
            message: error?.message || String(error),
          })
        );
      });
  }
}

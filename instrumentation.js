export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const [{ registerNodeInstrumentation }] = await Promise.all([
    import("./instrumentation.node.js"),
  ]);

  await registerNodeInstrumentation();

  if (process.env.ENABLE_PG_BOSS === "true") {
    const [{ registerCleanupProductDraftsWorker }] = await Promise.all([
      import("./workers/cleanupProductDraftsWorker.js"),
    ]);

    await registerCleanupProductDraftsWorker();
  }
}

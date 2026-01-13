import pg from "pg";
import { PgBoss } from "pg-boss";
import { reportError } from "../app/lib/observability/reportError.js";

const QUEUE_NAME = "marketplace.cleanupProductDrafts";
const DEFAULT_SCHEMA = "pgboss_v11";
const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_CRON = "0 4 * * 1";
const DEFAULT_TZ = "UTC";
const DEFAULT_TIME_BUDGET_MS = 9_000;

const workerStateSymbol = Symbol.for("crowdpen.marketplace.cleanupProductDraftsWorker");
const state =
  globalThis[workerStateSymbol] ||
  (globalThis[workerStateSymbol] = {
    startPromise: null,
    boss: null,
    pool: null,
    options: null,
  });

if (!PgBoss) {
  throw new Error("PgBoss export not found in pg-boss module");
}

function getEnvNumber(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

function isWorkerEnabled() {
  const flag = process.env.ENABLE_PRODUCT_DRAFT_CLEANUP_WORKER;
  return flag !== "false";
}

export async function registerCleanupProductDraftsWorker(options = {}) {
  if (!isWorkerEnabled()) return;
  if (state.startPromise) return state.startPromise;

  state.startPromise = startCleanupWorker(options).catch((error) => {
    state.startPromise = null;
    throw error;
  });

  return state.startPromise;
}

export async function stopCleanupProductDraftsWorker() {
  if (state.boss) {
    try {
      await state.boss.stop();
    } catch {
    }
    state.boss = null;
  }

  if (state.pool) {
    try {
      await state.pool.end();
    } catch {
    }
    state.pool = null;
  }

  state.startPromise = null;
}

async function startCleanupWorker(options) {
  const dbUrl = process.env.DB_URL;
  if (!dbUrl) {
    throw new Error("DB_URL environment variable not found");
  }

  const retentionDays = getEnvNumber(
    "PRODUCT_DRAFT_RETENTION_DAYS",
    DEFAULT_RETENTION_DAYS
  );
  const batchSize = getEnvNumber(
    "PRODUCT_DRAFT_CLEANUP_BATCH_SIZE",
    DEFAULT_BATCH_SIZE
  );
  const cron = process.env.PRODUCT_DRAFT_CLEANUP_CRON || DEFAULT_CRON;
  const tz = process.env.PRODUCT_DRAFT_CLEANUP_TZ || DEFAULT_TZ;
  const timeBudgetMs = getEnvNumber(
    "PRODUCT_DRAFT_CLEANUP_JOB_BUDGET_MS",
    DEFAULT_TIME_BUDGET_MS
  );
  const schema = process.env.PG_BOSS_SCHEMA || DEFAULT_SCHEMA;

  const { Pool } = pg;
  state.pool = new Pool({ connectionString: dbUrl });
  state.options = { batchSize, retentionDays, cron, tz, timeBudgetMs, schema };

  const boss = new PgBoss({ connectionString: dbUrl, schema });
  state.boss = boss;

  boss.on("error", (err) => {
    reportError(err, {
      tag: "pgboss_error",
      route: "instrumentation.cleanupProductDrafts",
      method: "pgboss",
      status: 500,
      extra: { queue: QUEUE_NAME },
    }).catch(() => {});
  });

  await boss.start();
  await boss.createQueue(QUEUE_NAME, { policy: "standard" });
  await boss.schedule(QUEUE_NAME, cron, { retentionDays }, { tz });

  await boss.work(
    QUEUE_NAME,
    { concurrency: 1, pollingIntervalSeconds: 5 },
    async (job) => {
      try {
        const { deleted, iterations, mightHaveMore } = await deleteOldDrafts({
          batchSize,
          retentionDays,
        });

        if (mightHaveMore) {
          await boss.send(QUEUE_NAME, { continuation: true });
        }

        console.log(
          JSON.stringify({
            level: "info",
            event: "marketplace.drafts.cleanup",
            jobId: job?.id,
            deleted,
            retentionDays,
            iterations,
            mightHaveMore,
          })
        );

        return { deleted, mightHaveMore };
      } catch (error) {
        await reportError(error, {
          tag: "cleanup_product_drafts_failed",
          route: "instrumentation.cleanupProductDrafts",
          method: "job",
          status: 500,
          extra: { queue: QUEUE_NAME, jobId: job?.id },
        });
        throw error;
      }
    }
  );

  console.log(
    JSON.stringify({
      level: "info",
      event: "marketplace.drafts.cleanup_worker_started",
      queue: QUEUE_NAME,
      schema,
      cron,
      tz,
      retentionDays,
      batchSize,
      timeBudgetMs,
      source: "instrumentation",
    })
  );

  return boss;
}

async function deleteOldDrafts({ batchSize, retentionDays }) {
  if (!state.pool) throw new Error("Cleanup pool not initialized");

  const res = await state.pool.query(
    `WITH to_delete AS (
      SELECT id
      FROM public.marketplace_product_drafts
      WHERE "updatedAt" < (now() - ($2::int * interval '1 day'))
      ORDER BY "updatedAt" ASC
      LIMIT $1
    )
    DELETE FROM public.marketplace_product_drafts d
    USING to_delete t
    WHERE d.id = t.id
    RETURNING d.id`,
    [batchSize, retentionDays]
  );

  const deleted = Number(res.rowCount || 0);
  let mightHaveMore = false;

  if (deleted === batchSize) {
    const existsRes = await state.pool.query(
      `SELECT 1
       FROM public.marketplace_product_drafts
       WHERE "updatedAt" < (now() - ($1::int * interval '1 day'))
       LIMIT 1`,
      [retentionDays]
    );

    mightHaveMore = (existsRes.rowCount || 0) > 0;
  }

  return { deleted, iterations: 1, mightHaveMore };
}

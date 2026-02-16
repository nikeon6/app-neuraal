import { NextResponse } from "next/server";
import { prisma, pool } from "@/infrastructure/persistence/prisma";
import IORedis from "ioredis";

/**
 * Individual health check result.
 */
interface CheckResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

/**
 * Runs a check with a timeout guard.
 */
async function runCheck(
  name: string,
  fn: () => Promise<void>,
  timeoutMs = 3000,
): Promise<CheckResult> {
  const start = performance.now();
  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${name} timeout (${timeoutMs}ms)`)),
          timeoutMs,
        ),
      ),
    ]);
    return { ok: true, latencyMs: Math.round(performance.now() - start) };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * GET /api/health
 *
 * Returns aggregated health status for all critical dependencies.
 * - 200 if all checks pass
 * - 503 if any check fails (status "degraded" or "down")
 */
export async function GET(): Promise<NextResponse> {
  const checks: Record<string, CheckResult> = {};

  // --- Database (Prisma / pg pool) ----------------------------------------
  checks.db = await runCheck("db", async () => {
    await prisma.$queryRawUnsafe("SELECT 1");
  });

  // --- Redis ---------------------------------------------------------------
  checks.redis = await runCheck("redis", async () => {
    const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
    const redis = new IORedis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
    });
    try {
      await redis.connect();
      await redis.ping();
    } finally {
      redis.disconnect();
    }
  });

  // --- Ollama (optional) ---------------------------------------------------
  const ollamaUrl =
    process.env.OLLAMA_BASE_URL ?? process.env.NEXT_PUBLIC_OLLAMA_URL;
  if (ollamaUrl) {
    checks.ollama = await runCheck("ollama", async () => {
      const res = await fetch(`${ollamaUrl}/api/version`, {
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
  }

  // --- n8n (optional) ------------------------------------------------------
  const n8nUrl = process.env.N8N_BASE_URL;
  if (n8nUrl) {
    checks.n8n = await runCheck("n8n", async () => {
      const res = await fetch(`${n8nUrl}/healthz`, {
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
  }

  // --- S3/MinIO (optional) -------------------------------------------------
  const s3Endpoint = process.env.S3_ENDPOINT;
  if (s3Endpoint) {
    checks.s3 = await runCheck("s3", async () => {
      const bucket = process.env.S3_BUCKET ?? "neuraal-attachments";
      const res = await fetch(`${s3Endpoint}/${bucket}`, {
        method: "HEAD",
        signal: AbortSignal.timeout(2500),
      });
      // MinIO may return 403 (not signed) but that means it's reachable
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
    });
  }

  // --- Aggregate -----------------------------------------------------------
  const allOk = Object.values(checks).every((c) => c.ok);
  const criticalOk = checks.db.ok && checks.redis.ok;

  let status: "ok" | "degraded" | "down";
  if (allOk) {
    status = "ok";
  } else if (criticalOk) {
    status = "degraded";
  } else {
    status = "down";
  }

  // Release the pg pool connection used for this check (not the singleton)
  void pool; // pool is already a singleton, no extra cleanup needed

  return NextResponse.json(
    {
      status,
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: status === "ok" || status === "degraded" ? 200 : 503 },
  );
}

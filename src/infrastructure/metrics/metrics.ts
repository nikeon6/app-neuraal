import client from "prom-client";

// ---------------------------------------------------------------------------
// Default Node.js metrics (event loop lag, heap, GC, etc.)
// ---------------------------------------------------------------------------

client.collectDefaultMetrics({ prefix: "neuraal_" });

// ---------------------------------------------------------------------------
// HTTP metrics
// ---------------------------------------------------------------------------

export const httpRequestDuration = new client.Histogram({
  name: "neuraal_http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["route", "method", "status"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const httpRequestsTotal = new client.Counter({
  name: "neuraal_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["route", "method", "status"] as const,
});

// ---------------------------------------------------------------------------
// AI guardrails metrics
// ---------------------------------------------------------------------------

export const aiRequestsBlockedTotal = new client.Counter({
  name: "neuraal_ai_requests_blocked_total",
  help: "AI requests blocked by guardrails",
  labelNames: ["action", "reason"] as const,
});

export const aiRequestsAcceptedTotal = new client.Counter({
  name: "neuraal_ai_requests_accepted_total",
  help: "AI requests accepted (passed guardrails)",
  labelNames: ["action"] as const,
});

// ---------------------------------------------------------------------------
// BullMQ job metrics
// ---------------------------------------------------------------------------

export const bullJobsTotal = new client.Counter({
  name: "neuraal_bull_jobs_total",
  help: "Total BullMQ jobs processed",
  labelNames: ["queue", "status"] as const,
});

export const bullJobDuration = new client.Histogram({
  name: "neuraal_bull_job_duration_seconds",
  help: "Duration of BullMQ job processing in seconds",
  labelNames: ["queue", "status"] as const,
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120],
});

// ---------------------------------------------------------------------------
// Registry access
// ---------------------------------------------------------------------------

export const registry = client.register;

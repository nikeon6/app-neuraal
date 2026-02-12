import pino from "pino";

// ---------------------------------------------------------------------------
// Base logger
// ---------------------------------------------------------------------------

const isDev = process.env.NODE_ENV !== "production";

/**
 * Application-wide structured logger (pino).
 *
 * - In production: JSON logs (machine-readable for Loki/ELK/etc.)
 * - In development: pretty-printed for readability
 *
 * Sensitive fields are redacted automatically.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  base: { service: "neuraal" },
  redact: {
    paths: [
      "password",
      "passwordHash",
      "tokenHash",
      "refreshToken",
      "accessToken",
      "secret",
      "authorization",
      "cookie",
      "req.headers.cookie",
      "req.headers.authorization",
    ],
    censor: "[REDACTED]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        ignore: "pid,hostname,service",
        translateTime: "HH:MM:ss.l",
      },
    },
  }),
});

// ---------------------------------------------------------------------------
// Child logger factories
// ---------------------------------------------------------------------------

export interface RequestContext {
  requestId: string;
  userId?: string;
  route?: string;
  method?: string;
}

export interface JobContext {
  jobId: string;
  queue: string;
  userId?: string;
  action?: string;
  requestId?: string;
}

/**
 * Creates a child logger enriched with HTTP request context.
 */
export function withRequestContext(ctx: RequestContext) {
  return logger.child({ ...ctx, scope: "http" });
}

/**
 * Creates a child logger enriched with BullMQ job context.
 */
export function withJobContext(ctx: JobContext) {
  return logger.child({ ...ctx, scope: "worker" });
}

import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const isProduction = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "X-Frame-Options", value: "DENY" },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Keep runtime-focused logging/telemetry deps external in server builds.
  // This avoids Turbopack traversing non-runtime files inside these packages.
  serverExternalPackages: [
    "pino",
    "pino-pretty",
    "thread-stream",
    "import-in-the-middle",
    "require-in-the-middle",
  ],
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

// Wrap with Sentry only when DSN is configured
const sentryEnabled = !!(
  process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
);

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      silent: true,
      // Disable source map upload unless SENTRY_AUTH_TOKEN is set (Sentry SDK option)
      ...(process.env.SENTRY_AUTH_TOKEN
        ? {}
        : {
            disableServerWebpackPlugin: true,
            disableClientWebpackPlugin: true,
          }),
    } as Parameters<typeof withSentryConfig>[1])
  : nextConfig;

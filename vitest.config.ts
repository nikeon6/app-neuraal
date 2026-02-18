import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    maxWorkers: 2,
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/tests/e2e/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/test/**",
        "vitest.config.ts",
        "**/*.d.ts",
        "**/types.ts",
      ],
      thresholds: {
        // Avoid blind global % gates. Enforce by risk tier instead.
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,

        // CORE (100%): critical guardrails and quota accounting.
        "src/application/use-cases/ai/GuardAiAction.ts": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        "src/application/use-cases/ai/ConsumeAiRequest.ts": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },

        // IMPORTANT (80%): user-facing routes/components.
        "src/app/api/auth/login/route.ts": {
          statements: 80,
          functions: 90,
          lines: 80,
        },
        "src/app/api/auth/register/route.ts": {
          statements: 80,
          functions: 90,
          lines: 80,
        },
        "src/app/api/entries/route.ts": {
          statements: 80,
          functions: 90,
          lines: 80,
        },
        "src/app/api/entries/[id]/ocr/route.ts": {
          statements: 80,
          branches: 80,
          functions: 90,
          lines: 80,
        },
        "src/app/api/entries/[id]/transcribe-youtube/route.ts": {
          statements: 80,
          branches: 80,
          functions: 90,
          lines: 80,
        },
        "src/app/api/entries/[id]/summarize/route.ts": {
          statements: 80,
          branches: 80,
          functions: 90,
          lines: 80,
        },
        "src/app/api/health/route.ts": {
          statements: 80,
          branches: 80,
          functions: 90,
          lines: 80,
        },
        "src/app/api/reminders/route.ts": {
          statements: 80,
          branches: 70,
          functions: 90,
          lines: 80,
        },
        "src/features/notifications/components/NotificationCenter.tsx": {
          statements: 80,
          functions: 90,
          lines: 80,
        },
        "src/features/topics/components/TopicsSection.tsx": {
          statements: 80,
          functions: 90,
          lines: 80,
        },

        // INFRASTRUCTURE (0%): validated by TS/static tooling.
        "src/shared/types/**": {
          statements: 0,
          branches: 0,
          functions: 0,
          lines: 0,
        },
        "src/shared/constants/**": {
          statements: 0,
          branches: 0,
          functions: 0,
          lines: 0,
        },
        "src/generated/prisma/**": {
          statements: 0,
          branches: 0,
          functions: 0,
          lines: 0,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

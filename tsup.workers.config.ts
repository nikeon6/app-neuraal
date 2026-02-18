import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/infrastructure/queue/summaryWorker.ts",
    "src/infrastructure/queue/transcriptionWorker.ts",
    "src/infrastructure/queue/reminderWorker.ts",
  ],
  outDir: "dist/workers",
  format: ["esm"],
  target: "node20",
  platform: "node",
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  // dotenv uses require('fs') internally; bundling it breaks in ESM
  external: ["dotenv", "dotenv/config"],
});

import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const ARTIFACTS_DIR = ".artifacts";

mkdirSync(ARTIFACTS_DIR, { recursive: true });

function runCommand(command, logFile) {
  const result = spawnSync(command, {
    shell: true,
    encoding: "utf8",
  });

  const combinedOutput = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  writeFileSync(logFile, combinedOutput, "utf8");

  return {
    command,
    exitCode: result.status ?? 1,
    logFile,
  };
}

const testCoverageResult = runCommand(
  "pnpm test:coverage",
  join(ARTIFACTS_DIR, "test-coverage.log"),
);

const lintResult = runCommand(
  "pnpm exec eslint src --format json -o .artifacts/eslint-report.json",
  join(ARTIFACTS_DIR, "lint.log"),
);

const status = {
  generatedAt: new Date().toISOString(),
  testCoverage: testCoverageResult,
  lint: lintResult,
};

writeFileSync(
  join(ARTIFACTS_DIR, "metrics-status.json"),
  JSON.stringify(status, null, 2),
  "utf8",
);

console.log("Metrics artifacts generated in .artifacts/");
console.log(`- test log: ${testCoverageResult.logFile}`);
console.log(`- lint log: ${lintResult.logFile}`);
console.log(`- status: ${join(ARTIFACTS_DIR, "metrics-status.json")}`);

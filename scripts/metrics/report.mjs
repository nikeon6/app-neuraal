import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);

function getArgValue(flag, fallback) {
  const match = args.find((arg) => arg.startsWith(`${flag}=`));
  if (!match) return fallback;
  return match.slice(flag.length + 1);
}

const mode = getArgValue("--mode", "local");
const testLogPath = getArgValue(
  "--test-log",
  join(".artifacts", "test-coverage.log"),
);
const coverageSummaryPath = getArgValue(
  "--coverage-summary",
  join("coverage", "coverage-summary.json"),
);
const coverageFinalPath = getArgValue(
  "--coverage-final",
  join("coverage", "coverage-final.json"),
);
const eslintJsonPath = getArgValue(
  "--eslint-json",
  join(".artifacts", "eslint-report.json"),
);
const statusPath = getArgValue(
  "--status-json",
  join(".artifacts", "metrics-status.json"),
);

function readIfExists(filePath) {
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf8");
}

function parseCoverageSummary(raw) {
  if (!raw) return null;
  try {
    const json = JSON.parse(raw);
    const total = json.total;
    if (!total) return null;
    return {
      statements: total.statements?.pct ?? null,
      branches: total.branches?.pct ?? null,
      functions: total.functions?.pct ?? null,
      lines: total.lines?.pct ?? null,
    };
  } catch {
    return null;
  }
}

function percentage(covered, total) {
  if (!total) return 100;
  return Number(((covered / total) * 100).toFixed(2));
}

function parseCoverageFinal(raw) {
  if (!raw) return null;
  try {
    const json = JSON.parse(raw);
    const files = Object.values(json);
    if (!Array.isArray(files) || files.length === 0) return null;

    let totalStatements = 0;
    let coveredStatements = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalLines = 0;
    let coveredLines = 0;

    for (const file of files) {
      const statements = Object.values(file?.s ?? {});
      totalStatements += statements.length;
      coveredStatements += statements.filter((n) => Number(n) > 0).length;

      const functions = Object.values(file?.f ?? {});
      totalFunctions += functions.length;
      coveredFunctions += functions.filter((n) => Number(n) > 0).length;

      const branchGroups = Object.values(file?.b ?? {});
      for (const branchGroup of branchGroups) {
        if (!Array.isArray(branchGroup)) continue;
        totalBranches += branchGroup.length;
        coveredBranches += branchGroup.filter((n) => Number(n) > 0).length;
      }

      const lineHits = Object.values(file?.l ?? {});
      totalLines += lineHits.length;
      coveredLines += lineHits.filter((n) => Number(n) > 0).length;
    }

    return {
      statements: percentage(coveredStatements, totalStatements),
      branches: percentage(coveredBranches, totalBranches),
      functions: percentage(coveredFunctions, totalFunctions),
      lines: percentage(coveredLines, totalLines),
    };
  } catch {
    return null;
  }
}

function parseTestLog(raw) {
  if (!raw) return null;
  const filesLine = raw.match(/Test Files\s+(.+)/);
  const testsLine = raw.match(/Tests\s+(.+)/);
  const durationLine = raw.match(/Duration\s+(.+)/);

  if (!filesLine && !testsLine && !durationLine) return null;
  return {
    files: filesLine?.[1]?.trim() ?? "N/A",
    tests: testsLine?.[1]?.trim() ?? "N/A",
    duration: durationLine?.[1]?.trim() ?? "N/A",
  };
}

function parseEslintJson(raw) {
  if (!raw) return null;
  try {
    const results = JSON.parse(raw);
    if (!Array.isArray(results)) return null;

    let errors = 0;
    let warnings = 0;
    let filesWithIssues = 0;

    for (const fileResult of results) {
      const fileErrors = fileResult.errorCount ?? 0;
      const fileWarnings = fileResult.warningCount ?? 0;
      errors += fileErrors;
      warnings += fileWarnings;
      if (fileErrors > 0 || fileWarnings > 0) {
        filesWithIssues += 1;
      }
    }

    return { errors, warnings, filesWithIssues };
  } catch {
    return null;
  }
}

function parseStatus(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const coverage =
  parseCoverageSummary(readIfExists(coverageSummaryPath)) ??
  parseCoverageFinal(readIfExists(coverageFinalPath));
const testMetrics = parseTestLog(readIfExists(testLogPath));
const lintMetrics = parseEslintJson(readIfExists(eslintJsonPath));
const status = parseStatus(readIfExists(statusPath));

const testsSection = testMetrics
  ? [
      "Tests",
      `- Files: ${testMetrics.files}`,
      `- Tests: ${testMetrics.tests}`,
      `- Duration: ${testMetrics.duration}`,
      "",
    ]
  : ["Tests", "- Test log not found or not parseable.", ""];

const coverageSection = coverage
  ? [
      "Coverage",
      `- Statements: ${coverage.statements ?? "N/A"}%`,
      `- Branches: ${coverage.branches ?? "N/A"}%`,
      `- Functions: ${coverage.functions ?? "N/A"}%`,
      `- Lines: ${coverage.lines ?? "N/A"}%`,
      "",
    ]
  : ["Coverage", "- coverage-summary.json not found.", ""];

const lintSection = lintMetrics
  ? [
      "Lint",
      `- Errors: ${lintMetrics.errors}`,
      `- Warnings: ${lintMetrics.warnings}`,
      `- Files with issues: ${lintMetrics.filesWithIssues}`,
      "",
    ]
  : ["Lint", "- ESLint JSON report not found.", ""];

const statusSection = status
  ? [
      "Command status",
      `- test:coverage exit code: ${status.testCoverage?.exitCode ?? "N/A"}`,
      `- lint (json) exit code: ${status.lint?.exitCode ?? "N/A"}`,
      "",
    ]
  : [];

const lines = [
  "Project Metrics",
  "===============",
  "",
  ...testsSection,
  ...coverageSection,
  ...lintSection,
  ...statusSection,
];

console.log(lines.join("\n"));

if (mode === "ci" && process.env.GITHUB_STEP_SUMMARY) {
  const md = [
    "## Project Metrics",
    "",
    "### Tests",
    testMetrics
      ? `- Files: \`${testMetrics.files}\`\n- Tests: \`${testMetrics.tests}\`\n- Duration: \`${testMetrics.duration}\``
      : "- Test log not found or not parseable.",
    "",
    "### Coverage",
    coverage
      ? `- Statements: \`${coverage.statements ?? "N/A"}%\`\n- Branches: \`${coverage.branches ?? "N/A"}%\`\n- Functions: \`${coverage.functions ?? "N/A"}%\`\n- Lines: \`${coverage.lines ?? "N/A"}%\``
      : "- coverage-summary.json not found.",
    "",
    "### Lint",
    lintMetrics
      ? `- Errors: \`${lintMetrics.errors}\`\n- Warnings: \`${lintMetrics.warnings}\`\n- Files with issues: \`${lintMetrics.filesWithIssues}\``
      : "- ESLint JSON report not found.",
    "",
  ].join("\n");

  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`, "utf8");
}

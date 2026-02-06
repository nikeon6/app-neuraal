/**
 * Emits the OpenAPI spec to a JSON file.
 *
 * Usage:
 *   pnpm openapi:emit
 *   # or: npx tsx scripts/openapi/emit.ts
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import spec from "../../openapi/spec.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, "../../openapi/openapi.json");

const json = JSON.stringify(spec, null, 2);
writeFileSync(outPath, json + "\n", "utf-8");

console.log(`OpenAPI spec written to ${outPath} (${json.length} bytes)`);

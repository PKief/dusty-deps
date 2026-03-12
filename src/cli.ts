#!/usr/bin/env node

import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "./core/checker.js";
import { formatAge } from "./core/format.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  const pkgPath = resolve(__dirname, "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
  return pkg.version;
}

const HELP = `
Usage: dusty-deps [options]

Check the age of npm production dependencies and flag stale packages.

Options:
  --threshold <days>   Age threshold in days (default: from config or 1095)
  --json               Output results as JSON
  --cwd <path>         Directory containing package.json (default: .)
  --help, -h           Show this help message
  --version, -v        Show version number

Config files (checked in order):
  dusty-deps.config.json
  dusty-deps.config.mjs
  .dusty-depsrc.json
  "dusty-deps" key in package.json

Exit codes:
  0   All dependencies pass
  1   One or more dependencies exceed the threshold
  2   Invalid arguments or configuration error
`.trim();

try {
  const { values } = parseArgs({
    options: {
      threshold: { type: "string", short: "t" },
      json: { type: "boolean", default: false },
      cwd: { type: "string" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
    strict: true,
  });

  if (values.help) {
    console.log(HELP);
    process.exit(0);
  }

  if (values.version) {
    console.log(getVersion());
    process.exit(0);
  }

  let threshold: number | undefined;
  if (values.threshold !== undefined) {
    threshold = Number(values.threshold);
    if (Number.isNaN(threshold) || threshold <= 0) {
      console.error("Error: --threshold must be a positive number");
      process.exit(2);
    }
  }

  const cwd = values.cwd ? resolve(values.cwd) : process.cwd();

  const result = await check({ cwd, threshold });

  if (values.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      `Checking ${result.checked} production dependencies (threshold: ${result.threshold} days / ${formatAge(result.threshold)})...\n`
    );

    for (const r of result.results) {
      switch (r.status) {
        case "fail":
          console.log(
            `  [FAIL] ${r.name}@${r.version} — last release: ${r.lastPublish} (${r.ageFormatted} ago)`
          );
          break;
        case "pass":
          console.log(
            `  [PASS] ${r.name}@${r.version} — last release: ${r.lastPublish} (${r.ageFormatted} ago)`
          );
          break;
        case "skip":
          console.log(`  [SKIP] ${r.name}@${r.version} — allowlisted: "${r.reason}"`);
          break;
        case "unknown":
          console.log(`  [WARN] ${r.name}@${r.version} — could not fetch publish dates`);
          break;
      }
    }

    const failed = result.results.filter((r) => r.status === "fail");
    const passed = result.results.filter((r) => r.status === "pass");
    const skipped = result.results.filter((r) => r.status === "skip");
    const unknown = result.results.filter((r) => r.status === "unknown");

    console.log(
      `\nSummary: ${passed.length} passed, ${failed.length} failed, ${skipped.length} allowlisted, ${unknown.length} unknown`
    );

    if (failed.length > 0) {
      console.log(
        `\n${failed.length} dependency(s) exceed the ${formatAge(result.threshold)} threshold.`
      );
      console.log("Add them to your dusty-deps config allowlist with a reason, or update them.");
    }
  }

  process.exit(result.failed > 0 ? 1 : 0);
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

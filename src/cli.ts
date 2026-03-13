#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { check } from "./core/checker.js";
import { formatAge } from "./core/format.js";
import type { DependencyResult } from "./core/types.js";

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

function formatResult(r: DependencyResult): string {
  switch (r.status) {
    case "fail":
    case "pass":
      return `  [${r.status.toUpperCase()}] ${r.name}@${r.version} — last release: ${r.lastPublish} (${r.ageFormatted} ago)`;
    case "skip":
      return `  [SKIP] ${r.name}@${r.version} — allowlisted: "${r.reason}"`;
    case "unknown":
      return `  [WARN] ${r.name}@${r.version} — could not fetch publish dates`;
  }
}

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
  const isJson = values.json ?? false;
  const isTTY = process.stderr.isTTY ?? false;

  function renderProgress(completed: number, total: number, name: string) {
    if (isJson || !isTTY) return;
    const width = 20;
    const filled = Math.round((completed / total) * width);
    const bar = "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
    process.stderr.write(`\r  ${bar} ${completed}/${total} ${name}\x1b[K`);
  }

  function clearProgress() {
    if (isJson || !isTTY) return;
    process.stderr.write("\r\x1b[K");
  }

  const result = await check({ cwd, threshold, onProgress: renderProgress });
  clearProgress();

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      `Checking ${result.checked} production dependencies (threshold: ${result.threshold} days / ${formatAge(result.threshold)})...\n`,
    );

    for (const r of result.results) {
      console.log(formatResult(r));
    }

    const counts = { pass: 0, fail: 0, skip: 0, unknown: 0 };
    for (const r of result.results) {
      counts[r.status]++;
    }

    console.log(
      `\nSummary: ${counts.pass} passed, ${counts.fail} failed, ${counts.skip} allowlisted, ${counts.unknown} unknown`,
    );

    if (counts.fail > 0) {
      console.log(
        `\n${counts.fail} dependency(s) exceed the ${formatAge(result.threshold)} threshold.`,
      );
      console.log("Add them to your dusty-deps config allowlist with a reason, or update them.");
    }
  }

  process.exit(result.failed > 0 ? 1 : 0);
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

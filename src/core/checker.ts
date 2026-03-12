import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { processInBatches } from "./concurrency.js";
import { loadConfig } from "./config.js";
import { formatAge, formatDate } from "./format.js";
import { getLastPublishDate } from "./registry.js";
import type { CheckOptions, CheckResult, DependencyResult } from "./types.js";

const DEFAULT_THRESHOLD_DAYS = 1095;
const DEFAULT_CONCURRENCY = 5;

export async function check(options?: CheckOptions): Promise<CheckResult> {
  const cwd = options?.cwd ?? process.cwd();
  const config = await loadConfig(cwd);

  const threshold = options?.threshold ?? config.threshold ?? DEFAULT_THRESHOLD_DAYS;
  const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;
  const allowlist: Record<string, string> = {
    ...config.allowlist,
    ...options?.allowlist,
  };

  const pkgPath = resolve(cwd, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
  const deps = (pkg.dependencies ?? {}) as Record<string, string>;
  const depNames = Object.keys(deps);
  const now = new Date();

  const results = await processInBatches(depNames, concurrency, async (name) => {
    const version = deps[name] ?? "";
    const allowReason = allowlist[name];

    if (allowReason) {
      return { name, version, status: "skip" as const, reason: allowReason };
    }

    const lastPublish = getLastPublishDate(name);
    if (!lastPublish) {
      return { name, version, status: "unknown" as const };
    }

    const ageDays = Math.floor((now.getTime() - lastPublish.getTime()) / (1000 * 60 * 60 * 24));
    const exceeded = ageDays > threshold;

    return {
      name,
      version,
      status: exceeded ? ("fail" as const) : ("pass" as const),
      lastPublish: formatDate(lastPublish),
      ageDays,
      ageFormatted: formatAge(ageDays),
    } satisfies DependencyResult;
  });

  results.sort((a, b) => {
    const order = { fail: 0, unknown: 1, pass: 2, skip: 3 };
    if (order[a.status] !== order[b.status]) {
      return order[a.status] - order[b.status];
    }
    return (b.ageDays ?? 0) - (a.ageDays ?? 0);
  });

  return {
    threshold,
    checked: results.length,
    failed: results.filter((r) => r.status === "fail").length,
    results,
  };
}

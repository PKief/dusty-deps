import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { processInPool } from "./concurrency.js";
import { loadConfig } from "./config.js";
import { formatAge, formatDate } from "./format.js";
import { getLastPublishDate } from "./registry.js";
import type { CheckOptions, CheckResult, DependencyResult } from "./types.js";

const DEFAULT_THRESHOLD_DAYS = 1095;
const DEFAULT_CONCURRENCY = 10;

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

  const total = depNames.length;
  let completed = 0;

  const results = await processInPool(depNames, concurrency, async (name) => {
    const result = await checkDependency(name, deps[name] ?? "", allowlist, now, threshold);

    completed++;
    options?.onProgress?.(completed, total, name);

    return result;
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

async function checkDependency(
  name: string,
  version: string,
  allowlist: Record<string, string>,
  now: Date,
  threshold: number,
): Promise<DependencyResult> {
  const allowReason = allowlist[name];
  if (allowReason) {
    return { name, version, status: "skip", reason: allowReason };
  }

  const lastPublish = await getLastPublishDate(name);
  if (!lastPublish) {
    return { name, version, status: "unknown" };
  }

  const ageDays = Math.floor((now.getTime() - lastPublish.getTime()) / (1000 * 60 * 60 * 24));
  return {
    name,
    version,
    status: ageDays > threshold ? "fail" : "pass",
    lastPublish: formatDate(lastPublish),
    ageDays,
    ageFormatted: formatAge(ageDays),
  };
}

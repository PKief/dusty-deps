import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { processInPool } from "./concurrency.js";
import { loadConfig } from "./config.js";
import { formatAge, formatDate } from "./format.js";
import { getLastPublishDate } from "./registry.js";
import type { CheckOptions, CheckResult, DependencyResult, DependencyStatus } from "./types.js";

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
  const deps = await readDependencies(pkgPath);
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
    const order: Record<DependencyStatus, number> = { fail: 0, unknown: 1, pass: 2, skip: 3 };
    if (order[a.status] !== order[b.status]) {
      return order[a.status] - order[b.status];
    }
    const aAge = a.status === "fail" || a.status === "pass" ? a.ageDays : 0;
    const bAge = b.status === "fail" || b.status === "pass" ? b.ageDays : 0;
    return bAge - aAge;
  });

  const counts: Record<DependencyStatus, number> = { fail: 0, pass: 0, skip: 0, unknown: 0 };
  for (const r of results) {
    counts[r.status]++;
  }

  return {
    threshold,
    checked: results.length,
    counts,
    results,
  };
}

async function readDependencies(pkgPath: string): Promise<Record<string, string>> {
  let content: string;
  try {
    content = await readFile(pkgPath, "utf8");
  } catch (error) {
    const code = error instanceof Error && "code" in error ? (error as { code: string }).code : "";
    if (code === "ENOENT") {
      throw new Error(`package.json not found at ${pkgPath}`);
    }
    throw new Error(
      `Failed to read ${pkgPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error(`Failed to parse ${pkgPath}: invalid JSON`);
  }

  const deps = pkg.dependencies;
  if (deps === undefined || deps === null) {
    return {};
  }

  if (typeof deps !== "object" || Array.isArray(deps)) {
    throw new Error(`Invalid "dependencies" field in ${pkgPath}: expected an object`);
  }

  return deps as Record<string, string>;
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

  const { date: lastPublish, error } = await getLastPublishDate(name);
  if (!lastPublish) {
    return { name, version, status: "unknown", error };
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

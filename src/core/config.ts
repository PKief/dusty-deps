import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { DustyDepsConfig } from "./types.js";

export async function loadConfig(cwd: string): Promise<DustyDepsConfig> {
  const jsonConfigPath = resolve(cwd, "dusty-deps.config.json");
  if (existsSync(jsonConfigPath)) {
    return validateConfig(JSON.parse(readFileSync(jsonConfigPath, "utf8")));
  }

  const mjsConfigPath = resolve(cwd, "dusty-deps.config.mjs");
  if (existsSync(mjsConfigPath)) {
    const mod = (await import(pathToFileURL(mjsConfigPath).href)) as { default: unknown };
    return validateConfig(mod.default);
  }

  const rcConfigPath = resolve(cwd, ".dusty-depsrc.json");
  if (existsSync(rcConfigPath)) {
    return validateConfig(JSON.parse(readFileSync(rcConfigPath, "utf8")));
  }

  const pkgPath = resolve(cwd, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
    if (pkg["dusty-deps"] !== undefined) {
      return validateConfig(pkg["dusty-deps"]);
    }
  }

  return {};
}

function validateConfig(raw: unknown): DustyDepsConfig {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("dusty-deps config must be an object");
  }

  const config = raw as Record<string, unknown>;
  const result: DustyDepsConfig = {};

  if (config.threshold !== undefined) {
    if (typeof config.threshold !== "number" || config.threshold <= 0) {
      throw new Error("dusty-deps config: threshold must be a positive number");
    }
    result.threshold = config.threshold;
  }

  if (config.allowlist !== undefined) {
    if (
      typeof config.allowlist !== "object" ||
      config.allowlist === null ||
      Array.isArray(config.allowlist)
    ) {
      throw new Error(
        "dusty-deps config: allowlist must be an object mapping package names to reasons",
      );
    }
    const allowlist = config.allowlist as Record<string, unknown>;
    for (const [key, value] of Object.entries(allowlist)) {
      if (typeof value !== "string") {
        throw new Error(`dusty-deps config: allowlist["${key}"] must be a string`);
      }
    }
    result.allowlist = allowlist as Record<string, string>;
  }

  return result;
}

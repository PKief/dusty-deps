import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { DustyDepsConfig } from "./types.js";

const KNOWN_CONFIG_KEYS = new Set(["threshold", "allowlist"]);

export async function loadConfig(cwd: string): Promise<DustyDepsConfig> {
  const jsonConfig = await tryReadJson(resolve(cwd, "dusty-deps.config.json"));
  if (jsonConfig !== undefined) {
    return validateConfig(jsonConfig);
  }

  const mjsConfigPath = resolve(cwd, "dusty-deps.config.mjs");
  const mjsConfig = await tryLoadMjs(mjsConfigPath);
  if (mjsConfig !== undefined) {
    return validateConfig(mjsConfig);
  }

  const rcConfig = await tryReadJson(resolve(cwd, ".dusty-depsrc.json"));
  if (rcConfig !== undefined) {
    return validateConfig(rcConfig);
  }

  const pkgConfig = await tryReadJson(resolve(cwd, "package.json"));
  if (pkgConfig !== undefined) {
    const pkg = pkgConfig as Record<string, unknown>;
    if (pkg["dusty-deps"] !== undefined) {
      return validateConfig(pkg["dusty-deps"]);
    }
  }

  return {};
}

async function tryReadJson(filePath: string): Promise<unknown | undefined> {
  try {
    const content = await readFile(filePath, "utf8");
    try {
      return JSON.parse(content);
    } catch {
      throw new Error(`Failed to parse ${filePath}: invalid JSON`);
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function tryLoadMjs(filePath: string): Promise<unknown | undefined> {
  try {
    await readFile(filePath, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }

  const mod = (await import(pathToFileURL(filePath).href)) as Record<string, unknown>;
  if (!("default" in mod)) {
    throw new Error(`${filePath} must use a default export`);
  }
  return mod.default;
}

function validateConfig(raw: unknown): DustyDepsConfig {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("dusty-deps config must be an object");
  }

  const config = raw as Record<string, unknown>;
  const result: DustyDepsConfig = {};

  const unknownKeys = Object.keys(config).filter((key) => !KNOWN_CONFIG_KEYS.has(key));
  if (unknownKeys.length > 0) {
    console.warn(
      `dusty-deps config: unknown key(s) ${unknownKeys.map((k) => `"${k}"`).join(", ")} — possible typo?`,
    );
  }

  if (config.threshold !== undefined) {
    if (
      typeof config.threshold !== "number" ||
      !Number.isFinite(config.threshold) ||
      config.threshold <= 0
    ) {
      throw new Error("dusty-deps config: threshold must be a finite positive number");
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

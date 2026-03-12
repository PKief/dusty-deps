import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/core/config.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "dusty-deps-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("returns empty config when no config file exists", async () => {
    const config = await loadConfig(tempDir);
    expect(config).toEqual({});
  });

  it("loads dusty-deps.config.json", async () => {
    writeFileSync(
      join(tempDir, "dusty-deps.config.json"),
      JSON.stringify({ threshold: 730, allowlist: { lodash: "stable" } }),
    );
    const config = await loadConfig(tempDir);
    expect(config.threshold).toBe(730);
    expect(config.allowlist).toEqual({ lodash: "stable" });
  });

  it("loads .dusty-depsrc.json", async () => {
    writeFileSync(join(tempDir, ".dusty-depsrc.json"), JSON.stringify({ threshold: 500 }));
    const config = await loadConfig(tempDir);
    expect(config.threshold).toBe(500);
  });

  it("loads dusty-deps key from package.json", async () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "test",
        "dusty-deps": { allowlist: { path: "polyfill" } },
      }),
    );
    const config = await loadConfig(tempDir);
    expect(config.allowlist).toEqual({ path: "polyfill" });
  });

  it("prioritizes dusty-deps.config.json over .dusty-depsrc.json", async () => {
    writeFileSync(join(tempDir, "dusty-deps.config.json"), JSON.stringify({ threshold: 100 }));
    writeFileSync(join(tempDir, ".dusty-depsrc.json"), JSON.stringify({ threshold: 999 }));
    const config = await loadConfig(tempDir);
    expect(config.threshold).toBe(100);
  });

  it("throws on invalid threshold", async () => {
    writeFileSync(join(tempDir, "dusty-deps.config.json"), JSON.stringify({ threshold: -5 }));
    await expect(loadConfig(tempDir)).rejects.toThrow("threshold must be a positive number");
  });

  it("throws on invalid allowlist type", async () => {
    writeFileSync(
      join(tempDir, "dusty-deps.config.json"),
      JSON.stringify({ allowlist: "not-an-object" }),
    );
    await expect(loadConfig(tempDir)).rejects.toThrow("allowlist must be an object");
  });

  it("throws on non-string allowlist values", async () => {
    writeFileSync(
      join(tempDir, "dusty-deps.config.json"),
      JSON.stringify({ allowlist: { lodash: 123 } }),
    );
    await expect(loadConfig(tempDir)).rejects.toThrow('allowlist["lodash"] must be a string');
  });

  it("loads dusty-deps.config.mjs", async () => {
    writeFileSync(
      join(tempDir, "dusty-deps.config.mjs"),
      'export default { threshold: 365, allowlist: { uuid: "stable" } };',
    );
    const config = await loadConfig(tempDir);
    expect(config.threshold).toBe(365);
    expect(config.allowlist).toEqual({ uuid: "stable" });
  });
});

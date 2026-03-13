import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../src/core/config.js";
import { useTempDir } from "../helpers.js";

const temp = useTempDir();

describe("loadConfig", () => {
  it("returns empty config when no config file exists", async () => {
    const config = await loadConfig(temp.dir);
    expect(config).toEqual({});
  });

  it("loads dusty-deps.config.json", async () => {
    writeFileSync(
      join(temp.dir, "dusty-deps.config.json"),
      JSON.stringify({ threshold: 730, allowlist: { lodash: "stable" } }),
    );
    const config = await loadConfig(temp.dir);
    expect(config.threshold).toBe(730);
    expect(config.allowlist).toEqual({ lodash: "stable" });
  });

  it("loads .dusty-depsrc.json", async () => {
    writeFileSync(join(temp.dir, ".dusty-depsrc.json"), JSON.stringify({ threshold: 500 }));
    const config = await loadConfig(temp.dir);
    expect(config.threshold).toBe(500);
  });

  it("loads dusty-deps key from package.json", async () => {
    writeFileSync(
      join(temp.dir, "package.json"),
      JSON.stringify({
        name: "test",
        "dusty-deps": { allowlist: { path: "polyfill" } },
      }),
    );
    const config = await loadConfig(temp.dir);
    expect(config.allowlist).toEqual({ path: "polyfill" });
  });

  it("prioritizes dusty-deps.config.json over .dusty-depsrc.json", async () => {
    writeFileSync(join(temp.dir, "dusty-deps.config.json"), JSON.stringify({ threshold: 100 }));
    writeFileSync(join(temp.dir, ".dusty-depsrc.json"), JSON.stringify({ threshold: 999 }));
    const config = await loadConfig(temp.dir);
    expect(config.threshold).toBe(100);
  });

  it("throws on invalid threshold", async () => {
    writeFileSync(join(temp.dir, "dusty-deps.config.json"), JSON.stringify({ threshold: -5 }));
    await expect(loadConfig(temp.dir)).rejects.toThrow(
      "threshold must be a finite positive number",
    );
  });

  it("throws on NaN threshold", async () => {
    writeFileSync(join(temp.dir, "dusty-deps.config.mjs"), "export default { threshold: NaN };");
    await expect(loadConfig(temp.dir)).rejects.toThrow(
      "threshold must be a finite positive number",
    );
  });

  it("throws on Infinity threshold", async () => {
    writeFileSync(
      join(temp.dir, "dusty-deps.config.mjs"),
      "export default { threshold: Infinity };",
    );
    await expect(loadConfig(temp.dir)).rejects.toThrow(
      "threshold must be a finite positive number",
    );
  });

  it("throws on invalid allowlist type", async () => {
    writeFileSync(
      join(temp.dir, "dusty-deps.config.json"),
      JSON.stringify({ allowlist: "not-an-object" }),
    );
    await expect(loadConfig(temp.dir)).rejects.toThrow("allowlist must be an object");
  });

  it("throws on non-string allowlist values", async () => {
    writeFileSync(
      join(temp.dir, "dusty-deps.config.json"),
      JSON.stringify({ allowlist: { lodash: 123 } }),
    );
    await expect(loadConfig(temp.dir)).rejects.toThrow('allowlist["lodash"] must be a string');
  });

  it("loads dusty-deps.config.mjs", async () => {
    writeFileSync(
      join(temp.dir, "dusty-deps.config.mjs"),
      'export default { threshold: 365, allowlist: { uuid: "stable" } };',
    );
    const config = await loadConfig(temp.dir);
    expect(config.threshold).toBe(365);
    expect(config.allowlist).toEqual({ uuid: "stable" });
  });

  it("throws when .mjs config has no default export", async () => {
    writeFileSync(join(temp.dir, "dusty-deps.config.mjs"), "export const threshold = 365;");
    await expect(loadConfig(temp.dir)).rejects.toThrow("must use a default export");
  });

  it("throws on malformed JSON config", async () => {
    writeFileSync(join(temp.dir, "dusty-deps.config.json"), "{ invalid json }");
    await expect(loadConfig(temp.dir)).rejects.toThrow("Failed to parse");
  });

  it("warns on unknown config keys", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    writeFileSync(
      join(temp.dir, "dusty-deps.config.json"),
      JSON.stringify({ threshold: 100, treshold: 200 }),
    );
    await loadConfig(temp.dir);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"treshold"'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("possible typo"));
    warnSpy.mockRestore();
  });
});

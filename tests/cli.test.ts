import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const CLI_PATH = resolve(import.meta.dirname, "../dist/cli.js");

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "dusty-deps-cli-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function run(args: string[], options?: { expectFail?: boolean }): string {
  try {
    return execFileSync("node", [CLI_PATH, ...args], {
      encoding: "utf8",
      timeout: 30_000,
      cwd: tempDir,
    });
  } catch (error: unknown) {
    if (options?.expectFail && error && typeof error === "object" && "stdout" in error) {
      return (error as { stdout: string }).stdout;
    }
    throw error;
  }
}

describe("CLI", () => {
  it("--help prints usage and exits 0", () => {
    const output = run(["--help"]);
    expect(output).toContain("Usage: dusty-deps");
    expect(output).toContain("--threshold");
    expect(output).toContain("--json");
  });

  it("--version prints version and exits 0", () => {
    const output = run(["--version"]);
    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("--json outputs valid JSON", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "test", dependencies: {} }),
    );
    const output = run(["--json"]);
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("threshold");
    expect(parsed).toHaveProperty("checked", 0);
    expect(parsed).toHaveProperty("results");
  });

  it("exits 2 on invalid threshold", () => {
    try {
      execFileSync("node", [CLI_PATH, "--threshold", "-5"], {
        encoding: "utf8",
        cwd: tempDir,
      });
      expect.fail("Should have thrown");
    } catch (error: unknown) {
      if (error && typeof error === "object" && "status" in error) {
        expect((error as { status: number }).status).toBe(2);
      }
    }
  });

  it("handles project with no dependencies", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "empty", dependencies: {} }),
    );
    const output = run([]);
    expect(output).toContain("0 production dependencies");
    expect(output).toContain("Summary: 0 passed, 0 failed, 0 allowlisted, 0 unknown");
  });
});

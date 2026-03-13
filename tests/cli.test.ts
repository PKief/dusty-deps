import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { useTempDir } from "./helpers.js";

const CLI_PATH = resolve(import.meta.dirname, "../dist/cli.js");
const temp = useTempDir();

interface RunResult {
  stdout: string;
  stderr: string;
  status: number;
}

function run(args: string[]): RunResult {
  try {
    const stdout = execFileSync("node", [CLI_PATH, ...args], {
      encoding: "utf8",
      timeout: 30_000,
      cwd: temp.dir,
    });
    return { stdout, stderr: "", status: 0 };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "status" in error) {
      const e = error as { stdout: string; stderr: string; status: number };
      return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", status: e.status };
    }
    throw error;
  }
}

describe("CLI", () => {
  it("--help prints usage and exits 0", () => {
    const { stdout, status } = run(["--help"]);
    expect(status).toBe(0);
    expect(stdout).toContain("Usage: dusty-deps");
    expect(stdout).toContain("--threshold");
    expect(stdout).toContain("--json");
  });

  it("--version prints version and exits 0", () => {
    const { stdout, status } = run(["--version"]);
    expect(status).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("--json outputs valid JSON", () => {
    writeFileSync(
      join(temp.dir, "package.json"),
      JSON.stringify({ name: "test", dependencies: {} }),
    );
    const { stdout, status } = run(["--json"]);
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty("threshold");
    expect(parsed).toHaveProperty("checked", 0);
    expect(parsed).toHaveProperty("results");
    expect(parsed).toHaveProperty("counts");
  });

  it("exits 2 on invalid threshold and prints error to stderr", () => {
    const { status, stderr } = run(["--threshold", "abc"]);
    expect(status).toBe(2);
    expect(stderr).toContain("--threshold must be a positive number");
  });

  it("handles project with no dependencies", () => {
    writeFileSync(
      join(temp.dir, "package.json"),
      JSON.stringify({ name: "empty", dependencies: {} }),
    );
    const { stdout, status } = run([]);
    expect(status).toBe(0);
    expect(stdout).toContain("No production dependencies found.");
    expect(stdout).toContain("Summary: 0 passed, 0 failed, 0 allowlisted, 0 unknown");
  });

  it("exits 2 when package.json is missing", () => {
    const { status, stderr } = run([]);
    expect(status).toBe(2);
    expect(stderr).toContain("package.json not found");
  });
});

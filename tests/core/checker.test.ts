import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { check } from "../../src/core/checker.js";

vi.mock("../../src/core/registry.js", () => ({
  getLastPublishDate: vi.fn(),
}));

import { getLastPublishDate } from "../../src/core/registry.js";

const mockGetLastPublishDate = vi.mocked(getLastPublishDate);

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "dusty-deps-checker-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("check", () => {
  it("returns results with correct statuses", async () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "test",
        dependencies: {
          "old-pkg": "1.0.0",
          "fresh-pkg": "2.0.0",
          "unknown-pkg": "3.0.0",
        },
      }),
    );
    writeFileSync(join(tempDir, "dusty-deps.config.json"), JSON.stringify({ threshold: 1095 }));

    mockGetLastPublishDate.mockImplementation(async (name) => {
      if (name === "old-pkg") return new Date("2020-01-01");
      if (name === "fresh-pkg") return new Date("2026-01-01");
      return null;
    });

    const result = await check({ cwd: tempDir });

    expect(result.threshold).toBe(1095);
    expect(result.checked).toBe(3);

    const oldPkg = result.results.find((r) => r.name === "old-pkg");
    expect(oldPkg?.status).toBe("fail");
    expect(oldPkg?.ageDays).toBeGreaterThan(1095);

    const freshPkg = result.results.find((r) => r.name === "fresh-pkg");
    expect(freshPkg?.status).toBe("pass");

    const unknownPkg = result.results.find((r) => r.name === "unknown-pkg");
    expect(unknownPkg?.status).toBe("unknown");
  });

  it("skips allowlisted packages", async () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "test",
        dependencies: { lodash: "4.17.21" },
      }),
    );

    const result = await check({
      cwd: tempDir,
      allowlist: { lodash: "stable library" },
    });

    const lodash = result.results.find((r) => r.name === "lodash");
    expect(lodash?.status).toBe("skip");
    expect(lodash?.reason).toBe("stable library");
    expect(mockGetLastPublishDate).not.toHaveBeenCalled();
  });

  it("uses threshold from options over config", async () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "test",
        dependencies: { express: "4.0.0" },
      }),
    );
    writeFileSync(join(tempDir, "dusty-deps.config.json"), JSON.stringify({ threshold: 1095 }));

    mockGetLastPublishDate.mockResolvedValue(new Date("2025-06-01"));

    const result = await check({ cwd: tempDir, threshold: 1 });
    expect(result.threshold).toBe(1);
    const express = result.results.find((r) => r.name === "express");
    expect(express?.status).toBe("fail");
  });

  it("sorts results: fail > unknown > pass > skip", async () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "test",
        dependencies: {
          "pass-pkg": "1.0.0",
          "fail-pkg": "1.0.0",
          "skip-pkg": "1.0.0",
          "unknown-pkg": "1.0.0",
        },
      }),
    );

    mockGetLastPublishDate.mockImplementation(async (name) => {
      if (name === "fail-pkg") return new Date("2020-01-01");
      if (name === "pass-pkg") return new Date("2026-01-01");
      return null;
    });

    const result = await check({
      cwd: tempDir,
      allowlist: { "skip-pkg": "reason" },
    });

    const statuses = result.results.map((r) => r.status);
    expect(statuses).toEqual(["fail", "unknown", "pass", "skip"]);
  });

  it("handles project with no dependencies", async () => {
    writeFileSync(join(tempDir, "package.json"), JSON.stringify({ name: "empty" }));

    const result = await check({ cwd: tempDir });
    expect(result.checked).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.results).toEqual([]);
  });
});

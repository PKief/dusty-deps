import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { check } from "../../src/core/checker.js";
import type { RegistryResult } from "../../src/core/registry.js";
import { useTempDir } from "../helpers.js";

vi.mock("../../src/core/registry.js", () => ({
  getLastPublishDate: vi.fn(),
}));

import { getLastPublishDate } from "../../src/core/registry.js";

const mockGetLastPublishDate = vi.mocked(getLastPublishDate);
const temp = useTempDir();

afterEach(() => {
  vi.restoreAllMocks();
});

describe("check", () => {
  it("returns results with correct statuses", async () => {
    writeFileSync(
      join(temp.dir, "package.json"),
      JSON.stringify({
        name: "test",
        dependencies: {
          "old-pkg": "1.0.0",
          "fresh-pkg": "2.0.0",
          "unknown-pkg": "3.0.0",
        },
      }),
    );
    writeFileSync(join(temp.dir, "dusty-deps.config.json"), JSON.stringify({ threshold: 1095 }));

    mockGetLastPublishDate.mockImplementation(async (name): Promise<RegistryResult> => {
      if (name === "old-pkg") return { date: new Date("2020-01-01") };
      if (name === "fresh-pkg") return { date: new Date("2026-01-01") };
      return { date: null, error: "registry returned 404" };
    });

    const result = await check({ cwd: temp.dir });

    expect(result.threshold).toBe(1095);
    expect(result.checked).toBe(3);

    const oldPkg = result.results.find((r) => r.name === "old-pkg");
    expect(oldPkg?.status).toBe("fail");
    if (oldPkg?.status === "fail") {
      expect(oldPkg.ageDays).toBeGreaterThan(1095);
    }

    const freshPkg = result.results.find((r) => r.name === "fresh-pkg");
    expect(freshPkg?.status).toBe("pass");

    const unknownPkg = result.results.find((r) => r.name === "unknown-pkg");
    expect(unknownPkg?.status).toBe("unknown");
    if (unknownPkg?.status === "unknown") {
      expect(unknownPkg.error).toBe("registry returned 404");
    }
  });

  it("skips allowlisted packages", async () => {
    writeFileSync(
      join(temp.dir, "package.json"),
      JSON.stringify({
        name: "test",
        dependencies: { lodash: "4.17.21" },
      }),
    );

    const result = await check({
      cwd: temp.dir,
      allowlist: { lodash: "stable library" },
    });

    const lodash = result.results.find((r) => r.name === "lodash");
    expect(lodash?.status).toBe("skip");
    if (lodash?.status === "skip") {
      expect(lodash.reason).toBe("stable library");
    }
    expect(mockGetLastPublishDate).not.toHaveBeenCalled();
  });

  it("uses threshold from options over config", async () => {
    writeFileSync(
      join(temp.dir, "package.json"),
      JSON.stringify({
        name: "test",
        dependencies: { express: "4.0.0" },
      }),
    );
    writeFileSync(join(temp.dir, "dusty-deps.config.json"), JSON.stringify({ threshold: 1095 }));

    mockGetLastPublishDate.mockResolvedValue({ date: new Date("2025-06-01") });

    const result = await check({ cwd: temp.dir, threshold: 1 });
    expect(result.threshold).toBe(1);
    const express = result.results.find((r) => r.name === "express");
    expect(express?.status).toBe("fail");
  });

  it("sorts results: fail > unknown > pass > skip", async () => {
    writeFileSync(
      join(temp.dir, "package.json"),
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

    mockGetLastPublishDate.mockImplementation(async (name): Promise<RegistryResult> => {
      if (name === "fail-pkg") return { date: new Date("2020-01-01") };
      if (name === "pass-pkg") return { date: new Date("2026-01-01") };
      return { date: null };
    });

    const result = await check({
      cwd: temp.dir,
      allowlist: { "skip-pkg": "reason" },
    });

    const statuses = result.results.map((r) => r.status);
    expect(statuses).toEqual(["fail", "unknown", "pass", "skip"]);
  });

  it("handles project with no dependencies", async () => {
    writeFileSync(join(temp.dir, "package.json"), JSON.stringify({ name: "empty" }));

    const result = await check({ cwd: temp.dir });
    expect(result.checked).toBe(0);
    expect(result.counts.fail).toBe(0);
    expect(result.results).toEqual([]);
  });

  it("throws when package.json does not exist", async () => {
    await expect(check({ cwd: temp.dir })).rejects.toThrow("package.json not found");
  });

  it("throws when dependencies field is invalid", async () => {
    writeFileSync(
      join(temp.dir, "package.json"),
      JSON.stringify({ name: "bad", dependencies: "not-an-object" }),
    );

    await expect(check({ cwd: temp.dir })).rejects.toThrow('Invalid "dependencies" field');
  });

  it("returns counts for all statuses", async () => {
    writeFileSync(
      join(temp.dir, "package.json"),
      JSON.stringify({
        name: "test",
        dependencies: {
          "fail-pkg": "1.0.0",
          "pass-pkg": "2.0.0",
          "skip-pkg": "3.0.0",
          "unknown-pkg": "4.0.0",
        },
      }),
    );

    mockGetLastPublishDate.mockImplementation(async (name): Promise<RegistryResult> => {
      if (name === "fail-pkg") return { date: new Date("2020-01-01") };
      if (name === "pass-pkg") return { date: new Date("2026-01-01") };
      return { date: null };
    });

    const result = await check({
      cwd: temp.dir,
      allowlist: { "skip-pkg": "reason" },
    });

    expect(result.counts).toEqual({ fail: 1, pass: 1, skip: 1, unknown: 1 });
  });
});

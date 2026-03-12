import { describe, it, expect, vi } from "vitest";
import { getLastPublishDate } from "../../src/core/registry.js";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "node:child_process";
const mockExecSync = vi.mocked(execSync);

describe("getLastPublishDate", () => {
  it("returns the latest version date, ignoring created/modified", () => {
    mockExecSync.mockReturnValue(
      JSON.stringify({
        created: "2015-01-01T00:00:00.000Z",
        modified: "2026-01-01T00:00:00.000Z",
        "1.0.0": "2018-06-15T00:00:00.000Z",
        "2.0.0": "2023-03-10T00:00:00.000Z",
      })
    );

    const result = getLastPublishDate("test-pkg");
    expect(result).toEqual(new Date("2023-03-10T00:00:00.000Z"));
  });

  it("returns null when npm view fails", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("npm ERR! 404");
    });

    const result = getLastPublishDate("nonexistent-pkg");
    expect(result).toBeNull();
  });

  it("calls npm view with correct arguments", () => {
    mockExecSync.mockReturnValue(JSON.stringify({ "1.0.0": "2024-01-01T00:00:00.000Z" }));

    getLastPublishDate("@scope/my-package");
    expect(mockExecSync).toHaveBeenCalledWith("npm view @scope/my-package time --json", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30_000,
    });
  });

  it("handles single version", () => {
    mockExecSync.mockReturnValue(
      JSON.stringify({ "0.1.0": "2020-05-20T12:00:00.000Z" })
    );

    const result = getLastPublishDate("tiny-pkg");
    expect(result).toEqual(new Date("2020-05-20T12:00:00.000Z"));
  });
});

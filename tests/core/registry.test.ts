import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLastPublishDate } from "../../src/core/registry.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("getLastPublishDate", () => {
  it("returns the latest version date, ignoring created/modified", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        time: {
          created: "2015-01-01T00:00:00.000Z",
          modified: "2026-01-01T00:00:00.000Z",
          "1.0.0": "2018-06-15T00:00:00.000Z",
          "2.0.0": "2023-03-10T00:00:00.000Z",
        },
      }),
    );

    const result = await getLastPublishDate("test-pkg");
    expect(result.date).toEqual(new Date("2023-03-10T00:00:00.000Z"));
    expect(result.error).toBeUndefined();
  });

  it("returns null with error when registry returns 404", async () => {
    mockFetch.mockResolvedValue(jsonResponse({}, 404));

    const result = await getLastPublishDate("nonexistent-pkg");
    expect(result.date).toBeNull();
    expect(result.error).toBe("registry returned 404");
  });

  it("returns null with error when fetch throws", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));

    const result = await getLastPublishDate("failing-pkg");
    expect(result.date).toBeNull();
    expect(result.error).toBe("network error");
  });

  it("calls fetch with correct URL for scoped packages", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        time: { "1.0.0": "2024-01-01T00:00:00.000Z" },
      }),
    );

    await getLastPublishDate("@scope/my-package");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://registry.npmjs.org/@scope%2Fmy-package",
      expect.objectContaining({
        headers: { Accept: "application/json" },
      }),
    );
  });

  it("calls fetch with correct URL for unscoped packages", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        time: { "1.0.0": "2024-01-01T00:00:00.000Z" },
      }),
    );

    await getLastPublishDate("express");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://registry.npmjs.org/express",
      expect.objectContaining({
        headers: { Accept: "application/json" },
      }),
    );
  });

  it("handles single version", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        time: { "0.1.0": "2020-05-20T12:00:00.000Z" },
      }),
    );

    const result = await getLastPublishDate("tiny-pkg");
    expect(result.date).toEqual(new Date("2020-05-20T12:00:00.000Z"));
  });

  it("returns null when response has no time field", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ name: "some-pkg" }));

    const result = await getLastPublishDate("some-pkg");
    expect(result.date).toBeNull();
    expect(result.error).toBe("no time data in registry response");
  });

  it("skips invalid date strings in time data", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        time: {
          "1.0.0": "not-a-date",
          "2.0.0": "2023-06-15T00:00:00.000Z",
        },
      }),
    );

    const result = await getLastPublishDate("mixed-dates-pkg");
    expect(result.date).toEqual(new Date("2023-06-15T00:00:00.000Z"));
  });

  it("returns null when all time entries are invalid dates", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        time: {
          "1.0.0": "garbage",
          "2.0.0": "also-garbage",
        },
      }),
    );

    const result = await getLastPublishDate("bad-dates-pkg");
    expect(result.date).toBeNull();
  });
});

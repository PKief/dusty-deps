import { describe, expect, it } from "vitest";
import { processInBatches } from "../../src/core/concurrency.js";

describe("processInBatches", () => {
  it("processes all items and returns results in order", async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await processInBatches(items, 2, async (n) => n * 10);
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });

  it("handles empty input", async () => {
    const results = await processInBatches([], 5, async (n: number) => n);
    expect(results).toEqual([]);
  });

  it("handles batch size larger than items", async () => {
    const items = [1, 2];
    const results = await processInBatches(items, 10, async (n) => n + 1);
    expect(results).toEqual([2, 3]);
  });

  it("respects batch size for concurrency", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const items = [1, 2, 3, 4, 5];
    await processInBatches(items, 2, async (n) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((resolve) => setTimeout(resolve, 10));
      concurrent--;
      return n;
    });

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it("propagates errors from fn", async () => {
    const items = [1, 2, 3];
    await expect(
      processInBatches(items, 2, async (n) => {
        if (n === 2) throw new Error("fail");
        return n;
      }),
    ).rejects.toThrow("fail");
  });
});

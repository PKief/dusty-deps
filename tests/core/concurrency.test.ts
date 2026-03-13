import { describe, expect, it } from "vitest";
import { processInPool } from "../../src/core/concurrency.js";

describe("processInPool", () => {
  it("processes all items and returns results in order", async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await processInPool(items, 2, async (n) => n * 10);
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });

  it("handles empty input", async () => {
    const results = await processInPool([], 5, async (n: number) => n);
    expect(results).toEqual([]);
  });

  it("handles concurrency larger than items", async () => {
    const items = [1, 2];
    const results = await processInPool(items, 10, async (n) => n + 1);
    expect(results).toEqual([2, 3]);
  });

  it("respects concurrency limit", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const items = [1, 2, 3, 4, 5];
    await processInPool(items, 2, async (n) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((resolve) => setTimeout(resolve, 10));
      concurrent--;
      return n;
    });

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it("keeps all slots busy (pool behavior vs batch behavior)", async () => {
    const timeline: { item: number; start: number; end: number }[] = [];
    const startTime = Date.now();

    // Items with varying durations: one slow (100ms) and rest fast (10ms)
    const items = [1, 2, 3, 4, 5];
    await processInPool(items, 3, async (n) => {
      const start = Date.now() - startTime;
      const duration = n === 1 ? 100 : 10;
      await new Promise((resolve) => setTimeout(resolve, duration));
      const end = Date.now() - startTime;
      timeline.push({ item: n, start, end });
      return n;
    });

    // With pool-based approach, items 4 and 5 should start before item 1 finishes
    // because items 2 and 3 finish quickly, freeing up slots
    const item1End = timeline.find((t) => t.item === 1)?.end ?? 0;
    const fastItems = timeline.filter((t) => t.item > 1);
    const allFastFinishedBeforeSlow = fastItems.every((t) => t.end <= item1End + 15);
    expect(allFastFinishedBeforeSlow).toBe(true);
  });

  it("propagates errors from fn", async () => {
    const items = [1, 2, 3];
    await expect(
      processInPool(items, 2, async (n) => {
        if (n === 2) throw new Error("fail");
        return n;
      }),
    ).rejects.toThrow("fail");
  });
});

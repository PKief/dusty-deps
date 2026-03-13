/**
 * Process items concurrently using a pool-based approach.
 * A new task starts immediately when any slot frees up,
 * keeping all slots busy at all times for maximum throughput.
 */
export async function processInPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];

  const effectiveConcurrency = Math.max(1, Math.min(Math.floor(concurrency), items.length));
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let firstError: unknown = null;

  async function worker(): Promise<void> {
    while (nextIndex < items.length && firstError === null) {
      const index = nextIndex++;
      if (index >= items.length) break;
      try {
        results[index] = await fn(items[index]);
      } catch (error) {
        if (firstError === null) {
          firstError = error;
        }
      }
    }
  }

  const workers = Array.from({ length: effectiveConcurrency }, () => worker());
  await Promise.all(workers);

  if (firstError !== null) {
    throw firstError;
  }

  return results;
}

/**
 * Runs `tasks` with at most `concurrency` workers active at once. Each task
 * receives its zero-based index. Errors from individual tasks are collected
 * into the resulting array under a settled-style envelope.
 */
export async function runWithConcurrency<T>(
  tasks: ReadonlyArray<(index: number) => Promise<T>>,
  concurrency: number,
  onSettled?: (index: number, result: T | undefined, error: unknown) => void,
): Promise<Array<{ value?: T; error?: unknown }>> {
  const total = tasks.length;
  const results = new Array<{ value?: T; error?: unknown }>(total);
  let cursor = 0;

  const workerCount = Math.min(Math.max(1, concurrency | 0), total);

  const workers: Promise<void>[] = [];
  for (let w = 0; w < workerCount; w++) {
    workers.push(
      (async () => {
        while (true) {
          const myIndex = cursor++;
          if (myIndex >= total) return;
          try {
            const value = await tasks[myIndex](myIndex);
            results[myIndex] = { value };
            onSettled?.(myIndex, value, undefined);
          } catch (error) {
            results[myIndex] = { error };
            onSettled?.(myIndex, undefined, error);
          }
        }
      })(),
    );
  }
  await Promise.all(workers);
  return results;
}

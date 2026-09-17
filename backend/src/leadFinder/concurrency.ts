/**
 * Runs `fn` over `items` with at most `limit` in flight at once. Used to
 * research multiple discovered businesses' websites in parallel without
 * either (a) hammering several external sites at once with unbounded
 * concurrency, or (b) taking one request-timeout-risking eternity doing
 * them one at a time.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++
      results[current] = await fn(items[current] as T, current)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

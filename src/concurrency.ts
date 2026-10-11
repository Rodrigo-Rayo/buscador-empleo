export type Settled<R> = { readonly ok: true; readonly value: R } | { readonly ok: false; readonly error: unknown };

/**
 * Ejecuta `task` sobre cada elemento con, como mucho, `limit` tareas a la vez. Devuelve los resultados en orden.
 * Si `shouldStop(error)` es cierto, no se lanzan más tareas (las que ya están en marcha terminan).
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
  shouldStop: (error: unknown) => boolean = () => false,
): Promise<ReadonlyArray<Settled<R> | undefined>> {
  const results: Array<Settled<R> | undefined> = new Array(items.length).fill(undefined);
  let next = 0;
  let stopped = false;

  async function worker(): Promise<void> {
    while (!stopped && next < items.length) {
      const index = next++;
      try {
        results[index] = { ok: true, value: await task(items[index] as T) };
      } catch (error) {
        results[index] = { ok: false, error };
        if (shouldStop(error)) stopped = true;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));
  return results;
}

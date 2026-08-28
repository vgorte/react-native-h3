/** Holds a computed value beside the time the computation took, in milliseconds. */
export type Measured<T> = { value: T; ms: number }

/** Reads the highest resolution clock available, falling back where `performance` is absent. */
export function now(): number {
  const performanceApi = (globalThis as { performance?: { now(): number } }).performance
  return performanceApi == null ? Date.now() : performanceApi.now()
}

/** Runs a synchronous operation and reports how long it took. */
export function measure<T>(run: () => T): Measured<T> {
  const start = now()
  const value = run()
  return { value, ms: now() - start }
}

/** Runs an asynchronous operation and reports the wall time until it settled. */
export async function measureAsync<T>(run: () => Promise<T>): Promise<Measured<T>> {
  const start = now()
  const value = await run()
  return { value, ms: now() - start }
}

/** Formats a duration for the HUD, one decimal below ten milliseconds and none above. */
export function formatMs(ms: number): string {
  // so 9.96 shows as `10 ms`, not `10.0 ms`
  const tenths = Math.round(ms * 10) / 10
  return tenths < 10 ? `${tenths.toFixed(1)} ms` : `${Math.round(ms)} ms`
}

/** Groups a count into thousands with commas, since Hermes ships no full `Intl` on Android. */
export function formatCount(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * Says how much of a build reached the map, which every screen with a cap reports the same way.
 *
 * @param total What the operation produced.
 * @param drawn What the cap let through.
 * @param noun What is being counted, plural.
 */
export function cappedNote(total: number, drawn: number, noun: string): string | undefined {
  if (drawn >= total) return undefined
  return `${formatCount(total)} ${noun}, drawing the first ${formatCount(drawn)}.`
}

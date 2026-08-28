/** Copies a cell buffer into a set, which is what the screens do their algebra on. */
export function toCellSet(cells: BigUint64Array): Set<bigint> {
  return new Set(cells)
}

/** Returns every cell that appears in all of the sets. */
export function intersectCells(sets: readonly ReadonlySet<bigint>[]): Set<bigint> {
  const [first, ...rest] = sets
  if (first == null) return new Set<bigint>()
  const shared = new Set<bigint>()
  for (const cell of first) {
    if (rest.every((set) => set.has(cell))) shared.add(cell)
  }
  return shared
}

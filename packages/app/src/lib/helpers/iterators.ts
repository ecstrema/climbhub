export function* recordOfArrayIterator(r: Record<string | number | symbol, any[]>) {
  for (const slugsByType of Object.values(r)) {
    yield* slugsByType;
  }
}

/** Iterates over an array from the last element to the first, without copying it */
export function* reversed<T>(array: readonly T[]) {
  for (let i = array.length - 1; i >= 0; i--) {
    yield array[i]!;
  }
}

export function* recordOfArrayIterator(r: Record<string | number | symbol, any[]>) {
  for (const slugsByType of Object.values(r)) {
    yield* slugsByType;
  }
}

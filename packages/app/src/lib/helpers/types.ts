import type { SvelteMap } from "svelte/reactivity";

/**
 * Typescript helper to generate a Map equivalent of an object.
 *
 * Maps have the following advantages in our case:
 * - They are iterable, so we can use for..of loops on them.
 * - They have a size property, so we can easily get the number of entries, without having to use Object.keys().length.
 * - They have a clear() method, so we can easily remove all entries.
 * - They have a forEach() method, so we can easily iterate over the entries.
 *
 * The second type parameter M is used to allow for reactie maps. See {@linkcode TypedSvelteMap} for an example of how to use it.
 */
export type TypedMap<T extends object, M extends Map<any, any> = Map<keyof T, T[keyof T]>> = Omit<
  M,
  "get" | "set" | "has" | "delete" | "getOrInsert" | "getOrInsertComputed"
> & {
  get<K extends keyof T>(key: K): T[K] | undefined;
  set<K extends keyof T>(key: K, value: T[K]): TypedMap<T, M>;
  has<K extends keyof T>(key: K): boolean;
  delete<K extends keyof T>(key: K): boolean;
  getOrInsert<K extends keyof T>(key: K, value: T[K]): T[K];
  getOrInsertComputed<K extends keyof T>(key: K, callback: (key: K) => T[K]): T[K];
};

// Create a specific type alias for SvelteMap
export type TypedSvelteMap<T extends object> = TypedMap<T, SvelteMap<keyof T, T[keyof T]>>;

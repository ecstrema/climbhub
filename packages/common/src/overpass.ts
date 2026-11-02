export const OVERPASS_ENDPOINTS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
] as const;

export async function tryOverpassInstances<T>(
  request: (endpoint: string) => Promise<T>,
): Promise<T> {
  const failures: string[] = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      return await request(endpoint);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      failures.push(`${endpoint}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`All Overpass instances failed. ${failures.join("; ")}`);
}

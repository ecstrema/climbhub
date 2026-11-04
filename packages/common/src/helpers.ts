export type BasicOsmType = "node" | "way" | "relation";
export type OsmIdentifier = `${BasicOsmType}:${number}`;

export function getStaticIdentifier(type: BasicOsmType, id: number): OsmIdentifier {
  return `${type}:${id}`;
}

export function getTypeAndIdFromStaticIdentifier(identifier: OsmIdentifier): {
  type: BasicOsmType;
  id: number;
} {
  const [type, id] = identifier.split(":", 2);
  return { type: type as BasicOsmType, id: parseInt(id!) };
}

/** The OSM feature referenced by an `id` query value like `relation-123`, if any. */
export function parseOsmPathSegment(segment: string): { type: BasicOsmType; id: number } | undefined {
  const match = /^(node|way|relation)-(\d+)$/.exec(segment);
  if (!match) return undefined;
  return { type: match[1] as BasicOsmType, id: parseInt(match[2]!) };
}

/** Index files are sharded so that the app downloads only a small part of them. */
export const OSM_INDEX_BUCKETS = 1024;

export function osmIndexFile(type: BasicOsmType, id: number): string {
  return `osm-index/${type}-${id % OSM_INDEX_BUCKETS}.json`;
}

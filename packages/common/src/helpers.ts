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

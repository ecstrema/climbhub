// Writes output/region-names.json: the name of every region of the hierarchy in each language, taken
// from the OSM tags kept in data/ (leaves) and import/raw/ (groups). `bun run region-names`.
// The position in the array is the id of the region (`nameId` in the static API), keep the order.
import { existsSync, readFileSync, writeFileSync } from "fs";
import { DATA_DIR, HIERARCHY_INDEX, OUTPUT_DIR } from "../src/config.ts";
import { REGIONS } from "../import/regions.ts";

export const LANGUAGES = ["en", "de", "fr", "es", "it", "pt"] as const;
export type RegionName = { path: string } & Record<(typeof LANGUAGES)[number], string>;

const RAW = `${import.meta.dirname}/../import/raw`;
const CONTINENTS: Record<string, Record<string, string>> = {
  "americas/north": { en: "North America", de: "Nordamerika", fr: "Amérique du Nord", es: "Norteamérica", it: "America del Nord", pt: "América do Norte" },
  "americas/south": { en: "South America", de: "Südamerika", fr: "Amérique du Sud", es: "Sudamérica", it: "America del Sud", pt: "América do Sul" },
  "americas/central": { en: "Central America", de: "Mittelamerika", fr: "Amérique centrale", es: "Centroamérica", it: "America centrale", pt: "América Central" },
  "americas/antilles": { en: "Antilles", de: "Antillen", fr: "Antilles", es: "Antillas", it: "Antille", pt: "Antilhas" },
  world: { en: "World", de: "Welt", fr: "Monde", es: "Mundo", it: "Mondo", pt: "Mundo" },
  africa: { en: "Africa", de: "Afrika", fr: "Afrique", es: "África", it: "Africa", pt: "África" },
  americas: { en: "Americas", de: "Amerika", fr: "Amériques", es: "América", it: "Americhe", pt: "Américas" },
  asia: { en: "Asia", de: "Asien", fr: "Asie", es: "Asia", it: "Asia", pt: "Ásia" },
  europe: { en: "Europe", de: "Europa", fr: "Europe", es: "Europa", it: "Europa", pt: "Europa" },
  oceania: { en: "Oceania", de: "Ozeanien", fr: "Océanie", es: "Oceanía", it: "Oceania", pt: "Oceania" },
};
const displayNames = Object.fromEntries(LANGUAGES.map((l) => [l, new Intl.DisplayNames(l, { type: "region" })]));

type Tags = Record<string, string>;
/** Without the other languages of bilingual names ("Cymru / Wales") */
const first = (name: string | undefined) => name?.split("/")[0]?.trim() || undefined;

function walk(node: Record<string, any>, path: string[], out: string[]) {
  for (const key of Object.keys(node)) {
    if (key === "_bbox") continue;
    out.push([...path, key].join("/"));
    walk(node[key], [...path, key], out);
  }
}

function leafTags(path: string): Tags | undefined {
  const file = `${DATA_DIR}/${path}.geojson`;
  if (!existsSync(file)) return;
  const features: any[] = JSON.parse(readFileSync(file, "utf8")).features;
  return features.find((f) => f.properties?.name)?.properties;
}

const regionByPath = new Map(REGIONS.map((r) => [`world/${r.path}`, r]));
const rawCache = new Map<string, any[]>();
function groupTags(path: string): { tags?: Tags; code?: string } {
  const region = regionByPath.get(path);
  if (!region) {
    // A country made of its subdivisions: its code is their prefix
    const child = REGIONS.find((r) => r.code.includes("-") && !`world/${r.path}`.slice(path.length + 1).includes("/") && `world/${r.path}`.startsWith(`${path}/`));
    return { code: child?.code.split("-")[0] };
  }
  const file = `${RAW}/${region.code}.json`;
  if (!rawCache.has(file)) rawCache.set(file, existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).elements : []);
  const relation = rawCache
    .get(file)!
    .find(
      (e) =>
        e.type === "relation" &&
        (region.osm ? e.id === region.osm : e.tags?.["ISO3166-2"] === region.code || e.tags?.["ISO3166-1"] === region.code),
    );
  return { tags: relation?.tags, code: region.code };
}

const title = (slug: string) => slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function nameOf(path: string): RegionName {
  const slug = path.split("/").at(-1)!;
  const continent = CONTINENTS[path.replace(/^world\//, "")];
  if (continent) return { path, ...continent } as RegionName;

  const group = groupTags(path);
  const tags = leafTags(path) ?? group.tags ?? {};
  const country = group.code && /^[A-Z]{2}$/.test(group.code) ? group.code : undefined;
  const result: Record<string, string> = {};
  for (const lang of LANGUAGES) {
    result[lang] =
      (country && displayNames[lang]!.of(country)) ||
      first(tags[`name:${lang}`]) ||
      (lang === "en" ? first(tags.int_name) || first(tags.name) : undefined) ||
      result.en ||
      title(slug);
  }
  return { path, ...result } as RegionName;
}

const index = JSON.parse(readFileSync(HIERARCHY_INDEX, "utf8"));
const paths: string[] = [];
walk(index, [], paths);
const names = paths.map(nameOf);
writeFileSync(`${OUTPUT_DIR}/region-names.json`, JSON.stringify(names));
console.log(`${names.length} regions written`);

import { resolve } from "$app/paths";
import type { DataJSONRecord } from "$lib/types";
import type { LayoutLoad } from "./$types";

// TODO: return immediate data with
//  own: DataJSON,
// and the rest as streaming data:
//  elements: Promise<DataJSONRecord>
export const load: LayoutLoad<{
  elements: DataJSONRecord;
}> = async ({ params, fetch }) => {
  const childrenToFetch: string[] = [""];

  if (!params.slug) {
    return {
      elements: await fetchAllChildren(childrenToFetch),
    };
  }

  let acc: string[] = [];
  const segments = params.slug.split("/").map((segment) => {
    acc.push(segment);
    return acc.join("/");
  });
  childrenToFetch.push(...segments);
  const own = childrenToFetch.pop()!;
  const ownData = await fetchChildren(own);

  return {
    elements: await fetchAllChildren(childrenToFetch),
  };

  async function fetchAllChildren(slugs: string[]): Promise<DataJSONRecord> {
    const results = await Promise.all(slugs.map(fetchChildren));

    return Object.assign({ ...ownData }, ...results);
  }

  async function fetchChildren(slug: string): Promise<DataJSONRecord> {
    const res = await fetch(resolve("/api/world/[...slug]/children.json", { slug }));
    if (!res.ok) {
      console.log(`Failed to fetch data for slug: ${slug}`, res.status, res.statusText);
      return {};
    }
    return res.json() as Promise<DataJSONRecord>;
  }
};

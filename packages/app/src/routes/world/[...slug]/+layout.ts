import { resolve } from "$app/paths";
import type { DataJSONRecord } from "$lib/types";
import type { LayoutLoad } from "./$types";

export const load: LayoutLoad<{
  data: DataJSONRecord;
}> = async ({ params, fetch }) => {
  const childrenToFetch: string[] = [""];

  const slug = params.slug;
  if (!slug) {
    return {
      data: await fetchAll(childrenToFetch),
    };
  }

  let acc: string[] = [];
  const segments = slug.split("/").map((segment) => {
    acc.push(segment);
    return acc.join("/");
  });
  childrenToFetch.push(...segments);

  return {
    data: await fetchAll(childrenToFetch),
  };

  function fetchAll(slugs: string[]) {
    return Promise.all(
      slugs.map(async (slug) => {
        const res = await fetch(resolve("/api/world/[...slug]/children.json", { slug }));
        if (!res.ok) {
          console.log(`Failed to fetch data for slug: ${slug}`, res.status, res.statusText);
          return {};
        }
        return res.json() as Promise<DataJSONRecord>;
      }),
    ).then((results) => {
      return results.reduce((acc, result) => Object.assign(acc, result), {});
    });
  }
};

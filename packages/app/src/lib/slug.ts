/** Does not include the current slug. */
export function getParentSlugs(slug: string): string[] {
  if (slug === "") return [];

  const slugs = [""];
  let acc: string = "";
  for (const char of slug) {
    if (char === "/") {
      slugs.push(acc);
    }
    acc += char;
  }
  return slugs;
}

export function getParentSlug(slug: string): string | undefined {
  if (slug === "") return undefined;

  const lastSlashIndex = slug.lastIndexOf("/");

  // This is one of the first generation slugs, like "north-america" or "europe". Their parent is the world slug: ""
  if (lastSlashIndex === -1) return "";

  return slug.substring(0, lastSlashIndex);
}

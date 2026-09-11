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

export function getParentSlug(slug: string): string {
  const lastSlashIndex = slug.lastIndexOf("/");
  if (lastSlashIndex === -1) return "";

  return slug.substring(0, lastSlashIndex);
}

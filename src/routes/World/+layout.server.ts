import type { LayoutServerLoad } from "./$types";
import { getDataTree } from "$lib/data";

export const load: LayoutServerLoad = async () => {
  const dataTree = getDataTree();

  return { dataTree };
};

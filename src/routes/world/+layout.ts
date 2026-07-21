import { asset } from "$app/paths";
import type { LayoutLoad } from "./$types";

// export const load: LayoutLoad = async ({ params, fetch }) => {
//   // 1. Always fetch the root level of the sidebar
//   const rootRes = await fetch(asset("/api/world/tree.json"));
//   const rootTree = rootRes.ok ? await rootRes.json() : [];

//   const expandedTrees: Record<string, any[]> = {};

//   // 2. If the user directly links to a deep path (e.g. /canada/quebec),
//   // we must fetch those intermediate tree.jsons at build time so the
//   // sidebar renders instantly fully expanded without layout shift!
//   if (params.slug) {
//     const segments = params.slug.split("/");
//     let currentPath = "";

//     for (const segment of segments) {
//       currentPath = currentPath ? `${currentPath}/${segment}` : segment;
//       const res = await fetch(asset(`/api/${currentPath}/tree.json`));
//       if (res.ok) {
//         expandedTrees[currentPath] = await res.json();
//       }
//     }
//   }

//   return { rootTree, expandedTrees };
// };

import { error } from "@sveltejs/kit"
import { allRoutes, areaIndex } from "$lib/data.js"

import { getRouteFromPath } from "$lib/data.js"
import { base } from "$app/paths"

/** @type {import('./$types').PageLoad} */
export async function load({ params }) {
  const routeData = await getRouteFromPath(params.route)
  if (routeData) {
    return routeData
  }

  return error(404, `Not found`)
}

export async function entries() {
  const result = Object.keys(allRoutes).map((route) => {
    if (route.endsWith(areaIndex)) {
      return { route: route.replace("/src/data/routes/", "").slice(0, -areaIndex.length - 1) }
    }
    return { route: route.replace("/src/data/routes/", "").slice(0, -3) }
  })

  return result
}

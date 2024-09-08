import { error } from "@sveltejs/kit"


import { getRouteFromPath } from "$lib/data.js"

/** @type {import('./$types').PageLoad} */
export async function load({ params }) {
  const routeData = getRouteFromPath(params.route)
  if (routeData) {
    return routeData
  }

  return error(404, `Not found`)
}

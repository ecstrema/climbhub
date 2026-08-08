export * from "./types";
import type { Scale, BoulderScaleId, RouteScaleId } from "./types";

import { french } from "./route/french";
import { yds } from "./route/yds";
import { uiaa } from "./route/uiaa";

import { fb } from "./bouldering/fb";
import { hueco } from "./bouldering/hueco";

export { french, yds, uiaa, fb, hueco };

export const allRouteScales: Scale<RouteScaleId>[] = [french, yds, uiaa];
export const allBoulderScales: Scale<BoulderScaleId>[] = [fb, hueco];

export const allScales: Scale[] = [...allRouteScales, ...allBoulderScales];
export const allScalesMap = Object.fromEntries(allScales.map((scale) => [scale.id, scale]));

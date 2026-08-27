export * from "./types";
import type { Scale, BoulderScaleId, RouteScaleId, ScaleId, IceScaleId } from "./types";

import { french } from "./route/french";
import { yds } from "./route/yds";
import { uiaa } from "./route/uiaa";

import { fb } from "./bouldering/fb";
import { hueco } from "./bouldering/hueco";

import { wi } from "./ice/wi";

export { french, yds, uiaa, fb, hueco };

export const allRouteScales: Scale<RouteScaleId>[] = [french, yds, uiaa];
export const allBoulderScales: Scale<BoulderScaleId>[] = [fb, hueco];
export const allIceScales: Scale<IceScaleId>[] = [wi];
export const allScales: Scale[] = [...allRouteScales, ...allBoulderScales, ...allIceScales];

export const allScalesMap = Object.fromEntries(
  allScales.map((scale) => [scale.id, scale]),
) as Record<ScaleId, Scale>;

export function getScaleFromId(s: ScaleId): Scale | undefined {
  return allScalesMap[s];
}

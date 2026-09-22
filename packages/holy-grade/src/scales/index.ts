export * from "./types";
import type { Scale, BoulderScaleId, RouteScaleId, ScaleId, IceScaleId } from "./types";

import { french } from "./route/french";
import { yds } from "./route/yds";
import { uiaa } from "./route/uiaa";
import { saxon } from "./route/saxon";

import { fb } from "./bouldering/fb";
import { hueco } from "./bouldering/hueco";

import { wi } from "./ice/wi";

export { french, yds, uiaa, saxon, fb, hueco };

export const allRouteScales: Scale<RouteScaleId>[] = [french, yds, uiaa, saxon];
export const allBoulderScales: Scale<BoulderScaleId>[] = [fb, hueco];
export const allIceScales: Scale<IceScaleId>[] = [wi];
export const allScales: Scale[] = [...allRouteScales, ...allBoulderScales, ...allIceScales];

export const allScalesMap = new Map(allScales.map((scale) => [scale.id, scale]));

export function getScaleFromId(s: ScaleId): Scale | undefined {
  return allScalesMap.get(s);
}

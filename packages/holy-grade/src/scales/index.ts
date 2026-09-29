export { french } from "./route/french";
export { fb } from "./bouldering/fb";
export { yds } from "./route/yds";
export { uiaa } from "./route/uiaa";
export { saxon } from "./route/saxon";
export { ukTech } from "./route/uk-tech";
export { ukAdj } from "./route/uk-adj";
export { frenchBritish } from "./route/french-british";
export { scandinavian } from "./route/scandinavian";
export { polish } from "./route/polish";
export { hueco } from "./bouldering/hueco";
export { wi } from "./other/wi";
export { mixed } from "./other/mixed";
export { dryTooling } from "./other/dry-tooling";
export { aid } from "./other/aid";

import type { AidScaleId, BoulderScaleId, IceScaleId, RouteScaleId, Scale, ScaleId } from "./types";

import { french } from "./route/french";
import { fb } from "./bouldering/fb";
import { yds } from "./route/yds";
import { uiaa } from "./route/uiaa";
import { saxon } from "./route/saxon";
import { ukTech } from "./route/uk-tech";
import { ukAdj } from "./route/uk-adj";
import { frenchBritish } from "./route/french-british";
import { scandinavian } from "./route/scandinavian";
import { polish } from "./route/polish";
import { hueco } from "./bouldering/hueco";
import { wi } from "./other/wi";
import { mixed } from "./other/mixed";
import { dryTooling } from "./other/dry-tooling";
import { aid } from "./other/aid";

export const allScales: Scale[] = [
  french,
  yds,
  uiaa,
  saxon,
  ukTech,
  ukAdj,
  frenchBritish,
  scandinavian,
  polish,
  fb,
  hueco,
  wi,
  mixed,
  dryTooling,
  aid,
];

export const scalesById: Map<ScaleId, Scale> = new Map(allScales.map((s) => [s.id, s]));

export const { allAidScales, allBoulderScales, allIceScales, allRouteScales } =
  getScalesByType(allScales);

function getScalesByType(scales: Scale[]) {
  const allRouteScales: Scale<RouteScaleId>[] = [];
  const allBoulderScales: Scale<BoulderScaleId>[] = [];
  const allIceScales: Scale<IceScaleId>[] = [];
  const allAidScales: Scale<AidScaleId>[] = [];

  for (const scale of scales) {
    switch (scale.gradeType) {
      case "route":
        allRouteScales.push(scale as Scale<RouteScaleId>);
        break;
      case "boulder":
        allBoulderScales.push(scale as Scale<BoulderScaleId>);
        break;
      case "ice":
        allIceScales.push(scale as Scale<IceScaleId>);
        break;
      case "aid":
        allAidScales.push(scale as Scale<AidScaleId>);
        break;
    }
  }
  return { allRouteScales, allBoulderScales, allIceScales, allAidScales };
}

export function getScale(id: ScaleId): Scale | undefined {
  return scalesById.get(id);
}

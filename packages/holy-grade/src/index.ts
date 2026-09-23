import type { AidScaleId, BoulderScaleId, IceScaleId, RouteScaleId, Scale, ScaleId } from "./scales/types";
import { french } from "./scales/route/french";
import { fb } from "./scales/bouldering/fb";
import { yds } from "./scales/route/yds";
import { uiaa } from "./scales/route/uiaa";
import { saxon } from "./scales/route/saxon";
import { ukTech } from "./scales/route/uk-tech";
import { ukAdj } from "./scales/route/uk-adj";
import { frenchBritish } from "./scales/route/french-british";
import { scandinavian } from "./scales/route/scandinavian";
import { polish } from "./scales/route/polish";
import { hueco } from "./scales/bouldering/hueco";
import { wi } from "./scales/other/wi";
import { mixed } from "./scales/other/mixed";
import { dryTooling } from "./scales/other/dry-tooling";
import { aid } from "./scales/other/aid";

export * from "./scales/types";
export * from "./scales/helpers";
export {
  french,
  fb,
  yds,
  uiaa,
  saxon,
  ukTech,
  ukAdj,
  frenchBritish,
  scandinavian,
  polish,
  hueco,
  wi,
  mixed,
  dryTooling,
  aid,
};

export const allScales: readonly Scale[] = [
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

export const scalesById: ReadonlyMap<ScaleId, Scale> = new Map(allScales.map((s) => [s.id, s]));

// TODO: this should be done in a single pass, not with so many filters.
export const allRouteScales: readonly Scale<RouteScaleId>[] = allScales.filter(
  (s): s is Scale<RouteScaleId> => s.gradeType === "route",
);
export const allBoulderScales: readonly Scale<BoulderScaleId>[] = allScales.filter(
  (s): s is Scale<BoulderScaleId> => s.gradeType === "boulder",
);
export const allIceScales: readonly Scale<IceScaleId>[] = allScales.filter(
  (s): s is Scale<IceScaleId> => s.gradeType === "ice",
);
export const allAidScales: readonly Scale<AidScaleId>[] = allScales.filter(
  (s): s is Scale<AidScaleId> => s.gradeType === "aid",
);

export function getScale(id: ScaleId): Scale | undefined {
  return scalesById.get(id);
}

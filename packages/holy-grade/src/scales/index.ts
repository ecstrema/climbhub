export * from "./types";

import * as French from "./route/french";
import * as YDS from "./route/yds";
import * as UIAA from "./route/uiaa";

import * as FB from "./bouldering/fb";
import * as Hueco from "./bouldering/hueco";

export { French, YDS, UIAA, FB, Hueco };

export const allScales = [French, YDS, UIAA, FB, Hueco];
export const allScalesMap = Object.fromEntries(allScales.map((scale) => [scale.nameShort, scale]));

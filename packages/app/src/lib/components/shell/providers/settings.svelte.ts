import { createContext } from "svelte";

import type { FromCurrent } from "./types";
import type { RouteScaleId, BoulderScaleId } from "@climbhub/holy-grade";

export const [getPreferredRouteGradingScale, setPreferredRouteGradingScale] =
  createContext<FromCurrent<RouteScaleId | "local">>();
export const [getPreferredBoulderGradingScale, setPreferredBoulderGradingScale] =
  createContext<FromCurrent<BoulderScaleId | "local">>();

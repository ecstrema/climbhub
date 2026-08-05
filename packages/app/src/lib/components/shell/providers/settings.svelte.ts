import { createContext } from "svelte";

import type { FromCurrent } from "./types";
import type { ScaleName } from "holy-grade";

export const [getPreferredGradeScale, setPreferredGradeScale] =
  createContext<FromCurrent<ScaleName | "local">>();

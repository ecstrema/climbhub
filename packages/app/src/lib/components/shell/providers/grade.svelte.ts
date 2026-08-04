import { createContext } from "svelte";
import type { GradeScalesTypes } from "@openbeta/sandbag";
import type { FromCurrent } from "./types";

export const [getPreferredGradeScale, setPreferredGradeScale] =
  createContext<FromCurrent<GradeScalesTypes>>();

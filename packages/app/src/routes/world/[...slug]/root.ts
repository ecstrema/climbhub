import type { RecursiveData } from "$lib/types";
import type { DataJSON } from "climbing-data-gen";

export const rootElement: RecursiveData<DataJSON> = {
  own: { type: "geographic", name: "World" },
  children: {},
};

import type { DataJSON } from "@climbhub/climbing-data-gen";
import type { AreaStats } from "#lib/types.js";

export interface TagFilter {
  key: string;
  /** Empty means that the tag only has to be present */
  value: string;
}

export interface SearchFilters {
  text: string;
  /** A place matches any of the types. Empty means any type. */
  types: ("route" | "area" | "gym")[];
  /** Grade reference numbers, see getGradeReference */
  gradeMin?: number | undefined;
  gradeMax?: number | undefined;
  /** Styles like sport or trad, matching the `climbing:<style>=yes` tag. A place matches any of them. */
  styles: string[];
  tags: TagFilter[];
}

export interface TopLevelPoint {
  slug: string;
  name: string | undefined;
  lat: number;
  lon: number;
}

export type DbRequest =
  | { id: number; type: "status"; version: string }
  | { id: number; type: "getTopLevel" }
  | { id: number; type: "build"; url: string; version: string }
  | { id: number; type: "getNode"; slug: string }
  | { id: number; type: "getChildren"; slug: string }
  | { id: number; type: "getStats"; slug: string }
  | { id: number; type: "filterStart"; searchId: number; filters: SearchFilters; budgetMs: number }
  /** Continues a search that paused after using its time budget */
  | { id: number; type: "filterMore"; searchId: number; budgetMs: number }
  | { id: number; type: "filterCancel"; searchId: number };

export type DbResponse =
  | { id: number; type: "status"; ready: boolean; persistent: boolean }
  | { id: number; type: "node"; data: DataJSON | undefined }
  | { id: number; type: "children"; data: Record<string, DataJSON> }
  | { id: number; type: "stats"; data: AreaStats | undefined }
  | { id: number; type: "topLevel"; data: TopLevelPoint[] }
  /** Streamed while a search runs, without being a reply to a request */
  | { type: "matchBatch"; searchId: number; slugs: string[] }
  /** The search used its time budget (`exhausted` false) or has no more results */
  | { id: number; type: "matchPause"; exhausted: boolean }
  | { id: number; type: "progress"; loaded: number; total: number | undefined }
  | { id: number; type: "error"; message: string };

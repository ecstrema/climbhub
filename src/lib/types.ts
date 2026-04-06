import { ArkErrors, type } from "arktype";

export const Coordinates = type(["number", "number"]);

export const RouteKind = type(
  "'Trad' | 'Sport' | 'Boulder' | 'Ice' | 'Mixed' | 'Aid' | 'Alpine' | 'Toprope'",
);

export const RouteFrontmatter = type({
  "kind?": RouteKind,
  "name?": "string",
  "grade?": "string",
  "height?": "string",
  "protection?": "string",
  "coordinates?": Coordinates,
  "rating?": "0 <= number <= 5",
});

export interface RouteNode {
  type: "route";
  name: string;

  link: string;
  html?: string;
  parent: AreaNode;

  errors?: ArkErrors;

  kind?: typeof RouteKind.infer;
  grade?: string;
  height?: string;
  protection?: string;
  coordinates?: [number, number];
  rating?: number;
}

export const AreaFrontmatter = type({
  "name?": "string",
  "coordinates?": Coordinates,
});

export interface AreaNode {
  type: "area";
  name: string;
  link: string;
  html?: string;
  children?: Record<string, AreaNode | RouteNode>;
  parent: AreaNode | null;

  errors?: ArkErrors;

  coordinates?: [number, number];
}

export type TreeNode = RouteNode | AreaNode;

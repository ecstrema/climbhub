import { ArkErrors, type } from "arktype";

export const Coordinates = type(["number", "number"]);

export const RouteKind = type(
  "'Trad' | 'Sport' | 'Boulder' | 'Ice' | 'Mixed' | 'Aid' | 'Alpine' | 'Toprope'",
);

export const RouteFrontmatter = type({
  "routeKind?": RouteKind,
  "name?": "string",
  "grade?": "string",
  "height?": "string",
  "description?": "string",
  "protection?": "string",
  "coordinates?": Coordinates,
});

export interface RouteNode {
  kind: "route";
  name: string;
  link?: string;

  errors?: ArkErrors;

  routeKind?: string;
  grade?: string;
  height?: string;
  description?: string;
  protection?: string;
  coordinates?: [number, number];
}

export const AreaFrontmatter = type({
  "name?": "string",
  "coordinates?": Coordinates,
});

export interface AreaNode {
  kind: "area";
  name: string;
  link?: string;
  children?: Record<string, AreaNode | RouteNode>;

  errors?: ArkErrors;

  coordinates?: [number, number];
}

export type TreeNode = RouteNode | AreaNode;

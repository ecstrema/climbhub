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
  "description?": "string",
  "protection?": "string",
  "coordinates?": Coordinates,
});

export interface RouteNode {
  type: "route";
  name: string;
  link?: string;

  errors?: ArkErrors;

  kind?: string;
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
  type: "area";
  name: string;
  link?: string;
  children?: Record<string, AreaNode | RouteNode>;

  errors?: ArkErrors;

  coordinates?: [number, number];
}

export type TreeNode = RouteNode | AreaNode;

export interface BoundingBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * A node of hierarchy-index.json. The other keys are the children, by slug. A node without
 * children is a leaf: its boundary is `data/<path>.geojson`.
 */
export interface IndexNode {
  _bbox: BoundingBox;
  [key: string]: any;
}

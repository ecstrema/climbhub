export interface YamlConfig {
  query?: string;
  multiple?: boolean;
  delegateTo?: string;
  displayName?: string;
}

export interface BoundingBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface IndexNode {
  _bbox: BoundingBox;
  _name?: string;
  [key: string]: any;
}

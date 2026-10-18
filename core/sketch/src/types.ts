/** Coordinates are in the caller's document units; conversion happens at the adapter. */
export type Point = [number, number];
export interface CubicControls { c1: Point; c2: Point }
/** Controls[i] belongs to the edge from points[i] to the next point. */
export type NodeMode = 'corner' | 'smooth' | 'symmetric';
export interface SketchPath {
  subpaths?: SketchPath[];
  fillRule?: 'evenodd' | 'nonzero';
  nodeModes?: NodeMode[];
  points: Point[];
  curves?: Array<CubicControls | null>;
  closed: boolean;
}

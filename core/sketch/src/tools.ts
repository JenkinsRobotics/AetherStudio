import { ellipsePath } from './primitives';
import { constrainAngle } from './snapping';
import { samplePath } from './curves';
import type { CubicControls, Point, NodeMode } from "./types";
import {
  closesOnStart,
  ellipsePolygon,
  isUsableShape,
  rectPolygon,
  regularPolygon,
  simplify,
} from "./geometry";

/**
 * Shared drawing tools, as a pure state machine.
 *
 * A tool turns pointer coordinates into a retained path or polygon. The canvas owns
 * the pointer; this module owns what the pointer means, so every tool's
 * behaviour is testable without a browser and identical between the editor
 * and anything else that ever hosts it.
 */

export type SketchTool =
  | "line"
  | "select"
  | "node"
  | "pen"
  | "rect"
  | "square"
  | "ellipse"
  | "circle"
  | "polygon"
  | "freehand"
  | "paint";

const DRAWING_TOOLS: readonly SketchTool[] = [
  "line",
  "pen",
  "rect",
  "square",
  "ellipse",
  "circle",
  "polygon",
  "freehand",
  "paint",
];

export const TOOL_SHORTCUTS: Record<string, SketchTool> = {
  l: "line",
  v: "select",
  a: "node",
  p: "pen",
  m: "rect",
  e: "ellipse",
  g: "polygon",
  n: "freehand",
  b: "paint",
};

/** All distances use the host's document units. Pixel profiles belong in adapters. */
export interface ToolOptions {
  coordinateStep: number;
  minimumArea: number;
  curveTolerance: number;
  freehandTolerance: number;
  closeTolerance: number;
  dragThreshold: number;
  polygonSides: number;
  curvedPrimitives?: boolean;
  closePenOnFinish?: boolean;
}
export const DEFAULT_TOOL_OPTIONS: ToolOptions = {
  coordinateStep: 0, minimumArea: 1e-12, curveTolerance: 1e-6, freehandTolerance: 0,
  closeTolerance: 1e-6, dragThreshold: 1e-6, polygonSides: 6, curvedPrimitives: true, closePenOnFinish: true,
};

export interface Draft {
  tool: SketchTool;
  options?: ToolOptions;
  tangents?: Point[];
  penAnchor?: number;
  penPress?: Point;
  penClosing?: boolean;
  /** Pen: committed vertices. Freehand: the raw stroke. Drag tools: [start]. */
  points: Point[];
  /** Where the pointer is now, for the live preview. */
  cursor: Point;
  /** Shift turns Rectangle/Ellipse into their square/circle variants. */
  constrained?: boolean;
}

export function isDrawingTool(tool: SketchTool): boolean {
  return DRAWING_TOOLS.includes(tool);
}

/** A pointer-down with a drawing tool. Pen and freehand start collecting. */
export function beginDraft(tool: SketchTool, at: Point, constrained = false, options: Partial<ToolOptions> = {}): Draft | null {
  if (!isDrawingTool(tool)) return null;
  return { tool, points: [at], cursor: at, constrained, options: { ...DEFAULT_TOOL_OPTIONS, ...options } };
}

/** A pointer-move. Only freehand records the path; the rest just track. */
export function moveDraft(draft: Draft, at: Point, constrained = draft.constrained ?? false): Draft {
  const options = draft.options ?? DEFAULT_TOOL_OPTIONS;
  if (draft.tool === "freehand" || draft.tool === "paint") return { ...draft, points: [...draft.points, at], cursor: at };
  if (draft.tool === 'pen' && draft.penAnchor !== undefined) {
    const tangents = draft.points.map((_, i) => draft.tangents?.[i] ?? [0, 0] as Point), anchor = draft.points[draft.penAnchor];
    if (draft.penPress && Math.hypot(at[0] - draft.penPress[0], at[1] - draft.penPress[1]) < options.dragThreshold) return { ...draft, cursor: at };
    let dx = at[0] - anchor[0], dy = at[1] - anchor[1];
    if (constrained) { const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4, distance = Math.hypot(dx, dy); dx = Math.cos(angle) * distance; dy = Math.sin(angle) * distance; }
    tangents[draft.penAnchor] = Math.hypot(dx, dy) < options.dragThreshold ? [0, 0] : [dx, dy];
    return { ...draft, tangents, cursor: at, constrained };
  }
  return { ...draft, cursor: at, constrained };
}

export type DraftStep =
  | { kind: "continue"; draft: Draft }
  | { kind: "commit"; shape: Point[]; curves?: Array<CubicControls | null>; closed?: boolean; nodeModes?: NodeMode[] }
  | { kind: "discard" };

/**
 * A pointer-up. Drag tools commit; freehand commits a simplified stroke; pen
 * adds a vertex, or closes when the click lands back on the first one.
 */
export function endDraft(draft: Draft, at: Point, constrained = draft.constrained ?? false): DraftStep {
  const options = draft.options ?? DEFAULT_TOOL_OPTIONS;
  const commit = (shape: Point[]) => commitIfUsable(shape, options.minimumArea);
  switch (draft.tool) {
    case "line": {
      const end = constrained ? constrainAngle(draft.points[0], at) : at;
      return Math.hypot(end[0] - draft.points[0][0], end[1] - draft.points[0][1]) > 1e-9 ? { kind: 'commit', shape: [draft.points[0], end], closed: false } : { kind: 'discard' };
    }
    case "rect":
      return commit(rectPolygon(draft.points[0], constrained ? equalAxisEnd(draft.points[0], at) : at, options.coordinateStep));
    case "square":
      return commit(rectPolygon(draft.points[0], equalAxisEnd(draft.points[0], at), options.coordinateStep));
    case "ellipse":
      if (options.curvedPrimitives) return commitEllipse(draft.points[0], constrained ? equalAxisEnd(draft.points[0], at) : at, options.minimumArea);
      return commit(ellipsePolygon(draft.points[0], constrained ? equalAxisEnd(draft.points[0], at) : at, 48, options.coordinateStep));
    case "circle":
      if (options.curvedPrimitives) return commitEllipse(draft.points[0], equalAxisEnd(draft.points[0], at), options.minimumArea);
      return commit(ellipsePolygon(draft.points[0], equalAxisEnd(draft.points[0], at), 48, options.coordinateStep));
    case "polygon":
      return commit(regularPolygon(draft.points[0], at, options.polygonSides, options.coordinateStep));
    case "freehand":
      return commit(simplify([...draft.points, at], options.freehandTolerance, options.coordinateStep));
    // A painted stroke is a line, not an area: two points is a legitimate mark,
    // so it skips the "is this a usable shape" test a mask has to pass.
    case "paint": {
      const stroke = simplify([...draft.points, at], options.freehandTolerance, options.coordinateStep);
      return stroke.length >= 2 ? { kind: "commit", shape: stroke } : { kind: "discard" };
    }
    case "pen": {
      if (draft.penAnchor !== undefined) {
        const next = moveDraft(draft, at, constrained);
        return next.penClosing ? finishPen(next, true) : { kind: 'continue', draft: { ...next, penAnchor: undefined, penClosing: false } };
      }
      if (closesOnStart(draft.points, at, options.closeTolerance)) {
        return commit(draft.points);
      }
      return { kind: "continue", draft: { ...draft, points: [...draft.points, at], cursor: at } };
    }
    default:
      return { kind: "discard" };
  }
}

/** Enter or double-click finishes a pen shape without returning to the start. */
export function finishPen(draft: Draft, closed = draft.options?.closePenOnFinish ?? true): DraftStep {
  if (draft.tool !== 'pen') return { kind: 'discard' };
  const curves = penCurves(draft);
  if (!closed && curves.length) curves[curves.length - 1] = null;
  const shape = samplePath({ points: draft.points, curves, closed }, (draft.options ?? DEFAULT_TOOL_OPTIONS).curveTolerance);
  const usable = closed ? isUsableShape(shape, (draft.options ?? DEFAULT_TOOL_OPTIONS).minimumArea)
    : draft.points.length >= 2 && shape.some(p => Math.hypot(p[0] - shape[0][0], p[1] - shape[0][1]) > 1e-9);
  return usable ? { kind: 'commit', shape: draft.points, closed, ...(curves.some(Boolean) ? { curves } : {}),
    nodeModes: draft.points.map((_, i) => draft.tangents?.[i]?.some(Boolean) ? 'symmetric' : 'corner') } : { kind: 'discard' };
}

function commitEllipse(a: Point, b: Point, minimumArea: number): DraftStep {
  const path = ellipsePath(a, b);
  return Math.PI * Math.abs(b[0] - a[0]) * Math.abs(b[1] - a[1]) / 4 >= minimumArea
    ? { kind: 'commit', shape: path.points, curves: path.curves, nodeModes: path.nodeModes, closed: true } : { kind: 'discard' };
}

/** Pointer-down establishes the anchor; a drag pulls mirrored tangent handles. */
export function penPointerDown(draft: Draft | null, at: Point, tolerance = draft?.options?.closeTolerance ?? DEFAULT_TOOL_OPTIONS.closeTolerance, options: Partial<ToolOptions> = {}): Draft {
  if (!draft || draft.tool !== 'pen') return { ...beginDraft('pen', at, false, options)!, tangents: [[0, 0]], penAnchor: 0 };
  if (closesOnStart(draft.points, at, tolerance)) return { ...draft, penAnchor: 0, penPress: at, penClosing: true, cursor: at };
  if (Math.hypot(at[0] - draft.points.at(-1)![0], at[1] - draft.points.at(-1)![1]) < (draft.options ?? DEFAULT_TOOL_OPTIONS).dragThreshold / 200) return { ...draft, penAnchor: draft.points.length - 1, penPress: at, cursor: at };
  return { ...draft, points: [...draft.points, at], tangents: [...(draft.tangents ?? draft.points.map(() => [0, 0] as Point)), [0, 0]], penAnchor: draft.points.length, penPress: undefined, cursor: at };
}
export function penCurves(draft: Draft): Array<CubicControls | null> {
  return draft.points.map((a, i) => {
    const j = (i + 1) % draft.points.length, b = draft.points[j], out = draft.tangents?.[i] ?? [0, 0], into = draft.tangents?.[j] ?? [0, 0];
    return out.some(Boolean) || into.some(Boolean) ? { c1: [a[0] + out[0], a[1] + out[1]], c2: [b[0] - into[0], b[1] - into[1]] } : null;
  });
}

/** The polygon to draw as a preview while the gesture is in progress. */
export function previewShape(draft: Draft): Point[] {
  const options = draft.options ?? DEFAULT_TOOL_OPTIONS;
  switch (draft.tool) {
    case "line": return [draft.points[0], draft.constrained ? constrainAngle(draft.points[0], draft.cursor) : draft.cursor];
    case "rect":
      return rectPolygon(draft.points[0], draft.constrained ? equalAxisEnd(draft.points[0], draft.cursor) : draft.cursor, options.coordinateStep);
    case "square":
      return rectPolygon(draft.points[0], equalAxisEnd(draft.points[0], draft.cursor), options.coordinateStep);
    case "ellipse":
      if (options.curvedPrimitives) return samplePath(ellipsePath(draft.points[0], draft.constrained ? equalAxisEnd(draft.points[0], draft.cursor) : draft.cursor), options.curveTolerance);
      return ellipsePolygon(draft.points[0], draft.constrained ? equalAxisEnd(draft.points[0], draft.cursor) : draft.cursor, 48, options.coordinateStep);
    case "circle":
      if (options.curvedPrimitives) return samplePath(ellipsePath(draft.points[0], equalAxisEnd(draft.points[0], draft.cursor)), options.curveTolerance);
      return ellipsePolygon(draft.points[0], equalAxisEnd(draft.points[0], draft.cursor), 48, options.coordinateStep);
    case "polygon":
      return regularPolygon(draft.points[0], draft.cursor, options.polygonSides, options.coordinateStep);
    case "freehand":
      return [...draft.points, draft.cursor];
    case "pen": {
      if (!draft.tangents) return [...draft.points, draft.cursor];
      const preview = draft.penAnchor === undefined ? { ...draft, points: [...draft.points, draft.cursor], tangents: [...draft.tangents, [0, 0] as Point] } : draft;
      return samplePath({ points: preview.points, curves: penCurves(preview), closed: options.closePenOnFinish !== false || !!draft.penClosing }, options.curveTolerance);
    }
    default:
      return [];
  }
}

/** Keep the two reference primitives genuinely square/circular while dragging. */
function equalAxisEnd(start: Point, end: Point): Point {
  const side = Math.max(Math.abs(end[0] - start[0]), Math.abs(end[1] - start[1]));
  return [start[0] + side * (end[0] < start[0] ? -1 : 1),
    start[1] + side * (end[1] < start[1] ? -1 : 1)];
}

function commitIfUsable(shape: Point[], minimumArea: number): DraftStep {
  return isUsableShape(shape, minimumArea) ? { kind: "commit", shape } : { kind: "discard" };
}

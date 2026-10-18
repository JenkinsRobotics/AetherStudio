import { useId, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import "./DimensionedSketch.css";

/** All coordinates are presentation-space SVG units. The owning app supplies
 * geometry, formatted measurements, references and constraint states. */
export type SketchAnnotationPoint = readonly [number, number];
export interface SketchPresentationEntity {
  id: string;
  label: string;
  path: string;
  construction?: boolean;
}
export interface SketchDimensionAnnotation {
  id: string;
  label: string;
  value: string;
  reference?: string;
  readOnly?: boolean;
  accent?: boolean;
  entityIDs: readonly string[];
  position: SketchAnnotationPoint;
  /** A leader follows a repositioned label. */
  anchor: SketchAnnotationPoint;
  lines: readonly { from: SketchAnnotationPoint; to: SketchAnnotationPoint; arrows?: "both" | "end"; extension?: boolean }[];
}
export interface SketchConstraintAnnotation {
  id: string;
  label: string;
  glyph: string;
  position: SketchAnnotationPoint;
  entityIDs: readonly string[];
}
export type SketchAnnotationSelection = { kind: "entity" | "dimension" | "constraint"; id: string } | null;
export interface SketchAnnotationView { zoom: number; pan: SketchAnnotationPoint }
export interface DimensionedSketchProps {
  width: number;
  height: number;
  entities: readonly SketchPresentationEntity[];
  dimensions: readonly SketchDimensionAnnotation[];
  constraints?: readonly SketchConstraintAnnotation[];
  vertices?: readonly SketchAnnotationPoint[];
  origin?: SketchAnnotationPoint;
  selection: SketchAnnotationSelection;
  onSelect: (selection: SketchAnnotationSelection) => void;
  onEditDimension?: (id: string) => void;
  onMoveLabel?: (id: string, position: SketchAnnotationPoint) => void;
  view?: SketchAnnotationView;
  onViewChange?: (view: SketchAnnotationView) => void;
  showGrid?: boolean;
  showConstruction?: boolean;
  showConstraints?: boolean;
  showReferences?: boolean;
  ariaLabel?: string;
}

/** A controlled annotation surface, not a sketch solver. Keyboard selection,
 * label movement and viewport gestures share the same callbacks as pointer use. */
export function DimensionedSketch({ width, height, entities, dimensions, constraints = [], vertices = [], origin,
  selection, onSelect, onEditDimension, onMoveLabel, view = { zoom: 1, pan: [0, 0] }, onViewChange,
  showGrid = true, showConstruction = true, showConstraints = true, showReferences = true,
  ariaLabel = "Dimensioned sketch" }: DimensionedSketchProps) {
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ pointerId: number; capture: Element; start: SketchAnnotationPoint; initial: SketchAnnotationPoint; label?: string; moved: boolean } | null>(null);
  const [preview, setPreview] = useState<{ id: string; position: SketchAnnotationPoint } | null>(null);
  const zoom = Math.max(.5, Math.min(3, view.zoom));
  const visibleWidth = width / zoom, visibleHeight = height / zoom;
  const left = (width - visibleWidth) / 2 - view.pan[0], top = (height - visibleHeight) / 2 - view.pan[1];
  const selectedAnnotation = selection?.kind === "dimension" ? dimensions.find(d => d.id === selection.id)
    : selection?.kind === "constraint" ? constraints.find(c => c.id === selection.id) : undefined;
  const selectedEntities = new Set(selectedAnnotation?.entityIDs ?? (selection?.kind === "entity" ? [selection.id] : []));
  const clampPosition = ([x, y]: SketchAnnotationPoint): SketchAnnotationPoint => [Math.max(80, Math.min(width - 80, x)), Math.max(24, Math.min(height - 24, y))];
  const delta = (event: PointerEvent<SVGSVGElement>, start: SketchAnnotationPoint): SketchAnnotationPoint => {
    const bounds = svgRef.current!.getBoundingClientRect();
    const scale = Math.min(bounds.width / visibleWidth, bounds.height / visibleHeight);
    return [(event.clientX - start[0]) / scale, (event.clientY - start[1]) / scale];
  };
  const begin = (event: PointerEvent, label?: SketchDimensionAnnotation) => {
    if (event.button !== 0 || (label ? !onMoveLabel : !onViewChange)) return;
    event.preventDefault();
    event.stopPropagation();
    const initial = label?.position ?? view.pan;
    drag.current = { pointerId: event.pointerId, capture: event.currentTarget, start: [event.clientX, event.clientY], initial, label: label?.id, moved: false };
    // Retain the original target so the browser can also deliver label clicks
    // and double-clicks after capture (capturing the SVG root retargets them).
    event.currentTarget.setPointerCapture(event.pointerId);
    if (label) { onSelect({ kind: "dimension", id: label.id }); event.currentTarget instanceof SVGElement && event.currentTarget.focus(); }
  };
  const finish = (event: PointerEvent<SVGSVGElement>, cancelled = false) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (!cancelled && active.label && active.moved) {
      const [dx, dy] = delta(event, active.start);
      onMoveLabel?.(active.label, clampPosition([active.initial[0] + dx, active.initial[1] + dy]));
    }
    drag.current = null;
    setPreview(null);
    if (active.capture.hasPointerCapture(event.pointerId)) active.capture.releasePointerCapture(event.pointerId);
  };
  const activate = (event: KeyboardEvent<SVGGElement>, next: NonNullable<SketchAnnotationSelection>) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(next); }
  };

  return <svg ref={svgRef} className="aui-dimensioned-sketch" viewBox={`${left} ${top} ${visibleWidth} ${visibleHeight}`}
    style={{ aspectRatio: `${width} / ${height}` }} role="group" aria-label={ariaLabel} tabIndex={0}
    aria-description="Tab to geometry, dimensions and constraints. Enter edits a dimension. Arrow keys move a focused label or pan the focused canvas. Escape clears selection."
    onKeyDown={event => {
      if (event.key === "Escape") {
        const active = drag.current;
        drag.current = null; setPreview(null); onSelect(null);
        if (active?.capture.hasPointerCapture(active.pointerId)) active.capture.releasePointerCapture(active.pointerId);
      }
      if (event.target === event.currentTarget && onViewChange && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault(); const step = (event.shiftKey ? 60 : 20) / zoom;
        onViewChange({ zoom, pan: [view.pan[0] + (event.key === "ArrowRight" ? -step : event.key === "ArrowLeft" ? step : 0), view.pan[1] + (event.key === "ArrowDown" ? -step : event.key === "ArrowUp" ? step : 0)] });
      }
    }}
    onPointerMove={event => {
      const active = drag.current;
      if (!active || active.pointerId !== event.pointerId) return;
      const [dx, dy] = delta(event, active.start);
      if (Math.hypot(event.clientX - active.start[0], event.clientY - active.start[1]) < 3 && !active.moved) return;
      active.moved = true;
      if (active.label) setPreview({ id: active.label, position: clampPosition([active.initial[0] + dx, active.initial[1] + dy]) });
      else onViewChange?.({ zoom, pan: [active.initial[0] + dx, active.initial[1] + dy] });
    }} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)}
    onLostPointerCapture={() => { drag.current = null; setPreview(null); }}>
    <defs>
      <pattern id={`${uid}-grid`} width={20} height={20} patternUnits="userSpaceOnUse"><path d="M20 0H0V20" className="aui-sketch-grid-line" /></pattern>
      <pattern id={`${uid}-major`} width={100} height={100} patternUnits="userSpaceOnUse"><rect width={100} height={100} fill={`url(#${uid}-grid)`} /><path d="M100 0H0V100" className="aui-sketch-major-line" /></pattern>
      <marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX={8} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="context-stroke" /></marker>
    </defs>
    <rect className="aui-sketch-background" x={left} y={top} width={visibleWidth} height={visibleHeight} onPointerDown={event => begin(event)} onDoubleClick={() => onViewChange?.({ zoom: 1, pan: [0, 0] })} />
    {showGrid && <rect x={left} y={top} width={visibleWidth} height={visibleHeight} fill={`url(#${uid}-major)`} pointerEvents="none" />}
    <g className="aui-sketch-entities">
      {entities.filter(e => !e.construction || showConstruction).map(entity => <g key={entity.id} role="button" tabIndex={0}
        aria-label={entity.label} aria-pressed={selectedEntities.has(entity.id)}
        className={`aui-sketch-entity${entity.construction ? " is-construction" : ""}${selectedEntities.has(entity.id) ? " is-selected" : ""}`}
        onClick={() => onSelect({ kind: "entity", id: entity.id })} onKeyDown={event => activate(event, { kind: "entity", id: entity.id })}>
        <path d={entity.path} className="aui-sketch-entity-hit" /><path d={entity.path} className="aui-sketch-entity-line" />
      </g>)}
    </g>
    <g aria-hidden="true" className="aui-sketch-vertices">{vertices.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4.5} />)}</g>
    {origin && <g aria-hidden="true" className="aui-sketch-origin"><path d={`M${origin[0] - 12} ${origin[1]}h24 M${origin[0]} ${origin[1] - 12}v24`} /><circle cx={origin[0]} cy={origin[1]} r={5} /></g>}
    {dimensions.map(dimension => {
      const position = preview?.id === dimension.id ? preview.position : dimension.position;
      const selected = selection?.kind === "dimension" && selection.id === dimension.id;
      const reference = showReferences ? dimension.reference : undefined;
      const accessible = `${dimension.label}: ${dimension.value}${dimension.reference ? `, ${dimension.reference}` : ""}${dimension.readOnly ? ", measured" : ""}`;
      return <g key={dimension.id} className={`aui-sketch-dimension${dimension.accent ? " is-accent" : ""}${selected ? " is-selected" : ""}`}>
        <g aria-hidden="true" className="aui-sketch-dimension-lines">{dimension.lines.map((line, i) => <line key={i} x1={line.from[0]} y1={line.from[1]} x2={line.to[0]} y2={line.to[1]}
          className={line.extension ? "is-extension" : undefined} markerStart={line.arrows === "both" ? `url(#${uid}-arrow)` : undefined} markerEnd={line.arrows ? `url(#${uid}-arrow)` : undefined} />)}
          <line className="aui-sketch-label-leader" x1={dimension.anchor[0]} y1={dimension.anchor[1]} x2={position[0]} y2={position[1]} />
        </g>
        <g role="button" tabIndex={0} aria-label={accessible} aria-pressed={selected} className="aui-sketch-dimension-label"
          transform={`translate(${position[0]} ${position[1]})`}
          onClick={() => onSelect({ kind: "dimension", id: dimension.id })} onPointerDown={event => begin(event, dimension)}
          onDoubleClick={() => { onSelect({ kind: "dimension", id: dimension.id }); onEditDimension?.(dimension.id); }}
          onKeyDown={event => {
            activate(event, { kind: "dimension", id: dimension.id });
            if (event.key === "Enter") onEditDimension?.(dimension.id);
            if (onMoveLabel && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
              event.preventDefault(); const step = event.shiftKey ? 10 : 2;
              onMoveLabel(dimension.id, clampPosition([position[0] + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0), position[1] + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0)]));
            }
          }}>
          <title>{`${accessible}. Double-click or Enter to edit; drag or use arrow keys to move the label.`}</title>
          <rect x={-74} y={-17} width={148} height={reference ? 45 : 32} rx={4} />
          <text className="aui-sketch-dimension-value" textAnchor="middle" y={5}>{dimension.value}</text>
          {reference && <text className="aui-sketch-expression" textAnchor="middle" y={23}>{dimension.reference}</text>}
        </g>
      </g>;
    })}
    {showConstraints && constraints.map(constraint => <g key={constraint.id} role="button" tabIndex={0} aria-label={constraint.label}
      aria-pressed={selection?.kind === "constraint" && selection.id === constraint.id} className="aui-sketch-constraint"
      transform={`translate(${constraint.position[0]} ${constraint.position[1]})`}
      onClick={() => onSelect({ kind: "constraint", id: constraint.id })} onKeyDown={event => activate(event, { kind: "constraint", id: constraint.id })}>
      <title>{constraint.label}</title><circle r={14} /><text textAnchor="middle" dominantBaseline="central">{constraint.glyph}</text>
    </g>)}
  </svg>;
}

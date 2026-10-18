import { useId, type CSSProperties, type ReactNode } from "react";
import "./FlowDiagram.css";

export type FlowDiagramTone = "green" | "violet" | "red" | "neutral" | "teal" | "blue" | "amber";

export interface FlowDiagramRoute {
  id: string;
  label?: string;
  /** SVG path in the diagram's coordinate system; routing belongs to the caller. */
  path: string;
  tone: FlowDiagramTone;
  source?: { x: number; y: number };
  dashed?: boolean;
  durationSeconds?: number;
  delaySeconds?: number;
}

export interface FlowDiagramProps {
  title: string;
  /** A text equivalent of the connections, including their direction. */
  description: string;
  routes: readonly FlowDiagramRoute[];
  width?: number;
  height?: number;
  paused?: boolean;
  playbackRate?: number;
  /** Omit to emphasize every route. Other routes remain visible for context. */
  highlightedRouteIds?: readonly string[];
  children?: ReactNode;
  className?: string;
  interactive?: boolean;
  selectedRouteId?: string;
  onRouteSelect?: (id: string) => void;
}

/** Presentation only: signal movement illustrates direction, never live telemetry. */
export function FlowDiagram({
  title, description, routes, width = 1160, height = 420, paused = false,
  playbackRate = 1, highlightedRouteIds, children, className, interactive = false, selectedRouteId, onRouteSelect,
}: FlowDiagramProps) {
  const id = useId();
  const speed = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
  return <div className={["aui-flow-diagram", className].filter(Boolean).join(" ")} data-paused={paused}>
    <div className="aui-flow-diagram-scroll" role="region" aria-label={`${title} canvas`} tabIndex={0}>
      <svg viewBox={`0 0 ${width} ${height}`} role={interactive ? "group" : "img"} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
        <title id={`${id}-title`}>{title}</title>
        <desc id={`${id}-description`}>{description}</desc>
        <defs>
          <pattern id={`${id}-dots`} width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" className="aui-flow-dot" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill={`url(#${id}-dots)`} />
        {routes.map((route, index) => {
          const duration = route.durationSeconds ?? 6;
          const seconds = Number.isFinite(duration) && duration > 0 ? duration : 6;
          const delay = route.delaySeconds ?? -index * 0.73;
          return <g key={route.id} className="aui-flow-route" data-tone={route.tone}
            data-selected={selectedRouteId === route.id} role={onRouteSelect ? "button" : undefined} tabIndex={onRouteSelect ? 0 : undefined}
            aria-label={onRouteSelect ? `Connection: ${route.label ?? route.id}` : undefined} aria-pressed={onRouteSelect ? selectedRouteId === route.id : undefined}
            onClick={onRouteSelect ? () => onRouteSelect(route.id) : undefined}
            onKeyDown={onRouteSelect ? event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onRouteSelect(route.id); } } : undefined}
            data-route={route.id} data-muted={highlightedRouteIds !== undefined && !highlightedRouteIds.includes(route.id)}
            style={{ "--flow-duration": `${seconds / speed}s`, "--flow-delay": `${(Number.isFinite(delay) ? delay : 0) / speed}s` } as CSSProperties}>
            <path className="aui-flow-route-clearance" d={route.path} />
            <path className="aui-flow-route-line" d={route.path} strokeDasharray={route.dashed ? "6 7" : undefined} />
            <path className="aui-flow-route-signal" d={route.path} pathLength="1000" />
            {onRouteSelect && <path className="aui-flow-route-hit" d={route.path} />}
            {route.source && <circle className="aui-flow-port" cx={route.source.x} cy={route.source.y} r="5.5" />}
          </g>;
        })}
        {children}
      </svg>
    </div>
  </div>;
}

export interface FlowDiagramNodeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  detail?: string;
  variant?: "module" | "gate" | "processor";
  children?: ReactNode;
}

/** Positioned SVG node; children use local coordinates inside this node. */
export function FlowDiagramNode({ x, y, width, height, label, detail, variant = "module", children }: FlowDiagramNodeProps) {
  const processor = variant === "processor";
  return <g className="aui-flow-node" data-variant={variant} transform={`translate(${x} ${y})`}>
    {processor && <g className="aui-flow-pins">
      {Array.from({ length: Math.max(0, Math.floor((height - 20) / 13)) }, (_, index) => {
        const pinY = 12 + index * 13;
        return <path key={index} d={`M0 ${pinY}h-9v4h9 M${width} ${pinY}h9v4h-9`} />;
      })}
    </g>}
    <rect className="aui-flow-node-body" width={width} height={height} rx={variant === "gate" ? width / 2 : 6} />
    {processor && <>
      <rect className="aui-flow-node-inset" x="9" y="9" width={width - 94} height={height - 18} rx="4" />
      <path className="aui-flow-node-notch" d={`M${width / 2 - 8} 0a8 8 0 0 0 16 0`} />
    </>}
    {label && <text className="aui-flow-node-label" x={processor ? 20 : width / 2} y={processor ? 51 : height / 2 - (detail ? 3 : -4)} textAnchor={processor ? "start" : "middle"}>{label}</text>}
    {detail && <text className="aui-flow-node-detail" x={processor ? 20 : width / 2} y={processor ? 72 : height / 2 + 15} textAnchor={processor ? "start" : "middle"}>{detail}</text>}
    {children}
  </g>;
}

export interface FlowDiagramLabelProps {
  x: number;
  y: number;
  children: ReactNode;
  subtle?: boolean;
  anchor?: "start" | "middle" | "end";
}

export function FlowDiagramLabel({ x, y, children, subtle = false, anchor = "start" }: FlowDiagramLabelProps) {
  return <text className="aui-flow-label" data-subtle={subtle} x={x} y={y} textAnchor={anchor}>{children}</text>;
}

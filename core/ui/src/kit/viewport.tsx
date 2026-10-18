/**
 * Viewport-side widgets: the mock stage (Design.swift ViewportMock +
 * PerspectiveGrid), EmptyStage, RadialMenu and CenterTray (Layout.swift),
 * AxisGizmo, ViewCube (ViewCube.swift, same projection math), MoveGizmo,
 * MaterialSphere / VisualizationIcon (Visualization.swift) and the two grids
 * the Design/Show canvases draw.
 */
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Popover } from "../Popover";
import { Sym } from "./icons";
import { AD, tintStyle } from "./widgets";

/** Shapr3D-style perspective ground grid — lines converge toward the horizon. */
export function PerspectiveGrid({ className }: { className?: string }) {
  // Drawn in a 1000×600 box and stretched; the pattern is ratio-based so the
  // look matches the Swift GeometryReader version at any size.
  const w = 1000, h = 600, cx = w / 2, cy = h * 0.6;
  const lines: string[] = [];
  for (let i = -9; i <= 9; i += 1) lines.push(`M${cx + i * 18} ${cy}L${cx + i * 54} ${h}`);
  for (let j = 0; j <= 8; j += 1) { const y = cy + j * j * 3.6; lines.push(`M0 ${y}H${w}`); }
  return (
    <svg className={["aui-kit-perspective-grid", className].filter(Boolean).join(" ")} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <path d={lines.join("")} stroke="var(--aether-viewport-grid)" strokeWidth={1} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Faint square construction grid (DesignGrid / the Show + Hardware graph paper). */
export const DotGrid = ({ step = 24, opacity = 1 }: { step?: number; opacity?: number }) => (
  <div className="aui-kit-dot-grid" aria-hidden style={{ backgroundSize: `${step}px ${step}px`, opacity }} />
);

/** A stylized 3D-viewport placeholder (gradient stage + faux part + triad). */
export function ViewportMock({ showGizmo = false, selected = true, onTapPart, onTapCanvas, children, className }: {
  showGizmo?: boolean; selected?: boolean; onTapPart?: () => void; onTapCanvas?: () => void; children?: ReactNode; className?: string;
}) {
  const [showRadial, setShowRadial] = useState(false);
  return (
    <div className={["aui-kit-viewport", className].filter(Boolean).join(" ")} onClick={onTapCanvas} onDoubleClick={() => setShowRadial((v) => !v)}>
      <PerspectiveGrid />
      <div className="aui-kit-part-stage">
        <div className="aui-kit-part" data-selected={selected || undefined} onClick={(e) => { e.stopPropagation(); onTapPart?.(); }} role={onTapPart ? "button" : undefined} aria-label={onTapPart ? "Part" : undefined}>
          <span className="aui-kit-part-bore" />
          {selected && <span className="aui-kit-part-face" />}
          {showGizmo && selected && (
            <span className="aui-kit-gizmo">
              <GizmoArrow color={AD.danger} angle={0} /><GizmoArrow color={AD.ok} angle={-90} /><GizmoArrow color={AD.accent} angle={135} />
            </span>
          )}
        </div>
      </div>
      {showRadial && <RadialMenu onDismiss={() => setShowRadial(false)} />}
      {children}
    </div>
  );
}

const GizmoArrow = ({ color, angle }: { color: string; angle: number }) => (
  <span className="aui-kit-gizmo-arrow" style={{ transform: `rotate(${angle}deg)`, background: color, color }}><i /></span>
);

/** The empty-viewport prompt with its import call to action. */
export const EmptyStage = ({ status, importAction, importLabel = "Import STEP…" }: { status: string; importAction?: () => void; importLabel?: string }) => (
  <div className="aui-kit-viewport aui-kit-empty-stage">
    <Sym name="cube-transparent" size={46} className="aui-kit-t3" />
    <strong>No model loaded</strong>
    <p>{status}</p>
    {importAction && <button type="button" className="aui-kit-capsule-btn" data-primary onClick={importAction}><Sym name="plus" size={12} />{importLabel}</button>}
  </div>
);

// MARK: - Layout.swift

const RADIAL_ITEMS: readonly { icon: string; label: string; danger?: boolean }[] = [
  { icon: "move", label: "Move" }, { icon: "rotate-3d", label: "Rotate" }, { icon: "link", label: "Mate" },
  { icon: "hidden", label: "Hide" }, { icon: "palette", label: "Material" }, { icon: "delete", label: "Delete", danger: true },
];

/** Six-item radial menu on double-click (208pt ring, 76pt radius). */
export function RadialMenu({ onDismiss, onPick }: { onDismiss: () => void; onPick?: (label: string) => void }) {
  return (
    <div className="aui-kit-radial" role="menu" aria-label="Part actions" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="aui-kit-radial-center" aria-label="Close" onClick={onDismiss}><Sym name="cube-transparent" size={18} weight="light" /></button>
      {RADIAL_ITEMS.map((item, i) => {
        const angle = (i / RADIAL_ITEMS.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <button key={item.label} type="button" role="menuitem" className="aui-kit-radial-item" data-danger={item.danger || undefined}
            style={{ transform: `translate(${Math.cos(angle) * 76}px, ${Math.sin(angle) * 76}px)` }} onClick={() => { onPick?.(item.label); onDismiss(); }}>
            <Sym name={item.icon} size={15} weight="medium" /><span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export interface TrayItem { icon: string; label: string; popover?: ReactNode; onSelect?: () => void }

/** 70×50 items in a translucent tray; items with a popover open it. */
export function CenterTray({ items, active }: { items: readonly TrayItem[]; active?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const anchors = useRef<Record<string, HTMLButtonElement | null>>({});
  return (
    <div className="aui-kit-center-tray" role="toolbar" aria-label="Viewport tray">
      {items.map((item, i) => (
        <span key={item.label} style={{ display: "contents" }}>
          {i > 0 && <span className="aui-kit-vdivider" style={{ height: 30 }} />}
          <button type="button" ref={(el) => { anchors.current[item.label] = el; }} className="aui-kit-tray-item" data-active={(open === item.label || active === item.label) || undefined}
            aria-haspopup={item.popover ? "dialog" : undefined} aria-expanded={item.popover ? open === item.label : undefined}
            onClick={() => (item.popover ? setOpen(open === item.label ? null : item.label) : item.onSelect?.())}>
            <Sym name={item.icon} size={16} weight="medium" /><span>{item.label}</span>
          </button>
          {item.popover && (
            <Popover open={open === item.label} anchor={anchors.current[item.label]} onClose={() => setOpen(null)} ariaLabel={item.label} placement="top-start" className="aui-kit-popover">
              {item.popover}
            </Popover>
          )}
        </span>
      ))}
    </div>
  );
}

// MARK: - NodeWidgets.swift AxisGizmo

/** Viewport axis orientation gizmo (X/Y/Z indicator). */
export function AxisGizmo({ size = 54 }: { size?: number }) {
  const axis = (angle: number, color: string, label: string) => (
    <g transform={`rotate(${angle} ${size / 2} ${size / 2})`} key={label}>
      <line x1={size / 2} y1={size / 2} x2={size / 2} y2={size / 2 - size * 0.36} stroke={color} strokeWidth={2} />
      <text x={size / 2} y={size / 2 - size * 0.42 + 3} fill={color} fontSize={8} fontWeight={700} textAnchor="middle" transform={`rotate(${-angle} ${size / 2} ${size / 2 - size * 0.42})`}>{label}</text>
    </g>
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="aui-kit-axis-gizmo" aria-label="Axes">
      {axis(0, AD.danger, "X")}{axis(-90, AD.ok, "Y")}{axis(135, AD.accent, "Z")}
      <circle cx={size / 2} cy={size / 2} r={2.5} fill="var(--aether-color-text-faint)" opacity={0.5} />
    </svg>
  );
}

// MARK: - ViewCube.swift

export type ViewCubeFace = "front" | "back" | "right" | "left" | "top" | "bottom";
type V3 = [number, number, number];

const FACE: Record<ViewCubeFace, { normal: V3; vertices: V3[]; camera: [number, number] }> = {
  front: { normal: [0, 0, 1], vertices: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], camera: [0, 0] },
  back: { normal: [0, 0, -1], vertices: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]], camera: [Math.PI, 0] },
  right: { normal: [1, 0, 0], vertices: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]], camera: [Math.PI / 2, 0] },
  left: { normal: [-1, 0, 0], vertices: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]], camera: [-Math.PI / 2, 0] },
  top: { normal: [0, 1, 0], vertices: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]], camera: [0, 1.5] },
  bottom: { normal: [0, -1, 0], vertices: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]], camera: [0, -1.5] },
};

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Screen basis for an orthographic view along `direction` (origin → camera). */
export function cubeBasis(direction: V3) {
  const forward = norm(direction).map((v) => -v) as V3;
  let right = cross(forward, [0, 1, 0]);
  right = dot(right, right) < 0.0001 ? [1, 0, 0] : norm(right);
  const up = norm(cross(right, forward));
  return { right, up };
}

export const cubeDirection = (yaw: number, pitch: number): V3 => [Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)];

/** Camera-facing faces only, back-to-front so painting order is correct. */
export function cubeFaces(size: number, direction: V3) {
  const b = cubeBasis(direction), scale = size * 0.3;
  const project = (p: V3) => ({ x: size / 2 + dot(p, b.right) * scale, y: size / 2 - dot(p, b.up) * scale });
  return (Object.keys(FACE) as ViewCubeFace[])
    .filter((f) => dot(FACE[f].normal, direction) > 0.001)
    .map((face) => ({ face, points: FACE[face].vertices.map(project), depth: FACE[face].vertices.reduce((s, v) => s + dot(v, direction), 0) / 4 }))
    .sort((a, c) => a.depth - c.depth);
}

/** Orientation cube — projected faces, hover highlight, click to look at a face. */
export function ViewCube({ yaw, pitch, size = 72, onSelect }: { yaw: number; pitch: number; size?: number; onSelect?: (yaw: number, pitch: number) => void }) {
  const [hovered, setHovered] = useState<ViewCubeFace | null>(null);
  const direction = cubeDirection(yaw, pitch);
  const faces = cubeFaces(size, direction);
  const light = norm([0.4, 0.9, 0.5]);
  const b = cubeBasis(direction), scale = size * 0.3;
  const origin = { x: size / 2, y: size / 2 };
  const axes: [V3, string, string][] = [[[1, 0, 0], "#ff453a", "X"], [[0, 1, 0], "#30d158", "Y"], [[0, 0, 1], "#0a84ff", "Z"]];
  return (
    <div className="aui-kit-view-cube">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="group" aria-label="View cube">
        {faces.map(({ face, points }) => {
          const on = hovered === face;
          const lambert = Math.max(dot(FACE[face].normal, light), 0);
          const cx = points.reduce((s, p) => s + p.x, 0) / 4, cy = points.reduce((s, p) => s + p.y, 0) / 4;
          return (
            <g key={face} onMouseEnter={() => setHovered(face)} onMouseLeave={() => setHovered(null)} onClick={() => onSelect?.(...FACE[face].camera)} style={{ cursor: "pointer" }} role="button" aria-label={`Look at ${face}`}>
              <polygon points={points.map((p) => `${p.x},${p.y}`).join(" ")} fill={on ? "var(--aether-color-accent)" : "var(--aether-color-bg-control)"} fillOpacity={on ? 0.34 : 0.72 + lambert * 0.22}
                stroke={on ? "var(--aether-color-accent)" : "var(--aether-color-border-control)"} strokeWidth={on ? 1.6 : 1} />
              <text x={cx} y={cy + 2.5} textAnchor="middle" fontSize={7.5} fontWeight={700} fill={on ? "var(--aether-color-accent)" : "var(--aether-color-text-dim)"} style={{ pointerEvents: "none" }}>{face.toUpperCase()}</text>
            </g>
          );
        })}
        {axes.sort((p, q) => dot(p[0], direction) - dot(q[0], direction)).map(([vec, color, letter]) => {
          const tip = { x: size / 2 + dot(vec, b.right) * scale * 1.55, y: size / 2 - dot(vec, b.up) * scale * 1.55 };
          return (
            <g key={letter} style={{ pointerEvents: "none" }}>
              <line x1={origin.x} y1={origin.y} x2={tip.x} y2={tip.y} stroke={color} strokeWidth={1.8} />
              <circle cx={tip.x} cy={tip.y} r={5.5} fill={color} />
              <text x={tip.x} y={tip.y + 2.5} textAnchor="middle" fontSize={7} fontWeight={800} fill="#fff">{letter}</text>
            </g>
          );
        })}
      </svg>
      <button type="button" className="aui-kit-iso" title="Isometric view" onClick={() => onSelect?.(0.7, 0.42)}>ISO</button>
    </div>
  );
}

// MARK: - MoveGizmo.swift

/** Move controls shown after double-clicking a body — directional arrows + a Copy affordance. */
export function MoveGizmo({ onNudge, onDismiss }: { onNudge?: (dx: number, dy: number) => void; onDismiss?: () => void }) {
  const drag = useRef<{ x: number; y: number } | null>(null);
  const start = (dx: number, dy: number) => (e: React.PointerEvent<HTMLElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
    const move = (ev: PointerEvent) => {
      if (!drag.current) return;
      const mx = ev.clientX - drag.current.x, my = ev.clientY - drag.current.y;
      drag.current = { x: ev.clientX, y: ev.clientY };
      if (dx === 0 && dy === 0) onNudge?.(mx, my); else { const step = mx * dx + my * dy; onNudge?.(dx * step, dy * step); }
    };
    const up = () => { drag.current = null; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const arrow = (icon: string, dx: number, dy: number, style: CSSProperties) => (
    <button key={icon} type="button" className="aui-kit-move-arrow" aria-label={icon.replace(".", " ")} style={style} onPointerDown={start(dx, dy)}><Sym name={icon} size={12} weight="bold" /></button>
  );
  return (
    <div className="aui-kit-move-gizmo" onDoubleClick={onDismiss} role="group" aria-label="Move">
      {arrow("arrow-up", 0, -1, { top: 21, left: 67 })}
      {arrow("arrow-down", 0, 1, { top: 113, left: 67 })}
      {arrow("arrow-left", -1, 0, { top: 67, left: 21 })}
      {arrow("arrow-right", 1, 0, { top: 67, left: 113 })}
      {arrow("arrow-up-left", -1, -1, { top: 34, left: 34 })}
      {arrow("arrow-up-right", 1, -1, { top: 34, left: 100 })}
      <button type="button" className="aui-kit-move-center" aria-label="Drag to move" onPointerDown={start(0, 0)}><span /></button>
      <span className="aui-kit-move-copy">Copy</span>
    </div>
  );
}

// MARK: - Visualization.swift

/** Sphere preview with the Shapr3D diagonal band. */
export function MaterialSphere({ color, glossy, size = 54, checkered = false }: { color: [number, number, number]; glossy: boolean; size?: number; checkered?: boolean }) {
  const base = `rgb(${color.map((c) => Math.round(c * 255)).join(",")})`;
  return (
    <span className="aui-kit-material-sphere" data-checkered={checkered || undefined} style={{
      width: size, height: size,
      background: `radial-gradient(circle at 34% 26%, rgba(255,255,255,${glossy ? 0.95 : 0.42}) 0%, ${base} ${glossy ? 30 : 45}%, color-mix(in srgb, ${base} 55%, transparent) 70%, rgba(0,0,0,0.55) 100%)`,
    }}><i /></span>
  );
}

/** The rainbow Visualization button from the reference. */
export const VisualizationIcon = ({ size = 22 }: { size?: number }) => <span className="aui-kit-visualization-icon" style={{ width: size, height: size }} aria-hidden />;

export const checkerStyle = tintStyle;

// MARK: - CodexUI MockViewport.swift

/**
 * The CodexUI stage: a schematic animatronic over a converging grid, a mode
 * pill with the selection, a mini view cube, and the camera chrome capsule.
 * `showsStage` adds the proscenium frame and light beams the Show workspace used.
 */
export function RobotViewport({ mode = "RIG VIEW", selected = "Head Pan Assembly", showsStage = false, hud, onToggleHud, display = "Shaded with edges", className, style, children }: {
  mode?: string; selected?: string; showsStage?: boolean; /** Present = the gauge button is offered; true = pressed. */ hud?: boolean; onToggleHud?: () => void; display?: string; className?: string; style?: CSSProperties; children?: ReactNode;
}) {
  return (
    <div className={["aui-kit-viewport aui-kit-robot-viewport", className].filter(Boolean).join(" ")} style={style}>
      <svg className="aui-kit-robot-scene" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-hidden>
        <g stroke="var(--aether-color-border-control)" strokeWidth={0.7} fill="none">
          {Array.from({ length: 19 }, (_, i) => { const t = i / 18; const y = 186 + Math.pow(t, 1.65) * 114; return <line key={`h${i}`} x1={0} x2={400} y1={y} y2={y} opacity={i % 3 === 0 ? 0.95 : 0.48} />; })}
          {Array.from({ length: 29 }, (_, i) => { const k = i - 14; return <line key={`v${i}`} x1={200 + k * 400 / 70} y1={186} x2={200 + k * 400 / 13} y2={300} opacity={k === 0 ? 1 : 0.55} strokeWidth={k === 0 ? 1.2 : 0.7} />; })}
        </g>
        {showsStage && (
          <g>
            <rect x={56} y={36} width={288} height={174} rx={16} fill="none" stroke="var(--aether-color-joint, #8b87ff)" strokeOpacity={0.6} strokeWidth={2} />
            <line x1={91} y1={36} x2={200} y2={210} stroke="var(--aether-color-part)" strokeOpacity={0.18} strokeWidth={26} strokeLinecap="round" />
            <line x1={309} y1={36} x2={200} y2={210} stroke="var(--aether-color-part)" strokeOpacity={0.18} strokeWidth={26} strokeLinecap="round" />
          </g>
        )}
        <g transform="translate(208 141) scale(0.46)">
          {[-1, 1].map((side) => (
            <g key={side}>
              <line x1={side * 118} y1={13} x2={side * 165} y2={105} stroke="var(--aether-viewport-part)" strokeWidth={32} strokeLinecap="round" />
              <line x1={side * 165} y1={105} x2={side * 184} y2={189} stroke="var(--aether-viewport-part)" strokeWidth={25} strokeLinecap="round" />
              <circle cx={side * 118} cy={13} r={26} fill="#8b87ff" />
              <circle cx={side * 165} cy={105} r={18} fill="var(--aether-color-accent)" />
            </g>
          ))}
          <rect x={-92} y={-15} width={184} height={210} rx={25} fill="var(--aether-viewport-part)" stroke="var(--aether-color-text)" strokeOpacity={0.48} strokeWidth={1.5} />
          <rect x={-66} y={28} width={132} height={68} rx={15} fill="var(--aether-viewport-part-shade)" />
          <rect x={-65} y={-130} width={130} height={104} rx={24} fill="var(--aether-color-warn)" fillOpacity={0.92} stroke="#fff" strokeOpacity={0.72} strokeWidth={2} />
          <rect x={-44} y={-105} width={88} height={48} rx={10} fill="var(--aether-viewport-part-shade)" />
          <circle cx={-19} cy={-81} r={8} fill="var(--aether-color-part)" /><circle cx={19} cy={-81} r={8} fill="var(--aether-color-part)" />
          <g strokeWidth={2.4} strokeLinecap="round">
            <line x1={8} y1={-18} x2={74} y2={-18} stroke="#ff453a" /><circle cx={74} cy={-18} r={4} fill="#ff453a" />
            <line x1={8} y1={-18} x2={-31} y2={-63} stroke="#30d158" /><circle cx={-31} cy={-63} r={4} fill="#30d158" />
            <line x1={8} y1={-18} x2={8} y2={-90} stroke="#0a84ff" /><circle cx={8} cy={-90} r={4} fill="#0a84ff" />
          </g>
        </g>
      </svg>
      <div className="aui-kit-robot-top">
        <div className="aui-kit-stack-3"><span className="aui-kit-badge" style={tintStyle(AD.accent, { alignSelf: "flex-start" })}>{mode}</span><strong className="aui-kit-s11">{selected}</strong><span className="aui-kit-t2" style={{ fontSize: 9 }}>Character space · millimetres</span></div>
        <span className="aui-kit-spacer" />
        <span className="aui-kit-mini-cube" aria-hidden><span>TOP</span><span><b>FRONT</b><i>RIGHT</i></span></span>
      </div>
      <div className="aui-kit-robot-bottom">
        <span className="aui-kit-camera-chrome">
          {["home", "cube", "split-diagonal", "camera"].map((icon) => <Sym key={icon} name={icon} size={11} />)}
          {hud !== undefined && <button type="button" className="aui-kit-plain" aria-pressed={hud} title={hud ? "Hide performance HUD" : "Show performance HUD"} style={{ color: hud ? AD.accent : "inherit" }} onClick={onToggleHud}><Sym name="gauge" size={11} /></button>}
          <Sym name="help" size={11} />
        </span>
        <span className="aui-kit-spacer" />
        <span className="aui-kit-hstack-5 aui-kit-t2" style={{ fontSize: 9 }}><Sym name="cube-transparent" size={10} />{display}</span>
      </div>
      {children}
    </div>
  );
}

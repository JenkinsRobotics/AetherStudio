/**
 * Timeline, graph, inspector and settings widgets: Timeline.swift, Graph.swift,
 * NodeWidgets.swift (nodes + timelines), RigAnimate.swift (CurveInspector,
 * CurveCard), MateInspector.swift, PerformanceHUD.swift, EnvironmentPanel.swift,
 * Visualization.swift (panel), DesignWorkspace.swift (PartPropertiesPanel,
 * PropSection), NewCharacterDialog.swift and SettingsKit.swift.
 */
import { useState, type CSSProperties, type ReactNode } from "react";
import { MenuButton } from "../Menu";
import { Sym } from "./icons";
import { MaterialSphere } from "./viewport";
import { AD, Badge, Diamond, Divider, Field, LabeledSlider, LiveBar, PanelCard, Pill, PropertyField, Range, SearchField, Segmented, StepperField, Switch, ToggleLine, tintStyle, Panel } from "./widgets";

// MARK: - Graph.swift

/** A graph node card with connector dots and a selection state. */
export function GraphNode({ title, icon, sub, tint, width = 140, big = false, selected = false, badge, onTap }: {
  title: string; icon: string; sub: string; tint: string; width?: number; big?: boolean; selected?: boolean; badge?: { text: string; on: boolean }; onTap?: () => void;
}) {
  return (
    <button type="button" className="aui-kit-graph-node" data-big={big || undefined} data-selected={selected || undefined} aria-pressed={selected} style={tintStyle(tint, { width })} onClick={onTap}>
      <span className="aui-kit-graph-node-title"><Sym name={icon} size={big ? 14 : 12} className="aui-kit-tinted" /><strong>{title}</strong></span>
      <span className="aui-kit-graph-node-sub">{sub}</span>
      {badge && <span className="aui-kit-graph-node-badge"><i style={{ background: badge.on ? AD.ok : AD.text3 }} />{badge.text}</span>}
      <i className="aui-kit-port aui-kit-port-in" /><i className="aui-kit-port aui-kit-port-out" />
    </button>
  );
}

/** A live servo channel row (channel, name, position bar, angle readout, armed dot). */
export function ServoTrack({ name, channel, degrees, fraction, selected = false, armed = false, onTap }: {
  name: string; channel: number; degrees: number; fraction: number; selected?: boolean; armed?: boolean; onTap?: () => void;
}) {
  return (
    <div className="aui-kit-servo-track" data-selected={selected || undefined} role={onTap ? "button" : undefined} onClick={onTap}>
      <span className="aui-kit-servo-ch">CH{channel}</span>
      <span className="aui-kit-servo-name">{name}</span>
      <span className="aui-kit-servo-bar"><span style={{ width: `${fraction * 100}%` }} /><i style={{ left: `calc(${fraction * 100}% - 6.5px)` }} /></span>
      <span className="aui-kit-servo-deg">{Math.round(degrees)}°</span>
      <span className="aui-kit-dot" style={{ background: armed ? AD.ok : AD.text3 }} />
    </div>
  );
}

// MARK: - Timeline.swift

export interface TimelineTrack { id: string; name: string; color: string; keys: number[] }

const clock = (t: number) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${(t % 60).toFixed(1).padStart(4, "0")}`;

/** The dope-sheet timeline — transport, ruler, and keyframe tracks. */
export function DopeSheetTimeline({ tracks, progress, duration = 8, isPlaying = false, onScrub, onTogglePlay, onRewind, onAddKey, style, audio, badge }: {
  tracks: readonly TimelineTrack[]; progress: number; duration?: number; isPlaying?: boolean;
  onScrub?: (p: number) => void; onTogglePlay?: () => void; onRewind?: () => void; onAddKey?: () => void; style?: CSSProperties;
  /** An audio lane under the key tracks (CodexUI TimelinePrototype / Live Follow). */ audio?: { name: string; color?: string };
  /** A pill after the clock, e.g. "LIVE FOLLOW". */ badge?: { text: string; tint?: string };
}) {
  const scrub = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    onScrub?.(Math.max(0, Math.min(1, (e.clientX - box.left) / Math.max(box.width, 1))));
  };
  const transport = (icon: string, label: string, big: boolean, action?: () => void) => (
    <button type="button" className="aui-kit-transport" data-big={big || undefined} aria-label={label} onClick={action}><Sym name={icon} size={big ? 15 : 12} /></button>
  );
  return (
    <Panel className="aui-kit-timeline" style={style}>
      <div className="aui-kit-timeline-transport">
        {transport("skip-back", "Rewind", false, onRewind)}
        {transport(isPlaying ? "pause" : "play-filled", isPlaying ? "Pause" : "Play", true, onTogglePlay)}
        {transport("skip-forward", "To end", false, () => onScrub?.(1))}
        <span className="aui-kit-vdivider" style={{ height: 18, marginLeft: 2 }} />
        <span className="aui-kit-mono aui-kit-s12">{clock(progress * duration)} / {clock(duration)}</span>
        {badge && <Badge text={badge.text} tint={badge.tint ?? AD.ok} />}
        <span className="aui-kit-spacer" />
        <Pill icon="plus" label="Key" tint={AD.warn} onClick={onAddKey} />
        <span className="aui-kit-t3 aui-kit-s11">{tracks.length} tracks</span>
      </div>
      <Divider />
      <div className="aui-kit-timeline-ruler">
        <span className="aui-kit-caption" style={{ width: 120, paddingLeft: 14 }}>CHANNELS</span>
        <div className="aui-kit-timeline-scale" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); scrub(e); }} onPointerMove={(e) => e.buttons && scrub(e)} role="slider" aria-label="Playhead" aria-valuenow={Math.round(progress * 100)}>
          {Array.from({ length: 12 }, (_, i) => <span key={i}>{i}</span>)}
          <i className="aui-kit-playhead" style={{ left: `${progress * 100}%` }} />
        </div>
      </div>
      <Divider />
      <div className="aui-kit-timeline-tracks">
        {tracks.length === 0 && <p className="aui-kit-hint" style={{ padding: "22px 0" }}>No mates yet — author mates in Rig to get animation tracks.</p>}
        {tracks.map((track) => (
          <div key={track.id} className="aui-kit-timeline-track">
            <div className="aui-kit-timeline-track-head">
              <span className="aui-kit-dot" style={{ background: track.color, width: 7, height: 7 }} /><span>{track.name}</span><span className="aui-kit-spacer" />
              <span className="aui-kit-mono aui-kit-t3" style={{ fontSize: 9.5 }}>{track.keys.length}</span>
            </div>
            <div className="aui-kit-timeline-lane" style={{ background: `color-mix(in srgb, ${track.color} 10%, transparent)` }}>
              {track.keys.map((pos, i) => <Diamond key={i} size={9} fill={track.color} className="aui-kit-key" style={{ left: `calc(${pos * 100}% - 4.5px)` }} />)}
              <i className="aui-kit-playhead" style={{ left: `${progress * 100}%` }} />
            </div>
          </div>
        ))}
        {audio && (
          <div className="aui-kit-timeline-track">
            <div className="aui-kit-timeline-track-head"><Sym name="waveform" size={11} style={{ color: audio.color ?? AD.warn }} /><span>{audio.name}</span></div>
            <div className="aui-kit-timeline-lane"><WaveformLane color={audio.color ?? AD.warn} /><i className="aui-kit-playhead" style={{ left: `${progress * 100}%` }} /></div>
          </div>
        )}
      </div>
    </Panel>
  );
}

// MARK: - NodeWidgets.swift nodes + timelines

/** Typed logic node — category subtitle, colored accent, named ports, selection + warning. */
export function LogicNode({ title, subtitle, icon, color, inputs = [], outputs = [], selected = false, warning = false }: {
  title: string; subtitle: string; icon: string; color: string; inputs?: readonly string[]; outputs?: readonly string[]; selected?: boolean; warning?: boolean;
}) {
  return (
    <div className="aui-kit-logic-node" data-selected={selected || undefined} style={tintStyle(color)}>
      <div className="aui-kit-logic-node-head">
        <Sym name={icon} size={12} className="aui-kit-tinted" />
        <div><strong>{title}</strong><span>{subtitle}</span></div>
        <span className="aui-kit-spacer" />
        <Sym name={warning ? "status-error" : "more"} size={10} style={{ color: warning ? AD.warn : AD.text3 }} />
      </div>
      <div className="aui-kit-logic-node-ports">
        <div>{inputs.map((p) => <span key={p}><i style={{ background: AD.text3 }} />{p}</span>)}</div>
        <div data-out>{outputs.map((p) => <span key={p}>{p}<i className="aui-kit-tinted-bg" /></span>)}</div>
      </div>
    </div>
  );
}

/** A row in the node library palette — the node types you can add to a graph. */
export const NodeLibraryRow = ({ title, category, icon, color, onAdd }: { title: string; category: string; icon: string; color: string; onAdd?: () => void }) => (
  <div className="aui-kit-node-library-row" style={tintStyle(color)}>
    <span className="aui-kit-icon-badge"><Sym name={icon} size={11} weight="medium" /></span>
    <div><span>{title}</span><small>{category}</small></div>
    <span className="aui-kit-spacer" />
    <button type="button" className="aui-kit-plain aui-kit-t3" aria-label={`Add ${title}`} onClick={onAdd}><Sym name="plus-circle" size={11} /></button>
  </div>
);

export interface FeatureTimelineItem { id: string; icon: string; title: string }

/** A horizontal timeline of feature nodes (Onshape/Fusion history-bar idiom). */
export function FeatureTimeline({ items, selectedID, onSelect, onPlay, onAdd }: {
  items: readonly FeatureTimelineItem[]; selectedID?: string; onSelect?: (id: string) => void; onPlay?: () => void; onAdd?: () => void;
}) {
  return (
    <div className="aui-kit-feature-timeline" role="toolbar" aria-label="Feature timeline">
      <button type="button" className="aui-kit-plain aui-kit-t2 aui-kit-ft-btn" aria-label="Replay history" onClick={onPlay}><Sym name="play-filled" size={11} /></button>
      {items.map((item, i) => (
        <span key={item.id} style={{ display: "contents" }}>
          <button type="button" className="aui-kit-feature-chip" data-active={selectedID === item.id || undefined} aria-pressed={selectedID === item.id} onClick={() => onSelect?.(item.id)}>
            <Sym name={item.icon} size={12} /><span>{item.title}</span>
          </button>
          {i < items.length - 1 && <Sym name="more" size={10} className="aui-kit-t3" style={{ transform: "rotate(90deg)" }} />}
        </span>
      ))}
      <button type="button" className="aui-kit-plain aui-kit-t2 aui-kit-ft-btn" aria-label="Add feature" onClick={onAdd}><Sym name="plus" size={12} weight="medium" /></button>
    </div>
  );
}

export interface DocumentTab { id: string; name: string }

/** A floating pill of document tabs with a trailing add button. Onshape bottom-bar idiom. */
export function DocumentTabBar({ tabs, selectedID, onSelect, onAdd }: { tabs: readonly DocumentTab[]; selectedID?: string; onSelect?: (id: string) => void; onAdd?: () => void }) {
  return (
    <div className="aui-kit-doc-tab-bar" role="tablist">
      {tabs.map((tab, i) => (
        <span key={tab.id} style={{ display: "contents" }}>
          <button type="button" role="tab" aria-selected={selectedID === tab.id} className="aui-kit-doc-tab-pill" data-active={selectedID === tab.id || undefined} onClick={() => onSelect?.(tab.id)}>
            <Sym name="document" size={11} /><span>{tab.name}</span>
          </button>
          {i < tabs.length - 1 && <span className="aui-kit-vdivider" style={{ height: 18 }} />}
        </span>
      ))}
      <span className="aui-kit-vdivider" style={{ height: 18 }} />
      <button type="button" className="aui-kit-plain aui-kit-t2" style={{ width: 34, height: 34 }} aria-label="New document" onClick={onAdd}><Sym name="plus" size={12} weight="medium" /></button>
    </div>
  );
}

// MARK: - RigAnimate.swift curve editor

/** CurveCard's body without the card chrome, for the Inspector tab. */
export function CurveInspector() {
  return (
    <div className="aui-kit-stack-12">
      <div className="aui-kit-curve-editor">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <path d="M0 80 C40 90 60 10 100 25" stroke="var(--aether-color-accent)" strokeWidth={2} fill="none" vectorEffect="non-scaling-stroke" />
        </svg>
        {[[0, 0.8], [0.5, 0.5], [1, 0.25]].map(([x, y]) => <i key={x} style={{ left: `${x * 100}%`, top: `${y * 100}%` }} />)}
      </div>
      <div className="aui-kit-hstack-9"><Field label="Interp" value="Bézier" /><Field label="Frame" value="43" /></div>
      <Field label="Value" value="42.0" unit="°" />
      <Field label="Ease" value="In / Out" />
    </div>
  );
}

/** Floating curve editor card — the Animate "Curve · Knee" widget. */
export const CurveCard = ({ onClose }: { onClose?: () => void }) => (
  <div className="aui-kit-curve-card">
    <div className="aui-kit-curve-card-head">
      <Sym name="pulse" size={12} weight="semibold" style={{ color: AD.accent }} /><strong>Curve · Knee</strong><span className="aui-kit-spacer" />
      <button type="button" className="aui-kit-plain aui-kit-t3" aria-label="Close" onClick={onClose}><Sym name="close" size={10} weight="bold" /></button>
    </div>
    <Divider />
    <div style={{ padding: 14 }}><CurveInspector /></div>
  </div>
);

// MARK: - MateInspector.swift

export type MateType = "fastened" | "revolute" | "slider" | "cylindrical" | "planar" | "ball";
export type MateAxis = "X" | "Y" | "Z";
export interface Mate { id: string; name: string; type: MateType; parent: string; child: string; axis: MateAxis; value: number; minValue: number; maxValue: number }

export const MATE_TYPES: readonly { id: MateType; label: string; icon: string; driven: boolean; unit: string }[] = [
  { id: "fastened", label: "Fastened", icon: "link", driven: false, unit: "°" },
  { id: "revolute", label: "Revolute", icon: "revolute", driven: true, unit: "°" },
  { id: "slider", label: "Slider", icon: "arrows-vertical", driven: true, unit: "mm" },
  { id: "cylindrical", label: "Cylindrical", icon: "cylindrical", driven: true, unit: "mm" },
  { id: "planar", label: "Planar", icon: "stack-3d", driven: false, unit: "°" },
  { id: "ball", label: "Ball", icon: "grid-dots", driven: false, unit: "°" },
];
export const mateType = (id: MateType) => MATE_TYPES.find((t) => t.id === id)!;

/** Live inspector for an authored mate. */
export function MateInspector({ mate, onChange, parentName, childName, onDelete }: { mate: Mate; onChange: (m: Mate) => void; parentName: string; childName: string; onDelete?: () => void }) {
  const type = mateType(mate.type);
  const lo = Math.min(mate.minValue, mate.maxValue), hi = Math.max(mate.minValue, mate.maxValue);
  return (
    <PanelCard contentOnly title={mate.name} subtitle={type.label} icon={type.icon} tint={AD.accent}>
      <div className="aui-kit-stack-11" style={{ padding: 12 }}>
        <PropertyField label="Parent" value={parentName} />
        <PropertyField label="Child" value={childName} />
        <div className="aui-kit-between"><span className="aui-kit-property-label">Axis</span>
          <Segmented options={(["X", "Y", "Z"] as const).map((a) => ({ id: a, label: a }))} value={mate.axis} onChange={(axis) => onChange({ ...mate, axis })} ariaLabel="Axis" /></div>
        {type.driven ? (
          <>
            <Divider />
            <LabeledSlider label="Value" value={mate.value} onChange={(value) => onChange({ ...mate, value })} min={lo} max={lo < hi ? hi : lo + 1} unit={type.unit} />
            <div className="aui-kit-hstack-8">
              <StepperField label="Min" value={mate.minValue} step={5} unit={type.unit} onChange={(minValue) => onChange({ ...mate, minValue })} />
              <StepperField label="Max" value={mate.maxValue} step={5} unit={type.unit} onChange={(maxValue) => onChange({ ...mate, maxValue })} />
            </div>
          </>
        ) : <p className="aui-kit-t3" style={{ fontSize: 9.5, margin: 0 }}>{type.label} mates have no driven axis.</p>}
        <Divider />
        <button type="button" className="aui-kit-wide-btn" data-danger onClick={onDelete}><Sym name="delete" size={11} />Delete mate</button>
      </div>
    </PanelCard>
  );
}

// MARK: - PerformanceHUD.swift

/** Pinned live-stats HUD in the viewport corner. */
export function PerformanceHUD({ engine, fps, cpuPercent, memoryMB, loadMs = 0, triangles = 0, kernel = "OCCT 7.8.1", onClose }: {
  engine: string; fps: number; cpuPercent: number; memoryMB: number; loadMs?: number; triangles?: number; kernel?: string; onClose?: () => void;
}) {
  const row = (label: string, value: string) => <div key={label} className="aui-kit-hud-row"><span>{label}</span><strong>{value}</strong></div>;
  return (
    <div className="aui-kit-hud" role="status">
      <div className="aui-kit-between"><span className="aui-kit-caption">PERFORMANCE</span>
        <button type="button" className="aui-kit-plain aui-kit-t3" aria-label="Unpin" onClick={onClose}><Sym name="unpin" size={9} weight="semibold" /></button></div>
      {row("ENGINE", engine)}{row("LOAD", `${loadMs.toFixed(0)} ms`)}{row("FPS", fps.toFixed(0))}{row("CPU", `${cpuPercent.toFixed(1)} %`)}
      {row("MEMORY", `${memoryMB.toFixed(1)} MB`)}{row("TRIANGLES", String(triangles))}{row("KERNEL", kernel)}
    </div>
  );
}

// MARK: - EnvironmentPanel.swift

export interface RenderPrefs { themeName: string; engine: string; background: string; keyLight: number; showOrigin: boolean; showViewCube: boolean; keepColors: boolean; showGrid: boolean; groundShadow: boolean; deflection: number; pinPerformance: boolean }
export const RENDER_ENGINES = ["RealityKit", "Metal", "Ray Traced", "WebGPU", "Three.js"] as const;
export const BENCH_THEMES = ["Studio Blue", "Graphite", "Blueprint", "High Contrast"] as const;
export const defaultRenderPrefs = (): RenderPrefs => ({ themeName: "Studio Blue", engine: "RealityKit", background: "#292b30", keyLight: 3200, showOrigin: true, showViewCube: true, keepColors: true, showGrid: true, groundShadow: true, deflection: 0.2, pinPerformance: false });

/** Quick scene/environment controls for the viewport tray. */
export function EnvironmentPanel({ prefs, onChange }: { prefs: RenderPrefs; onChange: (p: RenderPrefs) => void }) {
  const row = (label: string, control: ReactNode) => <div className="aui-kit-between"><span className="aui-kit-t2 aui-kit-s11">{label}</span>{control}</div>;
  return (
    <div className="aui-kit-environment">
      <span className="aui-kit-caption">ENVIRONMENT</span>
      {row("Theme", <MenuButton className="aui-kit-menu-btn" label="Theme" items={BENCH_THEMES.map((t) => ({ id: t, label: t, kind: "radio" as const, checked: prefs.themeName === t }))} onSelect={(id) => onChange({ ...prefs, themeName: id })}>{prefs.themeName}<Sym name="chevron-down" size={8} /></MenuButton>)}
      {row("Engine", <MenuButton className="aui-kit-menu-btn" label="Engine" items={RENDER_ENGINES.map((e) => ({ id: e, label: e === "Ray Traced" ? "Ray Traced (unavailable)" : e, kind: "radio" as const, checked: prefs.engine === e, disabled: e === "Ray Traced" }))} onSelect={(id) => onChange({ ...prefs, engine: id })}>{prefs.engine}<Sym name="chevron-down" size={8} /></MenuButton>)}
      <Divider />
      {row("Background", <input type="color" className="aui-kit-color" aria-label="Background" value={prefs.background} onChange={(e) => onChange({ ...prefs, background: e.target.value })} />)}
      <div>
        <div className="aui-kit-between"><span className="aui-kit-t2 aui-kit-s11">Key light</span><span className="aui-kit-mono aui-kit-t3 aui-kit-s10">{Math.round(prefs.keyLight)}</span></div>
        <Range value={prefs.keyLight} min={0} max={6000} step={10} onChange={(keyLight) => onChange({ ...prefs, keyLight })} ariaLabel="Key light" />
      </div>
      <ToggleLine label="Show origin" isOn={prefs.showOrigin} onChange={(showOrigin) => onChange({ ...prefs, showOrigin })} />
      <ToggleLine label="View cube" isOn={prefs.showViewCube} onChange={(showViewCube) => onChange({ ...prefs, showViewCube })} />
      <ToggleLine label="Keep STEP colors" isOn={prefs.keepColors} onChange={(keepColors) => onChange({ ...prefs, keepColors })} />
    </div>
  );
}

// MARK: - Visualization.swift panel

export interface StudioMaterial { name: string; category: string; finish: "Glossy" | "Matte"; color: [number, number, number] }
export const MATERIALS: readonly StudioMaterial[] = [
  { name: "ABS", category: "Plastic", finish: "Glossy", color: [0.9, 0.13, 0.15] }, { name: "ABS", category: "Plastic", finish: "Matte", color: [0.85, 0.15, 0.17] },
  { name: "Nylon", category: "Plastic", finish: "Matte", color: [0.16, 0.16, 0.17] }, { name: "Carbon", category: "Plastic", finish: "Glossy", color: [0.08, 0.08, 0.09] },
  { name: "Aluminium", category: "Metal", finish: "Glossy", color: [0.78, 0.79, 0.82] }, { name: "Anodised", category: "Metal", finish: "Matte", color: [0.35, 0.4, 0.48] },
  { name: "Brass", category: "Metal", finish: "Glossy", color: [0.83, 0.68, 0.32] }, { name: "Steel", category: "Metal", finish: "Matte", color: [0.55, 0.57, 0.6] },
  { name: "Clear Glass — Thin", category: "Glass", finish: "Glossy", color: [1, 1, 1] },
];
export const ENVIRONMENTS: readonly { name: string; background: [number, number, number]; checkered?: boolean }[] = [
  { name: "Default", background: [0.16, 0.17, 0.19] }, { name: "Transparent", background: [0.55, 0.55, 0.57], checkered: true },
  { name: "Colored Mood", background: [0, 0.65, 1] }, { name: "Gradient Mood", background: [0.95, 0.95, 0.95] }, { name: "Black and White Stage", background: [1, 1, 1] },
];
const hex = (c: [number, number, number]) => `#${c.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
const materialID = (m: StudioMaterial) => `${m.category}/${m.finish} ${m.name}`;

/** Material / Environment tabs with sphere previews. */
export function VisualizationPanel({ onMaterial, onEnvironment }: { onMaterial?: (m: StudioMaterial) => void; onEnvironment?: (name: string) => void }) {
  const [tab, setTab] = useState<"material" | "environment">("material");
  const [search, setSearch] = useState("");
  const [used, setUsed] = useState<StudioMaterial[]>(MATERIALS.slice(0, 3));
  const [active, setActive] = useState<string | null>(null);
  const [environment, setEnvironment] = useState("Default");
  const results = search ? MATERIALS.filter((m) => `${m.name} ${m.category}`.toLowerCase().includes(search.toLowerCase())) : MATERIALS;
  const categories = Array.from(new Set(MATERIALS.map((m) => m.category)));
  const apply = (m: StudioMaterial) => { setActive(materialID(m)); setUsed([m, ...used.filter((u) => materialID(u) !== materialID(m))].slice(0, 3)); onMaterial?.(m); };
  return (
    <div className="aui-kit-visualization">
      <Segmented options={[{ id: "material", label: "Material" }, { id: "environment", label: "Environment" }]} value={tab} onChange={setTab} ariaLabel="Visualization" size="regular" />
      {tab === "material" ? (
        <div className="aui-kit-stack-10">
          <SearchField placeholder="Search Materials" text={search} onChange={setSearch} />
          <div className="aui-kit-scroll aui-kit-stack-14">
            {!search && used.length > 0 && (<><strong className="aui-kit-s115">Used Materials ({used.length})</strong>
              {used.map((m) => (
                <button key={materialID(m)} type="button" className="aui-kit-used-material" onClick={() => apply(m)}>
                  <MaterialSphere color={m.color} glossy={m.finish === "Glossy"} size={38} />
                  <div><small>{m.finish}</small><strong>{m.name}</strong><span><i style={{ background: hex(m.color) }} />{hex(m.color)}</span></div>
                  <span className="aui-kit-spacer" /><Sym name="chevron-right" size={9} className="aui-kit-t3" />
                </button>))}</>)}
            {categories.map((category) => {
              const items = results.filter((m) => m.category === category);
              return items.length ? (
                <div key={category} className="aui-kit-stack-8">
                  <strong className="aui-kit-s115">{category}</strong>
                  <div className="aui-kit-swatch-grid">
                    {items.map((m) => (
                      <button key={materialID(m)} type="button" className="aui-kit-swatch" data-active={active === materialID(m) || undefined} onClick={() => apply(m)}>
                        <MaterialSphere color={m.color} glossy={m.finish === "Glossy"} size={74} /><small>{m.finish}</small><strong>{m.name}</strong>
                      </button>))}
                  </div>
                </div>) : null;
            })}
          </div>
        </div>
      ) : (
        <div className="aui-kit-scroll aui-kit-stack-8">
          <strong className="aui-kit-s115">Studio</strong>
          {ENVIRONMENTS.map((item) => (
            <button key={item.name} type="button" className="aui-kit-environment-row" data-active={environment === item.name || undefined} onClick={() => { setEnvironment(item.name); onEnvironment?.(item.name); }}>
              <MaterialSphere color={[0.72, 0.73, 0.76]} glossy size={46} checkered={item.checkered} />
              <div><strong>{item.name}{environment === item.name && <Sym name="status-ok" size={9} style={{ color: AD.accent, marginLeft: 5 }} />}</strong><small className="aui-kit-mono">{hex(item.background)}</small></div>
            </button>))}
        </div>
      )}
    </div>
  );
}

// MARK: - DesignWorkspace.swift inspector

/** A collapsible titled section with a disclosure chevron. */
export function PropSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="aui-kit-prop-section">
      <button type="button" className="aui-kit-prop-section-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Sym name="chevron-right" size={9} weight="semibold" className="aui-kit-t3" style={{ transform: open ? "rotate(90deg)" : undefined }} /><strong>{title}</strong>
      </button>
      {open && children}
    </div>
  );
}

export interface DesignShape { id: string; kind: string; icon: string; tint: string; x: number; y: number; size: number; material: string; appearance: string; opacity: number; visible: boolean; rotation: [number, number, number] }

const MATERIAL_OPTIONS = ["Not set", "Aluminum", "Steel", "ABS Plastic", "PLA"];
const APPEARANCE_OPTIONS = ["Not set", "Painted", "Anodized", "Brushed", "Matte"];

/** Context-aware Inspector content for a selected part: General, Transform, Information. */
export function PartPropertiesPanel({ shape, onChange, onDelete }: { shape: DesignShape; onChange: (s: DesignShape) => void; onDelete?: (id: string) => void }) {
  const row = (label: string, control: ReactNode) => <div className="aui-kit-prop-row"><span>{label}</span><span className="aui-kit-spacer" />{control}</div>;
  const menuRow = (label: string, value: string, options: string[], set: (v: string) => void) => row(label,
    <MenuButton className="aui-kit-menu-btn" label={label} items={options.map((o) => ({ id: o, label: o, kind: "radio" as const, checked: o === value }))} onSelect={set}>
      <span style={{ color: value === "Not set" ? AD.text3 : AD.text }}>{value}</span><Sym name="chevron-down" size={8} className="aui-kit-t3" /></MenuButton>);
  const numberRow = (label: string, value: number, unit: string, set: (v: number) => void, step = 1) => row(label,
    <span className="aui-kit-number-row"><span className="aui-kit-number-box">{value.toFixed(2)} {unit}</span>
      <span className="aui-kit-mini-stepper"><button type="button" aria-label={`Increase ${label}`} onClick={() => set(value + step)}><Sym name="chevron-up" size={7} weight="bold" /></button><button type="button" aria-label={`Decrease ${label}`} onClick={() => set(value - step)}><Sym name="chevron-down" size={7} weight="bold" /></button></span></span>);
  const mm = (unit: number) => unit * 200 - 100;
  const rot = (i: number, v: number) => { const r = [...shape.rotation] as [number, number, number]; r[i] = v; onChange({ ...shape, rotation: r }); };
  return (
    <div className="aui-kit-part-props">
      <PropSection title="General">
        {menuRow("Material", shape.material, MATERIAL_OPTIONS, (material) => onChange({ ...shape, material }))}
        {menuRow("Appearance", shape.appearance, APPEARANCE_OPTIONS, (appearance) => onChange({ ...shape, appearance }))}
        {row("Opacity", <span className="aui-kit-hstack-8"><Range value={shape.opacity} onChange={(opacity) => onChange({ ...shape, opacity })} ariaLabel="Opacity" style={{ width: 90 }} /><span className="aui-kit-mono aui-kit-t2" style={{ fontSize: 10.5, width: 34, textAlign: "right" }}>{Math.round(shape.opacity * 100)} %</span></span>)}
        {row("Visible", <Switch checked={shape.visible} onChange={(visible) => onChange({ ...shape, visible })} label="Visible" size="mini" />)}
      </PropSection>
      <PropSection title="Transform">
        {numberRow("Position X", mm(shape.x), "mm", (v) => onChange({ ...shape, x: (v + 100) / 200 }))}
        {numberRow("Position Y", mm(shape.y), "mm", (v) => onChange({ ...shape, y: (v + 100) / 200 }))}
        {numberRow("Position Z", 0, "mm", () => {})}
        {numberRow("Rotation X", shape.rotation[0], "deg", (v) => rot(0, v))}
        {numberRow("Rotation Y", shape.rotation[1], "deg", (v) => rot(1, v))}
        {numberRow("Rotation Z", shape.rotation[2], "deg", (v) => rot(2, v))}
      </PropSection>
      <PropSection title="Information">
        {row("Type", <span className="aui-kit-t2 aui-kit-s11">Solid body</span>)}
        {row("Volume", <span className="aui-kit-t2 aui-kit-s11">—</span>)}
        {row("Mass", <span className="aui-kit-t2 aui-kit-s11">—</span>)}
      </PropSection>
      <Divider style={{ margin: "8px 0" }} />
      <button type="button" className="aui-kit-plain aui-kit-delete-link" onClick={() => onDelete?.(shape.id)}><Sym name="delete" size={11} />Delete</button>
    </div>
  );
}

// MARK: - NewCharacterDialog.swift

const CHARACTER_KINDS = [
  { id: "3d", title: "3D Character", detail: "An assembly of rigid model parts connected with mates.", icon: "cube", available: true },
  { id: "2d", title: "2D (Live2D-style)", detail: "Layered 2D character authoring — coming later.", icon: "layers", available: false },
] as const;

/** New Character sheet — a project-local Character you can later publish. */
export function NewCharacterDialog({ onCreate, onCancel }: { onCreate: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"3d" | "2d">("3d");
  return (
    <div className="aui-kit-sheet" role="dialog" aria-label="New Character">
      <div className="aui-kit-sheet-head">
        <span className="aui-kit-icon-badge" style={tintStyle(AD.accent, { width: 34, height: 34 })}><Sym name="character-card" size={17} /></span>
        <div><strong>New Character</strong><p>Creates a project-local Character. Publish it to the Character Library to reuse it.</p></div>
      </div>
      <label className="aui-kit-stack-6"><span className="aui-kit-caption">NAME</span>
        <input className="aui-kit-input" placeholder="Character name" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
      <div className="aui-kit-stack-8"><span className="aui-kit-caption">CHARACTER TYPE</span>
        {CHARACTER_KINDS.map((option) => (
          <button key={option.id} type="button" className="aui-kit-kind-row" role="radio" aria-checked={kind === option.id} disabled={!option.available} data-active={kind === option.id || undefined} onClick={() => setKind(option.id)}>
            <Sym name={option.icon} size={15} style={{ color: option.available ? AD.accent : AD.text3, width: 26 }} />
            <div><span className="aui-kit-hstack-7"><strong>{option.title}</strong>{!option.available && <Badge text="coming later" />}</span><small>{option.detail}</small></div>
            <span className="aui-kit-spacer" /><Sym name={kind === option.id ? "status-ok" : "circle"} size={14} style={{ color: kind === option.id ? AD.accent : AD.text3 }} />
          </button>))}
      </div>
      <p className="aui-kit-sheet-note"><Sym name="info" size={11} />The current 3D pipeline is for rigid parts and mates. Skinned meshes and skeletons are not supported yet.</p>
      <div className="aui-kit-dialog-actions">
        <button type="button" className="aui-kit-capsule-btn" onClick={onCancel}>Cancel</button>
        <button type="button" className="aui-kit-capsule-btn" data-primary onClick={() => onCreate(name.trim() || "Untitled Character")}>Create</button>
      </div>
    </div>
  );
}

// MARK: - SettingsKit.swift

export const SettingsPage = ({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) => (
  <div className="aui-kit-settings-page"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{children}</div>
);

export const SettingsSection = ({ title, icon, footnote, children }: { title: string; icon: string; footnote?: string; children: ReactNode }) => (
  <section className="aui-kit-settings-section">
    <header><Sym name={icon} size={12} weight="medium" className="aui-kit-t2" /><strong>{title}</strong></header>
    <div className="aui-kit-divider" />
    <div className="aui-kit-settings-section-body">{children}{footnote && <p className="aui-kit-footnote">{footnote}</p>}</div>
  </section>
);

export const SettingsSlider = ({ label, value, onChange, min = 0, max = 1, format = (v: number) => v.toFixed(2), step }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; format?: (v: number) => string; step?: number }) => (
  <div className="aui-kit-settings-slider"><span>{label}</span><Range value={value} onChange={onChange} min={min} max={max} step={step ?? (max - min) / 200} ariaLabel={label} /><span className="aui-kit-mono aui-kit-t2">{format(value)}</span></div>
);

export const SettingsColorRow = ({ label, color, onChange }: { label: string; color: string; onChange: (v: string) => void }) => (
  <div className="aui-kit-between aui-kit-s12"><span>{label}</span><input type="color" className="aui-kit-color" aria-label={label} value={color} onChange={(e) => onChange(e.target.value)} /></div>
);

export const SettingsLabeledRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="aui-kit-between aui-kit-s12"><span>{label}</span>{children}</div>
);

export const SettingsCheck = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="aui-kit-check"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span>{label}</span></label>
);

/** The theme's palette at a glance. */
export const ThemeSwatchStrip = ({ colors }: { colors: readonly string[] }) => (
  <div className="aui-kit-swatch-strip">{colors.map((c, i) => <span key={i} style={{ background: c }} />)}</div>
);

/** Approximate preview of the shared roughness/metallic surface values. */
export const MaterialPreviewSphere = ({ roughness, metallic, size = 62 }: { roughness: number; metallic: number; size?: number }) => (
  <span className="aui-kit-material-sphere" style={{ width: size, height: size, background: `radial-gradient(circle at 34% 28%, rgba(255,255,255,${0.95 - roughness * 0.55}) 0%, ${`rgb(${Math.round((0.55 - metallic * 0.2) * 255)},${Math.round((0.55 - metallic * 0.2) * 255)},${Math.round((0.55 - metallic * 0.2) * 255)})`} ${55 + roughness * 50}%, rgb(31,31,31) 100%)` }} />
);

// MARK: - CodexUI (the archived Atlas demo, removed 2026-09-23) — timelines, graph canvas, tables, themes

/** A synthetic waveform, drawn the way CodexUI's Canvas drew its dialogue track. */
export function WaveformLane({ color = AD.warn, samples = 180 }: { color?: string; samples?: number }) {
  const points = Array.from({ length: samples + 1 }, (_, i) => `${(i / samples) * 100},${50 + Math.sin(i * 0.42) * Math.sin(i * 0.071) * 30}`).join(" ");
  return <svg className="aui-kit-waveform" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden><polyline points={points} fill="none" stroke={color} strokeOpacity={0.8} strokeWidth={1} vectorEffect="non-scaling-stroke" /></svg>;
}

export interface CueBlock { start: number; length: number; label: string }
export interface CueTrack { name: string; color: string; blocks: readonly CueBlock[] }

/** The Show sequence: transport, timecode, a state pill, and block tracks per medium (ShowPrototype.swift). */
export function CueTimeline({ tracks, timecode = "00:00:08.12", badge = { text: "REHEARSAL", tint: AD.warn }, onPlay, onStop, onRewind, style }: {
  tracks: readonly CueTrack[]; timecode?: string; badge?: { text: string; tint?: string } | null; onPlay?: () => void; onStop?: () => void; onRewind?: () => void; style?: CSSProperties;
}) {
  return (
    <div className="aui-kit-cue-timeline" style={style}>
      <div className="aui-kit-cue-transport">
        <button type="button" className="aui-kit-plain" aria-label="Rewind" onClick={onRewind}><Sym name="skip-back" size={11} /></button>
        <button type="button" className="aui-kit-plain" aria-label="Play" onClick={onPlay}><Sym name="play-filled" size={11} /></button>
        <button type="button" className="aui-kit-plain" aria-label="Stop" onClick={onStop}><Sym name="stop" size={11} /></button>
        <span className="aui-kit-vdivider" style={{ height: 18 }} />
        <span className="aui-kit-mono aui-kit-s10">{timecode}</span>
        <span className="aui-kit-spacer" />
        {badge && <Badge text={badge.text} tint={badge.tint} />}
      </div>
      {tracks.map((track) => (
        <div key={track.name} className="aui-kit-cue-track">
          <span className="aui-kit-cue-track-name"><span className="aui-kit-dot" style={{ background: track.color, width: 7, height: 7 }} />{track.name}</span>
          <div className="aui-kit-cue-lane">
            {track.blocks.map((b) => <span key={`${b.start}-${b.label}`} className="aui-kit-cue-block" style={tintStyle(track.color, { left: `${b.start * 100}%`, width: `${b.length * 100}%` })}>{b.label}</span>)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** A typed port line in the node inspector (PrototypeNodePortRow). */
export const NodePortRow = ({ direction, name, type, color }: { direction: "IN" | "OUT"; name: string; type: string; color: string }) => (
  <div className="aui-kit-port-row"><span className="aui-kit-dot" style={{ background: color, width: 8, height: 8 }} /><b>{direction}</b><span>{name}</span><span className="aui-kit-spacer" /><small>{type}</small></div>
);

export interface CanvasNode { id: string; x: number; y: number; width?: number; title: string; subtitle: string; icon: string; color: string; inputs?: readonly string[]; outputs?: readonly string[]; selected?: boolean; warning?: boolean }
/** A link between unit-space anchor points; the S-curve is drawn like CodexUI's `drawConnection`. */
export interface CanvasLink { from: [number, number]; to: [number, number]; color: string }

export const connectionPath = (x1: number, y1: number, x2: number, y2: number) =>
  `M${x1} ${y1}C${x1 + (x2 - x1) * 0.45} ${y1} ${x1 + (x2 - x1) * 0.55} ${y2} ${x2} ${y2}`;

/** The behaviour graph: dotted grid, S-curve links, positioned `LogicNode`s, and the canvas status chrome (PrototypeNodeCanvas). */
export function NodeCanvas({ nodes, links, title = "BEHAVIOR GRAPH", status = { text: "VALID", tint: AD.ok }, zoom = "100%", height = 380, style }: {
  nodes: readonly CanvasNode[]; links: readonly CanvasLink[]; title?: string; status?: { text: string; tint?: string } | null; zoom?: string; height?: number; style?: CSSProperties;
}) {
  return (
    <div className="aui-kit-node-canvas" style={{ height, ...style }} role="img" aria-label={title}>
      <svg className="aui-kit-node-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {links.map((l, i) => <path key={i} d={connectionPath(l.from[0] * 100, l.from[1] * 100, l.to[0] * 100, l.to[1] * 100)} fill="none" stroke={l.color} strokeOpacity={0.8} strokeWidth={2.4} vectorEffect="non-scaling-stroke" />)}
      </svg>
      {nodes.map((n) => (
        <div key={n.id} className="aui-kit-node-slot" style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%`, width: n.width ?? 196 }}>
          <LogicNode title={n.title} subtitle={n.subtitle} icon={n.icon} color={n.color} inputs={n.inputs} outputs={n.outputs} selected={n.selected} warning={n.warning} />
        </div>
      ))}
      <div className="aui-kit-node-canvas-top"><Badge text={title} />{status && <Badge text={status.text} tint={status.tint ?? AD.ok} />}</div>
      <div className="aui-kit-node-canvas-bottom"><span className="aui-kit-hstack-5"><Sym name="zoom-out" size={10} />{zoom}</span><span className="aui-kit-hstack-5"><Sym name="ai-generate" size={10} />Auto Layout</span></div>
    </div>
  );
}

export interface ChannelMapRow { motion: string; channel: string; range: string; color: string; live: number }

/** Semantic motion → device / channel → range → live value (HardwarePrototype channel map). */
export function ChannelMapTable({ rows, style }: { rows: readonly ChannelMapRow[]; style?: CSSProperties }) {
  return (
    <div className="aui-kit-channel-map" style={style} role="table" aria-label="Channel mapping">
      <div className="aui-kit-channel-row" data-header role="row"><span>MOTION</span><span>DEVICE / CHANNEL</span><span>RANGE</span><span>LIVE</span></div>
      {rows.map((r) => (
        <div key={r.motion} className="aui-kit-channel-row" role="row">
          <span className="aui-kit-hstack-6"><span className="aui-kit-dot" style={{ background: r.color, width: 7, height: 7 }} />{r.motion}</span>
          <span className="aui-kit-t2">{r.channel}</span><span className="aui-kit-mono" style={{ fontSize: 9 }}>{r.range}</span>
          <span><LiveBar fraction={r.live} tint={r.color} /></span>
        </div>
      ))}
    </div>
  );
}

export interface ThemeTile { id: string; label: string; panel: string; accent: string; line?: string }

/** The theme picker grid from CodexUI's Appearance settings: a panel swatch with the accent dot. */
export function ThemeTileGrid({ themes, activeID, onSelect }: { themes: readonly ThemeTile[]; activeID: string; onSelect?: (id: string) => void }) {
  return (
    <div className="aui-kit-theme-tiles" role="radiogroup" aria-label="Theme">
      {themes.map((t) => (
        <button key={t.id} type="button" role="radio" aria-checked={t.id === activeID} data-active={t.id === activeID || undefined} onClick={() => onSelect?.(t.id)}>
          <span style={{ background: t.panel, boxShadow: `inset 0 0 0 1.5px ${t.id === activeID ? t.accent : (t.line ?? "rgba(128,128,128,0.3)")}` }}><i style={{ background: t.accent }} /></span>
          <small>{t.label}</small>
        </button>
      ))}
    </div>
  );
}

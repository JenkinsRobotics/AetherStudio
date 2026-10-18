/**
 * Aether Animation Mockup — App.swift, Shell / TopBar / StatusBar, plus the
 * Settings window (Settings.swift). Launches from the Concept apps directory
 * at ?demo=animation-mockup. Everything visual comes from @aether/ui's
 * animation-mockup-widgets entry; this file is composition and app state only.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MenuButton } from "../../src/Menu";
import { Popover } from "../../src/Popover";
import { useScopedAetherTheme } from "../../src/StudioChrome";
import {
  AD, KitShellProvider, Caption, Divider, HeaderIcon, LAYOUT_PRESETS, MaterialPreviewSphere, Pill, ProgressCard, RENDER_ENGINES, BENCH_THEMES,
  Segmented, SettingsCheck, SettingsColorRow, SettingsLabeledRow, SettingsPage, SettingsSection, SettingsSlider, StageChip, StatusBar, Sym, SystemStatusView,
  ThemeSwatchStrip, TOOL_DENSITIES, applyPreset, cyclePreset, defaultLayout, defaultRenderPrefs, detectPreset, layoutLabel, useKitShell,
  type LayoutFlags, type LayoutPreset, type RenderPrefs,
} from "../../src/Kit";
import { DemoProvider, PIPELINE, WORKSPACES, useDemo, workspaceDef, type Workspace } from "./model";
import { HomeWorkspace } from "./workspaces/Home";
import { CharacterWorkspace } from "./workspaces/Character";
import { RigWorkspace, AnimateWorkspace } from "./workspaces/RigAnimate";
import { ShowWorkspace, HardwareWorkspace } from "./workspaces/ShowHardware";
import { DesignWorkspace } from "./workspaces/Design";
import "./animation-mockup.css";

export type Appearance = "system" | "light" | "dark";
export type Accent = "blue" | "teal" | "indigo" | "orange" | "graphite";
export const ACCENTS: readonly { id: Accent; label: string; swatch: string }[] = [
  { id: "blue", label: "Blue", swatch: "#4c9dff" }, { id: "teal", label: "Teal", swatch: "#36d6c3" }, { id: "indigo", label: "Indigo", swatch: "#8b87ff" },
  { id: "orange", label: "Orange", swatch: "#ff9a4d" }, { id: "graphite", label: "Graphite", swatch: "#9aa3ae" },
];

export interface ThemeState { appearance: Appearance; accent: Accent }
/** Each accent is a theme in the pack: Aether Studio and its accent variants. */
export const ACCENT_THEME: Record<Accent, string> = { blue: "aether-studio", teal: "aether-teal", indigo: "aether-indigo", orange: "aether-orange", graphite: "graphite" };
const systemDark = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
export const isDark = (t: ThemeState) => (t.appearance === "system" ? systemDark() : t.appearance === "dark");

function useWindowWidth() {
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 1400 : window.innerWidth));
  useEffect(() => { const on = () => setWidth(window.innerWidth); window.addEventListener("resize", on); return () => window.removeEventListener("resize", on); }, []);
  return width;
}

export interface AppState {
  workspace: Workspace; go: (w: Workspace) => void;
  theme: ThemeState; setTheme: (t: ThemeState) => void;
  render: RenderPrefs; setRender: (r: RenderPrefs) => void;
  openSettings: () => void;
  preview: boolean; setPreview: (v: boolean) => void;
}

/** The authoring workspaces the Expanded tool sidebar can switch between. */
const TOOL_WORKSPACES = WORKSPACES.filter((w) => w.id !== "home" && w.id !== "uiKit");

export function AnimationMockupApp({ onExit }: { onExit?: () => void }) {
  const [layout, setLayout] = useState<LayoutFlags>(defaultLayout);
  // ?ws=<id> deep-links a workspace; Design has no pipeline tab, so this and the project menu are how it opens.
  const [workspace, setWorkspace] = useState<Workspace>(() => {
    const requested = new URLSearchParams(window.location.search).get("ws");
    return WORKSPACES.some((w) => w.id === requested) ? (requested as Workspace) : "home";
  });
  return (
    <DemoProvider>
      <KitShellProvider layout={layout} setLayout={setLayout} workspaces={TOOL_WORKSPACES} workspaceID={workspace} onWorkspaceSelect={(id) => setWorkspace(id as Workspace)}>
        <Shell onExit={onExit} workspace={workspace} setWorkspace={setWorkspace} />
      </KitShellProvider>
    </DemoProvider>
  );
}

function Shell({ onExit, workspace, setWorkspace }: { onExit?: () => void; workspace: Workspace; setWorkspace: (w: Workspace) => void }) {
  const [theme, setTheme] = useState<ThemeState>({ appearance: "dark", accent: "blue" });
  const [render, setRender] = useState<RenderPrefs>(defaultRenderPrefs);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const { layout } = useKitShell();
  const demo = useDemo();

  // The app presents in the pack's theme for its accent; the classes ride on <html> so portalled menus share them.
  useScopedAetherTheme(ACCENT_THEME[theme.accent], isDark(theme) ? "dark" : "light");
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-aether-kit", "");
    document.title = "Aether Animation Mockup";
    return () => root.removeAttribute("data-aether-kit");
  }, []);

  const app: AppState = { workspace, go: setWorkspace, theme, setTheme, render, setRender, openSettings: () => setSettingsOpen(true), preview, setPreview };
  const body: Partial<Record<Workspace, ReactNode>> = {
    home: <HomeWorkspace app={app} />, character: <CharacterWorkspace app={app} />, design: <DesignWorkspace app={app} />, rig: <RigWorkspace app={app} />,
    animate: <AnimateWorkspace app={app} />, show: <ShowWorkspace app={app} />, hardware: <HardwareWorkspace app={app} />,
  };
  const part = demo.parts.find((p) => p.id === demo.selectedPartID);

  return (
    <div className="animation-mockup-app" data-workspace={workspace}>
      <TopBar app={app} onExit={onExit} />
      <Divider />
      <div className="animation-mockup-body">{body[workspace]}</div>
      {layout.showStatusBar && (<><Divider /><StatusBar workspace={workspaceDef(workspace).name} model={part ? { name: part.name, triangles: part.triangles } : null} engine={render.engine} themeName={render.themeName} /></>)}
      {demo.importing && <div className="animation-mockup-scrim"><ProgressCard title={demo.importing.title} detail={demo.importing.detail} progress={demo.importing.progress} countText={demo.importing.countText} /></div>}
      {settingsOpen && <SettingsWindow app={app} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

// MARK: - Top bar

function TopBar({ app, onExit }: { app: AppState; onExit?: () => void }) {
  const width = useWindowWidth();
  const collapseIcons = width < 1320, compactTabs = width < 1060, compactRight = width < 880;
  const demo = useDemo();
  const { layout, setLayout } = useKitShell();
  const dark = isDark(app.theme);
  const toggleTheme = () => app.setTheme({ ...app.theme, appearance: dark ? "light" : "dark" });
  const [liveOpen, setLiveOpen] = useState(false);
  const liveAnchor = useRef<HTMLButtonElement>(null);
  const home = app.workspace === "home";

  const run = (id: string) => {
    switch (id) {
      case "new": demo.setStatus("New project (placeholder)"); app.go("character"); break;
      case "open": demo.setStatus("Open… (placeholder)"); break;
      case "save": demo.setSaved(true); demo.setStatus("Saved"); break;
      case "import": demo.importModel(); break;
      case "undo": case "redo": demo.setStatus(`${id === "undo" ? "Undo" : "Redo"} (placeholder)`); break;
      case "appearance": toggleTheme(); break;
      case "settings": app.openSettings(); break;
      case "design": app.go("design"); break;
      case "close": onExit ? onExit() : app.go("home"); break;
    }
  };
  const overflowItems = [
    { id: "new", label: "New Project" }, { id: "open", label: "Open…" }, { id: "save", label: "Save" }, { id: "import", label: "Import Model…" },
    { id: "undo", label: "Undo", separatorBefore: true }, { id: "redo", label: "Redo" },
    { id: "design", label: "Design Sandbox", separatorBefore: true },
    { id: "appearance", label: dark ? "Light Appearance" : "Dark Appearance", separatorBefore: true }, { id: "settings", label: "Settings…" },
    { id: "close", label: "Close Project", separatorBefore: true },
  ];
  const projectMenu = [{ id: "new", label: "New Project" }, { id: "open", label: "Open…" }, { id: "save", label: "Save" }, { id: "design", label: "Design Sandbox", separatorBefore: true }, { id: "close", label: "Close Project", separatorBefore: true }];

  const layoutPreset = detectPreset(layout);
  const layoutIcon = LAYOUT_PRESETS.find((p) => p.id === layoutPreset)?.icon ?? "windows";

  if (home) {
    return (
      <header className="animation-mockup-topbar" data-home>
        <div className="animation-mockup-brand-home">
          <Sym name="hexagon" size={16} style={{ color: AD.accent }} />
          <div><strong>Aether Animation Studio</strong><span>Animate digital characters and physical robots.</span></div>
        </div>
        <span className="aui-kit-spacer" />
        <div className="animation-mockup-actions">
          <HeaderIcon icon="plus" label="New project" onClick={() => run("new")} />
          <HeaderIcon icon="import" label="Import model" onClick={() => run("import")} />
          <HeaderIcon icon="folder" label="Open project" onClick={() => run("open")} />
          <HeaderIcon icon="export" label="Export" onClick={() => demo.setStatus("Export (placeholder)")} />
          <Divider vertical height={16} />
          <HeaderIcon icon={dark ? "appearance-light" : "appearance-dark"} label={dark ? "Light appearance" : "Dark appearance"} onClick={toggleTheme} />
          <HeaderIcon icon="settings" label="Settings" onClick={app.openSettings} />
        </div>
      </header>
    );
  }

  return (
    <header className="animation-mockup-topbar">
      <div className="animation-mockup-brand">
        <button type="button" className="animation-mockup-house" aria-label="Home" title="Home" onClick={() => app.go("home")}><Sym name="home" size={12} weight="semibold" /></button>
        <strong className="animation-mockup-project">{demo.projectName}</strong>
        <span className="animation-mockup-saved" data-dirty={!demo.saved || undefined}>{demo.saved ? "SAVED" : "EDITED"}</span>
        {collapseIcons ? (
          <MenuButton className="aui-kit-header-icon animation-mockup-overflow" label="Project menu" items={overflowItems} onSelect={run} placement="bottom-start"><Sym name="menu" size={12} /></MenuButton>
        ) : (
          <div className="animation-mockup-actions">
            <Divider vertical height={16} />
            <MenuButton className="aui-kit-header-icon animation-mockup-overflow" label="Project" items={projectMenu} onSelect={run} placement="bottom-start"><Sym name="document" size={12} /></MenuButton>
            <HeaderIcon icon="import-copy" label="Save" onClick={() => run("save")} />
            <Divider vertical height={16} />
            <HeaderIcon icon="undo" label="Undo" onClick={() => run("undo")} />
            <HeaderIcon icon="redo" label="Redo" onClick={() => run("redo")} />
            <Divider vertical height={16} />
            <HeaderIcon icon={dark ? "appearance-light" : "appearance-dark"} label={dark ? "Light appearance" : "Dark appearance"} onClick={toggleTheme} />
            <HeaderIcon icon="settings" label="Settings" onClick={app.openSettings} />
          </div>
        )}
      </div>
      <span className="aui-kit-spacer" />
      <div className="animation-mockup-tabs" role="tablist" aria-label="Pipeline">
        {PIPELINE.map((id) => <StageChip key={id} stage={workspaceDef(id)} active={app.workspace === id} compact={compactTabs} onClick={() => app.go(id)} />)}
      </div>
      <div className="animation-mockup-actions">
        <button ref={liveAnchor} type="button" className="animation-mockup-live" aria-haspopup="dialog" aria-expanded={liveOpen} onClick={() => setLiveOpen((v) => !v)}>
          <span className="aui-kit-dot" style={{ background: AD.ok, width: 7, height: 7 }} /><span>Live</span><Sym name="chevron-down" size={8} weight="semibold" className="aui-kit-t3" />
        </button>
        <Popover open={liveOpen} anchor={liveAnchor.current} onClose={() => setLiveOpen(false)} ariaLabel="System status" placement="bottom-end" className="aui-kit-popover"><SystemStatusView /></Popover>
        {compactRight
          ? <HeaderIcon icon="play-filled" label="Preview" active={app.preview} onClick={() => app.setPreview(!app.preview)} />
          : <Pill icon="play-filled" label="Preview" active={app.preview} onClick={() => app.setPreview(!app.preview)} />}
        <Divider vertical height={16} />
        <span className="animation-mockup-layout-btn">
          <HeaderIcon icon={layoutIcon} label={`Layout: ${layoutLabel(layout)}`} onClick={() => setLayout((f) => cyclePreset(f))} />
          <MenuButton className="animation-mockup-layout-caret" label="Layout presets" placement="bottom-end" items={LAYOUT_PRESETS.map((p) => ({ id: p.id, label: p.label, kind: "radio" as const, checked: layoutPreset === p.id }))} onSelect={(id) => setLayout((f) => applyPreset(f, id as LayoutPreset))}><Sym name="chevron-down" size={7} weight="bold" /></MenuButton>
        </span>
      </div>
    </header>
  );
}

// MARK: - Settings window (Settings.swift)

const SETTINGS_TABS = [
  { id: "renderer", label: "Renderer", icon: "cube-transparent" }, { id: "appearance", label: "Appearance", icon: "palette" },
  { id: "materials", label: "Materials & Edges", icon: "layers" }, { id: "lighting", label: "Lighting", icon: "lighting" },
  { id: "layout", label: "Layout", icon: "columns" }, { id: "navigation", label: "Navigation", icon: "cursor-motion" }, { id: "ui", label: "UI", icon: "sidebar-squares" },
] as const;

function SettingsWindow({ app, onClose }: { app: AppState; onClose: () => void }) {
  const [tab, setTab] = useState<(typeof SETTINGS_TABS)[number]["id"]>("renderer");
  const { layout, setLayout, ribbon, setRibbon } = useKitShell();
  const { render, setRender } = app;
  const [scene, setScene] = useState({ background: "#292b30", neutral: "#b3b8c2", selection: "#4c9dff", override: null as string | null, roughness: 0.35, metallic: 0.2, edges: true, edgeStrength: 0.7, edgeColor: "#1a1e27", edgeSelection: "#ffd60a" });
  const [lights, setLights] = useState({ key: { color: "#ffffff", intensity: 3200 }, fill: { color: "#dfe7ff", intensity: 1400 }, rim: { color: "#ffe9d2", intensity: 900 } });
  const [nav, setNav] = useState({ orbit: 1, pan: 1, zoom: 1, invertX: false, invertY: false, invertZoom: false });
  const [project, setProject] = useState({ units: "Millimeters", autosave: true, fps: 24 });
  useEffect(() => { const on = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on); }, [onClose]);
  const preset = detectPreset(layout) ?? "floating";
  const leftMode = !layout.showLeft ? "hidden" : layout.leftDocked ? "docked" : "floating";
  const rightMode = !layout.showRight ? "hidden" : layout.rightDocked ? "docked" : layout.rightPinned ? "floating" : "auto";
  const menu = (label: string, value: string, options: readonly string[], set: (v: string) => void, width = 150) => (
    <MenuButton className="animation-mockup-select" label={label} style={{ width }} items={options.map((o) => ({ id: o, label: o, kind: "radio" as const, checked: value === o }))} onSelect={set}><span>{value}</span><Sym name="chevron-up" size={7} /><Sym name="chevron-down" size={7} /></MenuButton>
  );

  const pages: Record<typeof tab, ReactNode> = {
    renderer: (
      <SettingsPage title="Renderer" subtitle="Choose the backend that draws the viewport, and how finely imported CAD is tessellated.">
        <SettingsSection title="Render Engine" icon="cube-transparent">
          <SettingsLabeledRow label="Engine">{menu("Engine", render.engine, RENDER_ENGINES.map((e) => (e === "Ray Traced" ? "Ray Traced — unavailable" : e)), (v) => setRender({ ...render, engine: v.replace(" — unavailable", "") }), 190)}</SettingsLabeledRow>
          <p className="aui-kit-footnote">{{ RealityKit: "Apple RealityKit · native Metal (default)", Metal: "Custom MetalKit renderer — raw buffers", "Ray Traced": "Metal hardware ray tracing — traced shadows (Apple Silicon)", WebGPU: "navigator.gpu · WGSL in a WKWebView (portable)", "Three.js": "Three.js on WebGPU in a WKWebView (portable)" }[render.engine]}</p>
          {render.engine === "Ray Traced" && <p className="aui-kit-footnote" style={{ color: AD.warn }}><Sym name="status-error" size={10} /> Not available on this device — the viewport falls back to Metal.</p>}
        </SettingsSection>
        <SettingsSection title="Import Quality" icon="grid-3" footnote="Lower deflection means a finer mesh and a slower import. Applies to the next import.">
          <SettingsSlider label="Tessellation" value={render.deflection} min={0.02} max={1} onChange={(deflection) => setRender({ ...render, deflection })} format={(v) => `${v.toFixed(2)} mm`} />
        </SettingsSection>
        <SettingsSection title="Viewport Overlays" icon="move">
          <SettingsCheck label="Show character origin axes" checked={render.showOrigin} onChange={(showOrigin) => setRender({ ...render, showOrigin })} />
          <SettingsCheck label="Show orientation view cube" checked={render.showViewCube} onChange={(showViewCube) => setRender({ ...render, showViewCube })} />
          <SettingsCheck label="Pin the performance HUD to the corner" checked={render.pinPerformance} onChange={(pinPerformance) => setRender({ ...render, pinPerformance })} />
        </SettingsSection>
      </SettingsPage>
    ),
    appearance: (
      <SettingsPage title="Appearance" subtitle="Start from a coordinated preset, then tune the shared renderer theme.">
        <SettingsSection title="Theme Preset" icon="palette">
          <SettingsLabeledRow label="Preset">{menu("Preset", render.themeName, BENCH_THEMES, (themeName) => setRender({ ...render, themeName }), 190)}</SettingsLabeledRow>
          <ThemeSwatchStrip colors={[scene.background, scene.override ?? scene.neutral, scene.edgeColor, scene.selection, lights.key.color, lights.fill.color, lights.rim.color]} />
        </SettingsSection>
        <SettingsSection title="Scene Colors" icon="contrast">
          <SettingsColorRow label="Viewport background" color={scene.background} onChange={(background) => setScene({ ...scene, background })} />
          <SettingsColorRow label="Unspecified model color" color={scene.neutral} onChange={(neutral) => setScene({ ...scene, neutral })} />
          <SettingsColorRow label="Face selection" color={scene.selection} onChange={(selection) => setScene({ ...scene, selection })} />
        </SettingsSection>
        <SettingsSection title="Imported Model Colors" icon="cube" footnote="Turn this off to apply one diagnostic color to every imported face.">
          <SettingsCheck label="Preserve colors from STEP/XDE" checked={scene.override === null} onChange={(keep) => setScene({ ...scene, override: keep ? null : scene.neutral })} />
          <div style={{ opacity: scene.override === null ? 0.5 : 1 }}><SettingsColorRow label="Model override" color={scene.override ?? scene.neutral} onChange={(override) => setScene({ ...scene, override })} /></div>
        </SettingsSection>
      </SettingsPage>
    ),
    materials: (
      <SettingsPage title="Materials & Edges" subtitle="Configure the common surface finish and CAD feature-edge treatment.">
        <SettingsSection title="Surface Material" icon="circle-dashed">
          <SettingsSlider label="Roughness" value={scene.roughness} onChange={(roughness) => setScene({ ...scene, roughness })} />
          <SettingsSlider label="Metallic" value={scene.metallic} onChange={(metallic) => setScene({ ...scene, metallic })} />
          <div className="aui-kit-hstack-8" style={{ gap: 14 }}><MaterialPreviewSphere roughness={scene.roughness} metallic={scene.metallic} /><p className="aui-kit-footnote">These renderer-neutral values are mapped into each backend's closest native material model.</p></div>
        </SettingsSection>
        <SettingsSection title="Feature Edges" icon="square-dashed">
          <SettingsCheck label="Show B-Rep feature edges" checked={scene.edgeStrength > 0} onChange={(on) => setScene({ ...scene, edgeStrength: on ? 0.7 : 0 })} />
          <SettingsSlider label="Edge strength" value={scene.edgeStrength} onChange={(edgeStrength) => setScene({ ...scene, edgeStrength })} />
          <SettingsColorRow label="Edge color" color={scene.edgeColor} onChange={(edgeColor) => setScene({ ...scene, edgeColor })} />
          <SettingsColorRow label="Selected edge" color={scene.edgeSelection} onChange={(edgeSelection) => setScene({ ...scene, edgeSelection })} />
        </SettingsSection>
      </SettingsPage>
    ),
    lighting: (
      <SettingsPage title="Lighting" subtitle="Balance the common key, fill, and rim rig used by every renderer. Intensity is normalized by each backend so the visual relationship stays comparable.">
        {([["key", "Key Light", "Defines the primary form and shadow direction."], ["fill", "Fill Light", "Controls contrast on the unlit side."], ["rim", "Rim Light", "Separates the silhouette from the background."]] as const).map(([k, title, detail]) => (
          <SettingsSection key={k} title={title} icon="lighting">
            <p className="aui-kit-footnote">{detail}</p>
            <SettingsColorRow label="Color" color={lights[k].color} onChange={(color) => setLights({ ...lights, [k]: { ...lights[k], color } })} />
            <SettingsSlider label="Relative intensity" value={lights[k].intensity} min={0} max={8000} step={10} onChange={(intensity) => setLights({ ...lights, [k]: { ...lights[k], intensity } })} format={(v) => v.toFixed(0)} />
          </SettingsSection>))}
      </SettingsPage>
    ),
    layout: (
      <SettingsPage title="Layout" subtitle="The Studio layout preset controls every panel at once. Fine-tune individual panels below.">
        <SettingsSection title="Studio Layout" icon="columns" footnote="Matches the layout button at the right of the toolbar.">
          <Segmented options={LAYOUT_PRESETS.map((p) => ({ id: p.id, label: p.label }))} value={preset} onChange={(id) => setLayout((f) => applyPreset(f, id))} ariaLabel="Studio layout" size="regular" />
          <SettingsCheck label="Push panels to the outer edge" checked={layout.panelsOnOuterEdge} onChange={(panelsOnOuterEdge) => setLayout({ ...layout, panelsOnOuterEdge })} />
        </SettingsSection>
        <SettingsSection title="Panels" icon="sidebar">
          <SettingsLabeledRow label="Browser (left)">{menu("Browser", leftMode, ["docked", "floating", "hidden"], (v) => setLayout({ ...layout, showLeft: v !== "hidden", leftDocked: v === "docked" }))}</SettingsLabeledRow>
          <SettingsLabeledRow label="Inspector (right)">{menu("Inspector", rightMode, ["docked", "floating", "auto", "hidden"], (v) => setLayout({ ...layout, showRight: v !== "hidden", rightDocked: v === "docked", rightPinned: v === "floating" || v === "docked" }))}</SettingsLabeledRow>
          <SettingsLabeledRow label="Tool ribbon">{menu("Tool ribbon", layout.ribbonDocked ? "docked" : "floating", ["docked", "floating"], (v) => setLayout({ ...layout, ribbonDocked: v === "docked" }))}</SettingsLabeledRow>
        </SettingsSection>
      </SettingsPage>
    ),
    navigation: (
      <SettingsPage title="Navigation" subtitle="Mouse and trackpad behaviour in the 3D viewport. 1.00× matches the Onshape defaults.">
        <SettingsSection title="Sensitivity" icon="cursor-motion">
          <SettingsSlider label="Orbit" value={nav.orbit} min={0.25} max={3} onChange={(orbit) => setNav({ ...nav, orbit })} format={(v) => `${v.toFixed(2)}×`} />
          <SettingsSlider label="Pan" value={nav.pan} min={0.25} max={3} onChange={(pan) => setNav({ ...nav, pan })} format={(v) => `${v.toFixed(2)}×`} />
          <SettingsSlider label="Zoom" value={nav.zoom} min={0.25} max={3} onChange={(zoom) => setNav({ ...nav, zoom })} format={(v) => `${v.toFixed(2)}×`} />
        </SettingsSection>
        <SettingsSection title="Invert" icon="swap-horizontal">
          <SettingsCheck label="Orbit horizontal" checked={nav.invertX} onChange={(invertX) => setNav({ ...nav, invertX })} />
          <SettingsCheck label="Orbit vertical" checked={nav.invertY} onChange={(invertY) => setNav({ ...nav, invertY })} />
          <SettingsCheck label="Zoom direction" checked={nav.invertZoom} onChange={(invertZoom) => setNav({ ...nav, invertZoom })} />
        </SettingsSection>
        <SettingsSection title="Mouse & Trackpad" icon="mouse" footnote="Button mapping follows the Onshape scheme.">
          {[["Rotate", "Left- or right-drag"], ["Pan", "Middle-drag"], ["Zoom", "Scroll / pinch"], ["Fit to view", "Double middle-click"], ["Select", "Left-click (no drag)"]].map(([a, g]) => <div key={a} className="aui-kit-between aui-kit-s12"><span>{a}</span><span className="aui-kit-t2 aui-kit-s11">{g}</span></div>)}
        </SettingsSection>
      </SettingsPage>
    ),
    ui: (
      <SettingsPage title="Interface" subtitle="App chrome, tool presentation, and project defaults.">
        <SettingsSection title="Theme" icon="contrast" footnote="System follows macOS. The same tokens drive every panel, so light and dark stay consistent.">
          <Segmented options={[{ id: "system", label: "System", icon: "contrast" }, { id: "light", label: "Light", icon: "appearance-light" }, { id: "dark", label: "Dark", icon: "appearance-dark" }]} value={app.theme.appearance} onChange={(appearance) => app.setTheme({ ...app.theme, appearance })} ariaLabel="Appearance" size="regular" />
          <div className="animation-mockup-accents" role="radiogroup" aria-label="Accent">
            {ACCENTS.map((a) => <button key={a.id} type="button" role="radio" aria-checked={app.theme.accent === a.id} aria-label={a.label} title={a.label} data-active={app.theme.accent === a.id || undefined} style={{ background: a.swatch }} onClick={() => app.setTheme({ ...app.theme, accent: a.id })}>{app.theme.accent === a.id && <Sym name="check" size={9} weight="bold" />}</button>)}
          </div>
        </SettingsSection>
        <SettingsSection title="Chrome" icon="window">
          <SettingsCheck label="Show status bar" checked={layout.showStatusBar} onChange={(showStatusBar) => setLayout({ ...layout, showStatusBar })} />
          <SettingsCheck label="Dev: show layout zones" checked={layout.showZones} onChange={(showZones) => setLayout({ ...layout, showZones })} />
        </SettingsSection>
        <SettingsSection title="Sidebars" icon="sidebar-squares" footnote="The tool sidebar (top), workspace sidebar (left), and view sidebar (right). Panels toggle from their rail, stack, and can be dragged off to float.">
          <SettingsLabeledRow label="Layout mode">{menu("Layout mode", LAYOUT_PRESETS.find((p) => p.id === preset)!.label, LAYOUT_PRESETS.map((p) => p.label), (v) => setLayout((f) => applyPreset(f, LAYOUT_PRESETS.find((p) => p.label === v)!.id)), 170)}</SettingsLabeledRow>
          <SettingsCheck label="Push panels to the outer edge" checked={layout.panelsOnOuterEdge} onChange={(panelsOnOuterEdge) => setLayout({ ...layout, panelsOnOuterEdge })} />
          <SettingsLabeledRow label="Tool density"><Segmented options={TOOL_DENSITIES.map((d) => ({ id: d.id, label: d.label }))} value={ribbon.density} onChange={(density) => setRibbon({ ...ribbon, density })} ariaLabel="Tool density" /></SettingsLabeledRow>
          <SettingsLabeledRow label="Tool popup"><Segmented options={[{ id: "list", label: "List" }, { id: "grid", label: "Icons" }]} value={ribbon.popupStyle} onChange={(popupStyle) => setRibbon({ ...ribbon, popupStyle })} ariaLabel="Tool popup" /></SettingsLabeledRow>
          <SettingsLabeledRow label="Toolbar"><Segmented options={[{ id: "sidebar", label: "Tool sidebar" }, { id: "ribbon", label: "Tinted ribbon" }]} value={ribbon.toolbar} onChange={(toolbar) => setRibbon({ ...ribbon, toolbar })} ariaLabel="Toolbar" /></SettingsLabeledRow>
          <SettingsCheck label="Center tray under the viewport (Rex build)" checked={ribbon.centerTray} onChange={(centerTray) => setRibbon({ ...ribbon, centerTray })} />
        </SettingsSection>
        <SettingsSection title="Project" icon="folder">
          <SettingsLabeledRow label="Units">{menu("Units", project.units, ["Millimeters", "Centimeters", "Inches"], (units) => setProject({ ...project, units }))}</SettingsLabeledRow>
          <SettingsCheck label="Autosave" checked={project.autosave} onChange={(autosave) => setProject({ ...project, autosave })} />
          <SettingsSlider label="Frame rate" value={project.fps} min={12} max={60} step={1} onChange={(fps) => setProject({ ...project, fps })} format={(v) => `${v.toFixed(0)} fps`} />
        </SettingsSection>
      </SettingsPage>
    ),
  };

  return (
    <div className="animation-mockup-scrim" onClick={onClose}>
      <div className="animation-mockup-settings" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <div className="animation-mockup-settings-tabs" role="tablist">
          {SETTINGS_TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} data-active={tab === t.id || undefined} onClick={() => setTab(t.id)}><Sym name={t.icon} size={16} /><span>{t.label}</span></button>)}
          <span className="aui-kit-spacer" />
          <button type="button" className="aui-kit-plain aui-kit-t3" aria-label="Close settings" onClick={onClose}><Sym name="close-circle" size={16} /></button>
        </div>
        <Divider />
        <div className="animation-mockup-settings-page">{pages[tab]}</div>
      </div>
    </div>
  );
}

export { Caption as _Caption };

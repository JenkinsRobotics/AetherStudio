/**
 * Atlas Studio Demo — the CodexUI walkthrough (archived SwiftUI demo, removed 2026-09-23; project
 * "Atlas Animatronic") as its own launchable Aether UI concept app.
 * CodexUIShell + PrototypeModel + PrototypeTheme + PrototypeSettingsView,
 * composed from @aether/ui's animation-mockup-widgets entry; workspaces in
 * ./workspaces.tsx, the specimen gallery in ./uikit.tsx.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { MenuButton, type MenuItem } from "../../src/Menu";
import { Popover } from "../../src/Popover";
import { useScopedAetherTheme } from "../../src/StudioChrome";
import { aetherTheme } from "../../src/themes";
import {
  AD, KitShellProvider, Badge, CommandButton, DockingWorkspace, Segmented, SettingsCheck, SettingsLabeledRow, SettingsPage, SettingsSection, Switch, Sym, ThemeTileGrid, ToolRibbon,
  WalkthroughCard, WorkspaceStageTabs, STAGE_LABEL_MODES, defaultLayout, ribbonGroupsOf, showsStageLabel, type DockPlacement, type LayoutFlags, type RibbonGroup, type StageLabelMode,
} from "../../src/Kit";
import { ATLAS_CATALOG, ATLAS_WORKSPACES, type AtlasWorkspace, type AtlasWorkspaceDef } from "./catalog";
import { AssetsWorkspace, RigWorkspace, AnimateWorkspace, ShowWorkspace, HardwareWorkspace, NodesWorkspace } from "./workspaces";
import "./atlas-demo.css";

// MARK: - PrototypeTheme

export const ATLAS_THEMES = [
  { id: "studio", label: "Studio Blue", theme: "aether-studio", appearance: "dark" },
  { id: "teal", label: "Studio Teal", theme: "aether-teal", appearance: "dark" },
  { id: "indigo", label: "Studio Indigo", theme: "aether-indigo", appearance: "dark" },
  { id: "orange", label: "Studio Orange", theme: "aether-orange", appearance: "dark" },
  { id: "graphite", label: "Graphite", theme: "graphite", appearance: "dark" },
  { id: "cadLight", label: "CAD Light", theme: "aether-studio", appearance: "light" },
  { id: "midnight", label: "Midnight", theme: "midnight", appearance: "dark" },
] as const;
export type AtlasThemeID = (typeof ATLAS_THEMES)[number]["id"];
/** The resolved tokens of an Atlas theme, so tiles and swatches never carry a second copy of a colour. */
export const atlasThemeTokens = (id: AtlasThemeID) => { const t = ATLAS_THEMES.find((x) => x.id === id)!; return aetherTheme(t.theme)!.modes[t.appearance]; };
const themeTiles = ATLAS_THEMES.map((t) => {
  const tokens = atlasThemeTokens(t.id);
  return { id: t.id, label: t.label.replace("Studio ", ""), panel: tokens["color-bg-panel"], accent: tokens["color-accent"], line: t.appearance === "light" ? tokens["color-border-control"] : undefined };
});

// MARK: - PrototypeModel

export type LayoutPresetID = "studio" | "classic" | "canvas";
export const ATLAS_PRESETS: readonly { id: LayoutPresetID; label: string; icon: string; left: DockPlacement; right: DockPlacement; ribbon: DockPlacement; tint: string }[] = [
  { id: "studio", label: "Floating", icon: "windows", left: "floating", right: "floating", ribbon: "floating", tint: AD.accent2 },
  { id: "classic", label: "Docked", icon: "columns", left: "docked", right: "docked", ribbon: "docked", tint: AD.purple },
  { id: "canvas", label: "Canvas", icon: "fit", left: "hidden", right: "hidden", ribbon: "floating", tint: AD.warn },
];

export interface AtlasModel {
  workspace: AtlasWorkspace; select: (w: AtlasWorkspace) => void; next: () => void; previous: () => void; tourIndex: number;
  theme: AtlasThemeID; setTheme: (t: AtlasThemeID) => void;
  left: DockPlacement; right: DockPlacement; ribbon: DockPlacement; ribbonEdge: "top" | "bottom";
  setPlacements: (p: Partial<{ left: DockPlacement; right: DockPlacement; ribbon: DockPlacement; ribbonEdge: "top" | "bottom" }>) => void;
  applyPreset: (id: LayoutPresetID) => void; detectedPreset: LayoutPresetID | null; cyclePreset: () => void;
  labelMode: StageLabelMode; setLabelMode: (m: StageLabelMode) => void;
  showsTour: boolean; setShowsTour: (v: boolean) => void;
  showsHUD: boolean; setShowsHUD: (v: boolean) => void;
  previewActive: boolean; setPreviewActive: (v: boolean) => void;
  masterLive: boolean; setMasterLive: (v: boolean) => void;
  selectedPart: string; setSelectedPart: (p: string) => void;
  selectedTime: number; setSelectedTime: (t: number) => void;
}

const ModelContext = createContext<AtlasModel | null>(null);
export const useAtlas = () => { const m = useContext(ModelContext); if (!m) throw new Error("useAtlas needs <AtlasDemoApp>"); return m; };

export function AtlasDemoApp({ onExit }: { onExit?: () => void }) {
  return <AtlasModelProvider applyDocumentTheme><Shell onExit={onExit}/></AtlasModelProvider>;
}

export function AtlasModelProvider({ children, applyDocumentTheme = false }: { children: ReactNode; applyDocumentTheme?: boolean }) {
  const [layout, setLayout] = useState<LayoutFlags>(defaultLayout);
  const [workspace, setWorkspace] = useState<AtlasWorkspace>(() => {
    const requested = new URLSearchParams(window.location.search).get("ws");
    return ATLAS_WORKSPACES.some((w) => w.id === requested) ? (requested as AtlasWorkspace) : "assets";
  });
  const [theme, setTheme] = useState<AtlasThemeID>("studio");
  const [placements, setP] = useState({ left: "floating" as DockPlacement, right: "floating" as DockPlacement, ribbon: "floating" as DockPlacement, ribbonEdge: "top" as "top" | "bottom" });
  const [labelMode, setLabelMode] = useState<StageLabelMode>("automatic");
  const [showsTour, setShowsTour] = useState(true);
  const [showsHUD, setShowsHUD] = useState(true);
  const [previewActive, setPreviewActive] = useState(true);
  const [masterLive, setMasterLive] = useState(false);
  const [selectedPart, setSelectedPart] = useState("Head Pan Assembly");
  const [selectedTime, setSelectedTime] = useState(2.4);
  const tourIndex = ATLAS_WORKSPACES.findIndex((w) => w.id === workspace);
  const detectedPreset = ATLAS_PRESETS.find((p) => p.left === placements.left && p.right === placements.right && p.ribbon === placements.ribbon)?.id ?? null;
  const applyPreset = (id: LayoutPresetID) => { const p = ATLAS_PRESETS.find((x) => x.id === id)!; setP((c) => ({ ...c, left: p.left, right: p.right, ribbon: p.ribbon })); };
  const model: AtlasModel = {
    workspace, select: setWorkspace, tourIndex,
    next: () => setWorkspace(ATLAS_WORKSPACES[(tourIndex + 1) % ATLAS_WORKSPACES.length].id),
    previous: () => setWorkspace(ATLAS_WORKSPACES[(tourIndex - 1 + ATLAS_WORKSPACES.length) % ATLAS_WORKSPACES.length].id),
    theme, setTheme, ...placements, setPlacements: (p) => setP((c) => ({ ...c, ...p })), applyPreset, detectedPreset,
    cyclePreset: () => applyPreset(({ studio: "classic", classic: "canvas", canvas: "studio" } as const)[detectedPreset ?? "canvas"]),
    labelMode, setLabelMode, showsTour, setShowsTour, showsHUD, setShowsHUD, previewActive, setPreviewActive, masterLive, setMasterLive, selectedPart, setSelectedPart, selectedTime, setSelectedTime,
  };
  const chosen = ATLAS_THEMES.find((x) => x.id === theme)!;
  useScopedAetherTheme(applyDocumentTheme ? chosen.theme : null, applyDocumentTheme ? chosen.appearance : undefined);
  useEffect(() => {
    if (!applyDocumentTheme) return;
    const root = document.documentElement;
    root.setAttribute("data-aether-kit", "");
    document.title = "Atlas Studio Demo";
    return () => root.removeAttribute("data-aether-kit");
  }, [applyDocumentTheme]);
  useEffect(() => {
    if (!applyDocumentTheme) return;
    const onKey = (e: KeyboardEvent) => { if (e.metaKey && e.key === "]") model.next(); if (e.metaKey && e.key === "[") model.previous(); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <ModelContext.Provider value={model}>
      <KitShellProvider layout={layout} setLayout={setLayout} initialRibbon={{ popupStyle: "grid" }}>
        {children}
      </KitShellProvider>
    </ModelContext.Provider>
  );
}

function Shell({ onExit }: { onExit?: () => void }) {
  const m = useAtlas();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const def = ATLAS_WORKSPACES.find((w) => w.id === m.workspace)!;
  const ribbon = m.ribbon !== "hidden" && <AdaptiveRibbon workspace={def} docked={m.ribbon === "docked"} />;
  const body: Partial<Record<AtlasWorkspace, ReactNode>> = {
    assets: <AssetsWorkspace />, rig: <RigWorkspace />, animate: <AnimateWorkspace />, show: <ShowWorkspace />, hardware: <HardwareWorkspace />, nodes: <NodesWorkspace />,
  };
  return (
    <div className="atlas-app">
      <Header onSettings={() => setSettingsOpen(true)} onExit={onExit} />
      {m.ribbon === "docked" && ribbon}
      <div className="atlas-body" data-ribbon-edge={m.ribbon === "floating" ? m.ribbonEdge : undefined}>
        {body[m.workspace]}
        {m.ribbon === "floating" && <div className="atlas-floating-ribbon" data-edge={m.ribbonEdge}>{ribbon}</div>}
        {m.showsTour && (
          <div className="atlas-walkthrough" style={{ bottom: m.ribbon === "floating" && m.ribbonEdge === "bottom" ? 106 : 38 }}>
            <WalkthroughCard icon={def.icon} progress={`${m.tourIndex + 1} of ${ATLAS_WORKSPACES.length}`} purpose={def.purpose} onPrevious={m.previous} onNext={m.next} onClose={() => m.setShowsTour(false)} />
          </div>
        )}
      </div>
      <StatusBar />
      {settingsOpen && <SettingsWindow onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

// MARK: - AdaptiveRibbon: the kit's tinted ribbon plus CodexUI's placement menu

function AdaptiveRibbon({ workspace, docked }: { workspace: AtlasWorkspaceDef; docked: boolean }) {
  const m = useAtlas();
  const groups: RibbonGroup[] = ribbonGroupsOf(ATLAS_CATALOG[workspace.id], AD.accent);
  const items: MenuItem[] = [
    { id: "dock", label: "Dock Tool Ribbon", icon: <Sym name="rectangle-inset" size={11} /> },
    { id: "top", label: "Float at Top", icon: <Sym name="rectangle-inset" size={11} /> },
    { id: "bottom", label: "Float at Bottom", icon: <Sym name="rectangle-inset" size={11} style={{ transform: "rotate(180deg)" }} /> },
    { id: "hide", label: "Hide Tool Ribbon", icon: <Sym name="hidden" size={11} />, separatorBefore: true },
  ];
  const pick = (id: string) => {
    if (id === "dock") m.setPlacements({ ribbon: "docked" });
    if (id === "top") m.setPlacements({ ribbon: "floating", ribbonEdge: "top" });
    if (id === "bottom") m.setPlacements({ ribbon: "floating", ribbonEdge: "bottom" });
    if (id === "hide") m.setPlacements({ ribbon: "hidden" });
  };
  const menu = (
    <span className="atlas-ribbon-placement">
      <CommandButton icon={docked ? "window" : "rectangle-inset"} label={docked ? `Click to float at ${m.ribbonEdge} · open menu for all states` : "Click to dock · open menu for top, bottom, and hidden states"} onClick={() => m.setPlacements({ ribbon: docked ? "floating" : "docked" })} />
      <MenuButton className="atlas-caret" label="Ribbon placement" items={items} onSelect={pick} placement="bottom-end"><Sym name="chevron-down" size={7} weight="bold" /></MenuButton>
    </span>
  );
  return docked
    ? <div className="atlas-ribbon-docked"><ToolRibbon groups={groups} docked /><span className="aui-kit-spacer" />{menu}</div>
    : <div className="atlas-ribbon-floating"><ToolRibbon groups={groups} docked={false} /><span className="aui-kit-vdivider" style={{ height: 28 }} />{menu}</div>;
}

// MARK: - CodexUIShell header

function Header({ onSettings, onExit }: { onSettings: () => void; onExit?: () => void }) {
  const m = useAtlas();
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => { const on = () => setWidth(window.innerWidth); window.addEventListener("resize", on); return () => window.removeEventListener("resize", on); }, []);
  const compact = width < 1600;
  const [statusOpen, setStatusOpen] = useState(false);
  const statusAnchor = useRef<HTMLButtonElement>(null);
  const preset = ATLAS_PRESETS.find((p) => p.id === m.detectedPreset);
  const placementItems = (current: DockPlacement, prefix: string): MenuItem[] => (["docked", "floating", "hidden"] as const).map((p) => ({ id: `${prefix}:${p}`, label: p[0].toUpperCase() + p.slice(1), kind: "radio" as const, checked: current === p }));
  const layoutItems: MenuItem[] = [
    ...ATLAS_PRESETS.map((p) => ({ id: `preset:${p.id}`, label: p.label, icon: <Sym name={p.icon} size={11} />, kind: "radio" as const, checked: m.detectedPreset === p.id, heading: p.id === "studio" ? "Layout presets" : undefined })),
    { id: "browser", label: "Browser", icon: <Sym name="sidebar" size={11} />, separatorBefore: true, children: placementItems(m.left, "left") },
    { id: "inspector", label: "Inspector", icon: <Sym name="sidebar-right" size={11} />, children: placementItems(m.right, "right") },
    { id: "ribbon", label: "Tool Ribbon", icon: <Sym name="rectangle-inset" size={11} />, children: [
      { id: "ribbon:docked", label: "Docked", kind: "radio", checked: m.ribbon === "docked" }, { id: "ribbon:top", label: "Float at Top", kind: "radio", checked: m.ribbon === "floating" && m.ribbonEdge === "top" },
      { id: "ribbon:bottom", label: "Float at Bottom", kind: "radio", checked: m.ribbon === "floating" && m.ribbonEdge === "bottom" }, { id: "ribbon:hidden", label: "Hidden", kind: "radio", checked: m.ribbon === "hidden" },
    ] },
  ];
  const onLayout = (id: string) => {
    const [kind, value] = id.split(":");
    if (kind === "preset") m.applyPreset(value as LayoutPresetID);
    if (kind === "left" || kind === "right") m.setPlacements({ [kind]: value as DockPlacement });
    if (kind === "ribbon") m.setPlacements(value === "docked" || value === "hidden" ? { ribbon: value } : { ribbon: "floating", ribbonEdge: value as "top" | "bottom" });
  };
  const fileItems: MenuItem[] = [{ id: "new", label: "New Project", icon: <Sym name="document-add" size={11} /> }, { id: "open", label: "Open…", icon: <Sym name="folder" size={11} /> }, { id: "save", label: "Save", icon: <Sym name="import" size={11} />, separatorBefore: true }, { id: "import", label: "Import Model…", icon: <Sym name="import-copy" size={11} /> }, { id: "close", label: "Close", separatorBefore: true }];
  return (
    <header className="atlas-header">
      <div className="atlas-header-left">
        <span className="atlas-identity" title="Open project · Atlas Animatronic · revision 12">
          <Sym name="cube-filled" size={15} weight="semibold" style={{ color: AD.warn }} /><strong>Atlas Animatronic</strong>
          <span className="atlas-saved"><Sym name="status-ok" size={8} weight="bold" />SAVED</span>
        </span>
        <span className="aui-kit-hair" style={{ height: 16 }} />
        <CommandButton icon="settings" label="Appearance and layout settings" onClick={onSettings} />
        <span className="aui-kit-hair" style={{ height: 16 }} />
        <CommandButton icon="home" label="Home" onClick={() => m.select("assets")} />
        <MenuButton className="aui-kit-command atlas-file" label="Project and file commands" items={fileItems} onSelect={(id) => { if (id === "close" && onExit) onExit(); }} placement="bottom-start"><Sym name="document" size={11} weight="semibold" /></MenuButton>
        <CommandButton icon="undo" label="Undo" /><CommandButton icon="redo" label="Redo" />
      </div>
      <div className="atlas-header-center"><WorkspaceStageTabs stages={ATLAS_WORKSPACES.map((w) => ({ id: w.id, name: w.name, icon: w.icon }))} activeID={m.workspace} onSelect={(id) => m.select(id as AtlasWorkspace)} compact={compact} labelMode={m.labelMode} utilityStartID="nodes" /></div>
      <div className="atlas-header-right">
        <button ref={statusAnchor} type="button" className="atlas-live" aria-haspopup="dialog" aria-expanded={statusOpen} onClick={() => setStatusOpen((v) => !v)}><span className="aui-kit-dot" style={{ background: AD.ok, width: 7, height: 7 }} />Live<Sym name="chevron-down" size={7} weight="bold" /></button>
        <Popover open={statusOpen} anchor={statusAnchor.current} onClose={() => setStatusOpen(false)} ariaLabel="Prototype status" placement="bottom-end" className="aui-kit-popover">
          <div className="atlas-status-popover">
            <strong className="aui-kit-hstack-6 aui-kit-s11"><Sym name="pulse" size={11} weight="semibold" />Prototype status</strong>
            <span className="aui-kit-divider" />
            {[["Engine", "Ready", AD.ok], ["Hardware driver", "Not connected", AD.text2], ["Runtime", "Presentation only", AD.warn]].map(([l, v, c]) => <div key={l} className="aui-kit-between" style={{ fontSize: 10 }}><span className="aui-kit-hstack-6"><span className="aui-kit-dot" style={{ background: c, width: 7, height: 7 }} />{l}</span><span style={{ color: c, fontSize: 9, fontWeight: 500 }}>{v}</span></div>)}
            <label className="aui-kit-toggle-line" style={{ fontSize: 10, fontWeight: 500 }}>Master Live<span className="aui-kit-spacer" /><Switch checked={m.masterLive} onChange={m.setMasterLive} label="Master Live" size="mini" /></label>
            <span className="aui-kit-t2" style={{ fontSize: 9 }}>No backend, files, or hardware are changed by CodexUI.</span>
          </div>
        </Popover>
        <button type="button" className="atlas-preview" data-active={m.previewActive || undefined} aria-pressed={m.previewActive} title={m.previewActive ? "Pause preview" : "Start preview"} onClick={() => m.setPreviewActive(!m.previewActive)}><Sym name={m.previewActive ? "pause" : "play-filled"} size={8} weight="bold" />{!compact && <span>Preview</span>}</button>
        <span className="aui-kit-hair" style={{ height: 16 }} />
        <span className="atlas-layout-btn" style={{ "--tint": preset?.tint ?? AD.ok } as React.CSSProperties}>
          <button type="button" className="atlas-layout-main" aria-label={`${preset?.label ?? "Custom"} layout · click to cycle`} title={`${preset?.label ?? "Custom"} layout · click to cycle · open menu for individual panel states`} onClick={m.cyclePreset}><Sym name={preset?.icon ?? "grid-2"} size={11} weight="bold" /></button>
          <MenuButton className="atlas-caret" label="Layout" items={layoutItems} onSelect={onLayout} placement="bottom-end"><Sym name="chevron-down" size={7} weight="bold" /></MenuButton>
        </span>
        <CommandButton icon="help" label="Toggle guided walkthrough" active={m.showsTour} onClick={() => m.setShowsTour(!m.showsTour)} />
      </div>
    </header>
  );
}

function StatusBar() {
  return (
    <footer className="atlas-status">
      <span className="aui-kit-hstack-5"><Sym name="hexagon" size={10} style={{ color: AD.warn }} /><strong>CodexUI</strong></span>
      <span className="aui-kit-hair" style={{ height: 13 }} />
      <span className="aui-kit-hstack-5"><Sym name="brush" size={9} />Prototype only</span>
      <span>No backend · no files are changed</span>
      <span className="aui-kit-spacer" />
      <span className="aui-kit-hstack-5"><Sym name="gauge" size={9} />60 FPS</span>
      <span>Local SwiftUI</span>
      <span>⌘[ / ⌘] Workspaces</span>
    </footer>
  );
}

// MARK: - PrototypeSettingsView

export function SettingsPanes({ tab }: { tab: "appearance" | "workspace" | "behavior" }) {
  const m = useAtlas();
  const t = ATLAS_THEMES.find((x) => x.id === m.theme)!;
  const swatch = (label: string, color: string) => <span key={label} className="atlas-swatch"><i style={{ background: color }} /><small>{label}</small></span>;
  const tokens = atlasThemeTokens(t.id);
  const panel = tokens["color-bg-panel"], canvas = tokens["color-bg-app"], raised = tokens["color-bg-control"];
  const placementRow = (label: string, value: DockPlacement, set: (v: DockPlacement) => void) => (
    <SettingsLabeledRow label={label}><Segmented options={[{ id: "docked", label: "Docked" }, { id: "floating", label: "Floating" }, { id: "hidden", label: "Hidden" }]} value={value} onChange={set} ariaLabel={label} /></SettingsLabeledRow>
  );
  if (tab === "appearance") return (
    <SettingsPage title="Appearance">
      <SettingsSection title="Application theme" icon="palette">
        <SettingsLabeledRow label="Theme"><MenuButton className="animation-mockup-select" label="Theme" style={{ width: 170 }} items={ATLAS_THEMES.map((x) => ({ id: x.id, label: x.label, kind: "radio" as const, checked: x.id === m.theme }))} onSelect={(id) => m.setTheme(id as AtlasThemeID)}><span>{t.label}</span><Sym name="chevron-up" size={7} /><Sym name="chevron-down" size={7} /></MenuButton></SettingsLabeledRow>
        <ThemeTileGrid themes={themeTiles} activeID={m.theme} onSelect={(id) => m.setTheme(id as AtlasThemeID)} />
        <div className="aui-kit-hstack-8" style={{ gap: 12 }}>{swatch("Canvas", canvas)}{swatch("Panel", panel)}{swatch("Raised", raised)}{swatch("Accent", themeTiles.find((x) => x.id === m.theme)!.accent)}</div>
      </SettingsSection>
      <SettingsSection title="Design intent" icon="align-left"><p className="aui-kit-footnote">the archived native studio app surfaces and typography, restrained strokes, and selectable accent families. Color remains reserved for state, selection, and action.</p></SettingsSection>
    </SettingsPage>
  );
  if (tab === "workspace") return (
    <SettingsPage title="Workspace">
      <SettingsSection title="Layout preset" icon="rectangle-group">
        <Segmented options={ATLAS_PRESETS.map((p) => ({ id: p.id, label: p.label }))} value={m.detectedPreset ?? "studio"} onChange={m.applyPreset} ariaLabel="Preset" size="regular" />
        {placementRow("Left browser", m.left, (left) => m.setPlacements({ left }))}
        {placementRow("Right inspector", m.right, (right) => m.setPlacements({ right }))}
        {placementRow("Tool ribbon", m.ribbon, (ribbon) => m.setPlacements({ ribbon }))}
        <SettingsLabeledRow label="Floating ribbon edge"><Segmented options={[{ id: "top", label: "Top" }, { id: "bottom", label: "Bottom" }]} value={m.ribbonEdge} onChange={(ribbonEdge) => m.setPlacements({ ribbonEdge })} ariaLabel="Floating ribbon edge" /></SettingsLabeledRow>
      </SettingsSection>
      <SettingsSection title="Workspace tabs" icon="columns" footnote="Automatic shows every label when there is room and only the selected workspace label in compact windows.">
        <SettingsLabeledRow label="Text labels"><MenuButton className="animation-mockup-select" label="Text labels" style={{ width: 150 }} items={STAGE_LABEL_MODES.map((x) => ({ id: x.id, label: x.label, kind: "radio" as const, checked: x.id === m.labelMode }))} onSelect={(id) => m.setLabelMode(id as StageLabelMode)}><span>{STAGE_LABEL_MODES.find((x) => x.id === m.labelMode)!.label}</span><Sym name="chevron-up" size={7} /><Sym name="chevron-down" size={7} /></MenuButton></SettingsLabeledRow>
      </SettingsSection>
      <SettingsSection title="Panels" icon="window"><p className="aui-kit-footnote">Floating panels stay constrained to the CodexUI window. Docking places them back into the workspace flow.</p></SettingsSection>
    </SettingsPage>
  );
  return (
    <SettingsPage title="Behavior">
      <SettingsSection title="Prototype behavior" icon="cursor-motion">
        <SettingsCheck label="Show guided walkthrough" checked={m.showsTour} onChange={m.setShowsTour} />
        <SettingsCheck label="Show viewport performance HUD" checked={m.showsHUD} onChange={m.setShowsHUD} />
        <SettingsCheck label="Preview playback" checked={m.previewActive} onChange={m.setPreviewActive} />
        <SettingsCheck label="Master Live presentation" checked={m.masterLive} onChange={m.setMasterLive} />
      </SettingsSection>
      <SettingsSection title="Scope" icon="shield">
        {[["Engine", "Not connected"], ["Filesystem", "No mutations"], ["Hardware", "Presentation only"]].map(([l, v]) => <SettingsLabeledRow key={l} label={l}><span className="aui-kit-t2 aui-kit-s11">{v}</span></SettingsLabeledRow>)}
      </SettingsSection>
    </SettingsPage>
  );
}

function SettingsWindow({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"appearance" | "workspace" | "behavior">("appearance");
  useEffect(() => { const on = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on); }, [onClose]);
  const tabs = [{ id: "appearance", label: "Appearance", icon: "palette" }, { id: "workspace", label: "Workspace", icon: "rectangle-group" }, { id: "behavior", label: "Behavior", icon: "cursor-motion" }] as const;
  return (
    <div className="animation-mockup-scrim" onClick={onClose}>
      <div className="animation-mockup-settings atlas-settings" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <div className="animation-mockup-settings-tabs" role="tablist">
          {tabs.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} data-active={tab === t.id || undefined} onClick={() => setTab(t.id)}><Sym name={t.icon} size={16} /><span>{t.label}</span></button>)}
          <span className="aui-kit-spacer" /><button type="button" className="aui-kit-plain aui-kit-t3" aria-label="Close settings" onClick={onClose}><Sym name="close-circle" size={16} /></button>
        </div>
        <span className="aui-kit-divider" />
        <div className="animation-mockup-settings-page"><SettingsPanes tab={tab} /></div>
      </div>
    </div>
  );
}

export { Badge as _AtlasBadge, DockingWorkspace as _AtlasDocking, showsStageLabel as _atlasShowsLabel };

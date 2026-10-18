import { useEffect, type ReactNode } from "react";
import { AetherIcon, LinkCard, LinkCardGrid } from "../src/index";
import { sectionID, sectionTab } from "./showcase";
import { demoWindowURL, useDemoWindowLauncher } from "./DemoWindowLauncher";
import "./WorkspaceDemos.css";

export const WORKSPACE_SECTION = "Workspaces — launchable concepts";
export const LEGACY_WORKSPACE_SECTIONS = [
  "Style properties — live preview", "Layout presets — docked, floating, canvas",
  "Workspace shell — document bar, sidebars, floating panels, layout presets",
  "CAD workspace shell — tabbed ribbon and workspace selector", "Resizable workspace + bottom panel",
  "Application home — coming soon",
];
/** Every composed surface has an independently reviewable home in the gallery. */
export const WORKSPACE_ASSETS = {
  layouts: { label: "Window layouts", section: "Window layouts" },
  sidebars: { label: "Sidebars", section: "Side tool bars" },
  floatingToolbars: { label: "Floating toolbars", section: "Floating toolbars" },
  tree: { label: "Trees", section: "Trees + hierarchies — every variant side by side" },
  forms: { label: "Property forms", section: "Property forms — fields, toggles and pickers in context" },
  appearance: { label: "Appearance", section: "Appearance, materials + visualization — every variant side by side" },
  inspector: { label: "Inspectors", section: "Inspectors + property panels — every variant side by side" },
  fields: { label: "Fields", section: "Number fields" },
  header: { label: "Header chrome", section: "Header chrome — studio mode, workspace windows, appearance" },
  ribbon: { label: "Toolbars", section: "Top tool bars" },
  status: { label: "Status bars", section: "Status bar — every variant side by side" },
  feature: { label: "Feature editors", section: "CAD feature editors" },
  viewport: { label: "Viewport controls", section: "Viewports — transform gizmo, navigation cube, camera chrome, imperative canvas" },
  panels: { label: "Panels", section: "Panels + cards" },
  lists: { label: "Lists", section: "Lists + collections" },
  tables: { label: "Tables", section: "Tables" },
  navigation: { label: "Navigation", section: "Navigation sidebars — in use, and the reference configurations" },
} as const;
export type WorkspaceAssetID = keyof typeof WORKSPACE_ASSETS;

export const WORKSPACE_DEMOS = [
  { id: "app-wireframe", assets: ["layouts", "header", "sidebars", "ribbon", "status"], title: "Standard app layout", icon: "layout", description: "Header, Left, Center, Right and Footer, with consistent size limits and center-only top/bottom toolbars." },
  { id: "general", assets: ["layouts", "navigation", "status"], title: "General interface workspace", icon: "columns", description: "Standard two-column window: left navigation and a main workspace, using the existing resizable Workbench window." },
  { id: "application", assets: ["layouts", "header", "sidebars", "ribbon", "floatingToolbars", "status"], title: "Application workspace", icon: "layout", description: "Standard three-column window: left sidebar, wider center workspace and right sidebar. Toolbars and bottom docks span the center." },
  { id: "sidebars", assets: ["sidebars", "forms", "tree", "appearance", "inspector"], title: "Sidebar workspace", icon: "sidebar", description: "Properties, layer tree, appearance and inspector around a live preview. Try attachment, layout and collapse anchors." },
  { id: "bottom-dock", assets: ["sidebars", "floatingToolbars", "fields"], title: "Bottom dock workspace", icon: "tray", description: "A resizable Timeline and Surfaces dock spanning the center column, with floating, docked and canvas layouts." },
  { id: "layout", assets: ["header", "ribbon", "sidebars", "tree", "forms", "status"], title: "Layout workspace", icon: "layout", description: "Document controls, ribbon, sidebars and status bar. Switch between docked, floating and hidden chrome." },
  { id: "cad", assets: ["header", "ribbon", "sidebars", "tree", "feature", "viewport", "status"], title: "CAD workspace", icon: "cube", description: "A ribbon, feature tree and interactive sample part. Inspect the view cube and Extrude editor." },
  { id: "resizable", assets: ["panels", "tree", "tables", "lists"], title: "Resizable workspace", icon: "columns", description: "Resize and collapse the navigator; switch the bottom panel between problems, history and console." },
  { id: "properties", assets: ["inspector", "sidebars"], title: "Properties workspace", icon: "sliders", description: "Style a live shape with the inspector. Change dimensions, fill, border and shadow." },
  { id: "docking", assets: ["panels", "fields"], title: "Floating panel workspace", icon: "mode-floating", description: "The alternative docking layout with separate browser and inspector panels filling the window." },
  { id: "home", assets: ["navigation", "header", "panels"], title: "Application home", icon: "home", description: "Application identity and navigation, presented at the actual window size." },
] as const;
export type WorkspaceDemoID = typeof WORKSPACE_DEMOS[number]["id"];
export function workspaceDemoURL(id: WorkspaceDemoID) {
  const url = new URL(window.location.href);
  url.search = new URLSearchParams({ demo: "workspace", workspace: id }).toString();
  url.hash = "";
  return url.href;
}

export function workspaceAssetURL(id: WorkspaceAssetID) {
  const section = WORKSPACE_ASSETS[id].section;
  const tab = sectionTab(section);
  if (!tab) throw new Error(`Workspace asset is missing its showcase section: ${id}`);
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = new URLSearchParams({ tab, section: sectionID(section) }).toString();
  return url.href;
}

/** Composition only: never introduce a widget or variant on this page. */
export function WorkspaceDemoDirectory() {
  const { launch, feedback } = useDemoWindowLauncher();
  return <div className="workspace-demo-directory demo-launch-directory">
    <p>Full-size workspaces built from Aether UI. Each opens in its own resizable app window.</p>
    <LinkCardGrid ariaLabel="Workspace concepts">
      {WORKSPACE_DEMOS.map(demo => <LinkCard key={demo.id} icon={<AetherIcon name={demo.icon} width={36} height={36} />}
        title={demo.title} description={demo.description} action="Open workspace window"
        onSelect={() => launch({ id: `workspace-${demo.id}`, title: demo.title, url: demoWindowURL(workspaceDemoURL(demo.id)) })} />)}
    </LinkCardGrid>
    {feedback}
  </div>;
}

/** This route fills the browser window; it is never mounted inside a specimen. */
export function WorkspaceDemoWindow({ id, children }: { id: WorkspaceDemoID; children: ReactNode }) {
  const demo = WORKSPACE_DEMOS.find(item => item.id === id)!;
  useEffect(() => { document.title = `${demo.title} · Aether UI`; }, [demo.title]);
  return <main className="workspace-demo-window" aria-label={demo.title}>
    <div className="workspace-demo-window-content">{children}</div>
  </main>;
}

/**
 * The showcase's top-level tabs — Home, then from atoms to applications — and which
 * gallery section files under each. One table drives the tab strip, the
 * category tray and review-page routing, so a section can never be orphaned —
 * src/showcase-tabs.test.tsx checks every <Section> in main.tsx is here once.
 *
 * Related design families can share one review page. Each section presents
 * its assets side by side, each with a
 * one-line caption naming its source. Imported demo specimens file under the
 * same sections as the Aether UI widgets of their kind
 * (gallery/showcase/inventory.ts maps them). Embedded product collections live under Widgets, grouped by application.
 * App demos contains links to standalone demo workspaces only.
 */
export type ShowcaseTabID = "home" | "elements" | "widgets" | "windows" | "apps" | "icons";

export interface ShowcaseGroup { id: string; label: string; description?: string; sections: readonly string[]; reviewTogether?: boolean }

/** Navigation glyph per section (shared system icons); groups fall back to GROUP_ICONS. */
const SECTION_ICONS: Readonly<Record<string, string>> = {
  "Window layouts": "layout", "Home": "home", "Buttons": "button", "Icon buttons": "cursor", "Text fields": "text-cursor", "Number fields": "ruler", "Select fields": "chevron-down",
  "Search fields": "search", "Checkboxes": "check", "Radio buttons": "dot-circle", "Segmented controls": "columns", "Sliders": "slider",
  "Color fields": "palette", "File fields": "file-generic", "Tabs": "windows", "Breadcrumbs": "arrow-turn-right", "Tooltips": "info",
  "Status indicators": "status-ok", "Empty + error states": "status-error", "Menus": "menu", "Command palettes": "commands",
  "Top tool bars": "tools", "Center tray tool bar": "tray", "Lists + collections": "list", "Tables": "rows", "Node graphs": "nodes",
  "Flow diagrams": "relationships", "Dashboards + analytics": "dashboard", "Assistant + agent panels": "advisor", "Hardware + safety": "hardware",
};
const GROUP_ICONS: Readonly<Record<string, string>> = {
  menus: "menu", toolbars: "tools", lists: "list-tree", tables: "rows", forms: "sliders-panel", appearance: "palette", editors: "timeline",
  panels: "layout", pdm: "branch", cad: "cube", io: "cpu", standards: "layout", "app-windows": "window", "floating-windows": "mode-floating",
  "dialogs-overlays": "windows", notifications: "bell", "in-context": "screen-play", headers: "layout", sidebars: "sidebar",
  navigation: "sidebar", status: "status-ok", layouts: "mode-docked", workspaces: "screen-play", viewports: "view", standalone: "apps", icons: "star",
};
export const sectionIcon = (title: string, groupID: string) => SECTION_ICONS[title] ?? GROUP_ICONS[groupID] ?? "circle";
export interface ShowcaseTab { id: ShowcaseTabID; label: string; sections: readonly string[]; groups: readonly ShowcaseGroup[]; grouped: boolean }
type TabDefinition = { id: ShowcaseTabID; label: string } & ({ sections: readonly string[]; groups?: never } | { groups: readonly ShowcaseGroup[]; sections?: never });

/** The forms that used to sit on the Elements tab: elements composed in context. */
export const PROPERTY_FORMS = "Property forms — fields, toggles and pickers in context";

// Jonathan, 2026-10-13: Elements are single components (a button, a slider,
// a tab) with their allowed variations — the parts widgets are made of.
// Widgets compose elements but never fill a window; anything that fills a
// window opens from Apps as a separate window. Widgets are never
// embedded inside a mock workspace in their showcase. Jonathan, 2026-10-14: navigation bars, sidebars and toolbars are
// categories in that same tab. Widgets lead with shared categories, then
// app-specific ones, and show each widget independently.
const TAB_DEFINITIONS: readonly TabDefinition[] = [
  { id: "home", label: "Home", sections: ["Home"] },
  {
    id: "elements", label: "Elements",
    groups: [
      { id: "buttons", label: "Buttons", description: "Commands as single controls.", sections: ["Buttons", "Icon buttons"] },
      { id: "input", label: "Text & input", description: "Fields that take typed values.", sections: ["Text fields", "Password fields", "Number fields", "Select fields", "Search fields"] },
      { id: "selection", label: "Selection", description: "Controls that choose between values.", sections: ["Checkboxes", "Radio buttons", "Segmented controls", "Sliders", "Color fields", "Material swatches", "File fields", "Choice cards"] },
      { id: "navigation", label: "Navigation", description: "Moving between views and places.", sections: ["Tabs", "Breadcrumbs", "Settings rows"] },
      { id: "feedback", label: "Feedback", description: "Status, hints and empty or failed states.", sections: ["Tooltips", "Status indicators", "Empty + error states", "Avatars", "Structure steps", "Chart legends", "Status badges"] },
    ],
  },
  {
    id: "widgets", label: "Widgets",
    groups: [
      { id: "menus", label: "Menus & commands", description: "Commands and navigation built from buttons and lists.", sections: ["Menus", "Command palettes"] },
      { id: "lists", label: "Lists & trees", reviewTogether: true, description: "Compare flat lists, selectable rows and nested trees together in one showcase.", sections: [
        "Lists + collections", "Trees + hierarchies — every variant side by side",
      ] },
      { id: "tables", label: "Tables", description: "Structured data with columns, sorting and editing.", sections: ["Tables"] },
      { id: "forms", label: "Forms & inspectors", description: "Elements composed into property rows, forms and inspectors.", sections: [
        PROPERTY_FORMS, "Inspectors + property panels — every variant side by side", "Workflow widgets — forms, lists and account controls",
      ] },
      { id: "appearance", label: "Color & appearance", description: "Palettes, materials and visualization controls.", sections: ["Appearance, materials + visualization — every variant side by side", "Media preview"] },
      { id: "editors", label: "Editors", description: "Time-based and connected editing surfaces.", sections: ["Timelines — every variant side by side", "Node graphs", "Flow diagrams"] },
      { id: "panels", label: "Panels & cards", description: "Self-contained panels and cards.", sections: [
        "Panels + cards", "Dashboards + analytics", "Analytics charts + rankings", "Assistant + agent panels", "Hardware + safety",
      ] },
      { id: "pdm", label: "PDM & collaboration", description: "Document branches, versions, releases and collaboration.", sections: ["Revision trees + branches", "Document history + collaboration"] },
      { id: "cad", label: "Aether CAD", description: "CAD-specific widgets: document lists, sketches and feature editors hosted by shared overlay containers.", sections: [
        "CAD feature editors",
        "CAD document list", "Dimensioned sketches",
      ] },
      { id: "io", label: "Aether IO", description: "Electronics controls and instrument widgets.", sections: ["Electronics + instruments"] },
    ],
  },
  {
    id: "windows", label: "Overlays",
    groups: [
      { id: "standards", label: "Container standards", description: "Reusable containers with consistent behavior. Apps supply the widgets and elements inside them.", sections: ["Overlay containers — standards"] },
      { id: "window-layouts", label: "Window layouts", description: "Compare the standard two-column general interface and three-column application workspace together.", sections: ["Window layouts"] },
      { id: "headers", label: "Header bars", reviewTogether: true, description: "Compare application headers, navigation concepts and shared header controls together.", sections: [
        "App header bars", "Concept app header", "Collapsible navigation header", "Top app navigation", "Header chrome — studio mode, workspace windows, appearance",
      ] },
      { id: "navigation", label: "Navigation bars", reviewTogether: true, description: "Compare application navigation, document tabs and dashboard navigation together.", sections: [
        "Navigation sidebars — in use, and the reference configurations",
        "Document tabs", "Dashboard navigation",
      ] },
      { id: "sidebars", label: "Sidebars", reviewTogether: true, description: "Containers sized for the left and right columns. Each tab can host different widgets and elements.", sections: [
        "Side tool bars", "Rail + Dock panel + Tree",
      ] },
      { id: "toolbars", label: "Toolbars", reviewTogether: true, description: "Compare every toolbar design together: floating command and document bars, ribbons, center trays, bottom docks and tool rails.", sections: [
        "Floating toolbars", "Top tool bars", "Center tray tool bar", "Tool rails",
      ] },
      { id: "status", label: "Status bars", description: "Application identity, connection status and workspace feedback.", sections: ["Status bar — every variant side by side"] },
      { id: "app-windows", label: "Application windows", description: "Shared window frames and navigation with app-supplied settings or information.", sections: [
        "Settings window — universal per-app settings (macOS anatomy)",
      ] },
      { id: "floating-windows", label: "Floating windows", description: "Shared floating and editing containers. Their content can be a feature editor, property form or information widget.", sections: ["Floating + detached windows"] },
      { id: "dialogs-overlays", label: "Dialogs & popovers", reviewTogether: true, description: "Dialogs, alerts, popovers and progress windows, open together for comparison.", sections: ["Dialogs + alerts", "Popovers", "Progress overlay"] },
      { id: "notifications", label: "Notifications", description: "Transient messages and persistent notification history.", sections: ["Toasts + notification history"] },
      { id: "viewports", label: "Viewports & guidance", description: "Canvas chrome and onboarding.", sections: [
        "Viewports — transform gizmo, navigation cube, camera chrome, imperative canvas", "Workspace navigator + walkthrough",
      ] },
    ],
  },
  {
    id: "apps", label: "Apps",
    groups: [
      { id: "standalone", label: "Demo apps & windows", reviewTogether: true, description: "All demo applications and workspace windows, together on one launch page.", sections: ["Concept applications — launchable demos", "Workspaces — launchable concepts"] },
    ],
  },
  {
    id: "icons", label: "Icons & Assets",
    sections: [
      "System icons — one glyph pack for every Aether Studio app", "App tool packs — illustrated tool icons, switchable per app",
      "Application icons — core/assets/branding", "Application header logos", "Themes — the theme pack",
    ],
  },
];

/** A single hierarchy drives category navigation and the canonical section inventory. */
export const SHOWCASE_TABS: readonly ShowcaseTab[] = TAB_DEFINITIONS.map(tab => {
  const groups = tab.groups ?? [{ id: tab.id, label: tab.label, sections: tab.sections }];
  return { ...tab, groups, grouped: Boolean(tab.groups), sections: groups.flatMap(group => [...group.sections]) };
});

/** Related design families share a review page. Explicit collection members stay focused. */
export const comparisonGroup = (tab: ShowcaseTabID, section: string, individual = false) => individual ? undefined
  : SHOWCASE_TABS.find(item => item.id === tab)?.groups.find(group => group.reviewTogether && group.sections.includes(section));

const SECTION_LABELS: Readonly<Record<string, string>> = {
  [PROPERTY_FORMS]: "Property forms",
  "CAD feature editors": "Feature editors",
  "Menus": "Dropdown, context & radial menus", "Top tool bars": "Ribbons",
  "Side tool bars": "Sidebars", "Center tray tool bar": "Center trays",
  "Lists + collections": "Flat lists & collections", "Tables": "Data tables",
};
export const sectionLabel = (title: string) => SECTION_LABELS[title] ?? title.split(" — ")[0];
export const sectionID = (title: string) => `showcase-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")}`;

const BY_TITLE = new Map(SHOWCASE_TABS.flatMap((tab) => tab.sections.map((title) => [title, tab.id] as const)));

/** The tab a section files under; undefined means the table forgot it. */
export const sectionTab = (title: string): ShowcaseTabID | undefined => BY_TITLE.get(title);

export const isShowcaseTab = (id: string | null): id is ShowcaseTabID => SHOWCASE_TABS.some((tab) => tab.id === id);

/** Keep saved links to relocated demo libraries useful without restoring app tabs. */
export function legacyShowcaseLocation(search: string, pathname: string): string | null {
  const params = new URLSearchParams(search);
  return ["uiKit", "ui-dev"].includes(params.get("ws") ?? "") && ["animation-studio", "animation-mockup", "atlas-demo"].includes(params.get("demo") ?? "")
    ? `${pathname}#tab=widgets` : null;
}

import type { ShowcaseTabID } from "../showcase";
import { sectionTab } from "../showcase";

/** Retained pre-move source inventory; variants from different demos remain distinct. */
export const importedKitInventory: readonly {source:string;section:string;tab:ShowcaseTabID;specimens:readonly string[]}[] = [
  {
    "source": "kit",
    "section": "Buttons & Pills",
    "tab": "elements",
    "specimens": [
      "Pill · active, idle, tints",
      "Stage chips"
    ]
  },
  {
    "source": "kit",
    "section": "Rows & Fields",
    "tab": "widgets",
    "specimens": [
      "Row · plain and selected + controls",
      "Fields"
    ]
  },
  {
    "source": "kit",
    "section": "Panels & Toolbars",
    "tab": "widgets",
    "specimens": [
      "Panel"
    ]
  },
  {
    "source": "kit",
    "section": "Contextual Widgets",
    "tab": "widgets",
    "specimens": [
      "Mate inspector",
      "Curve card",
      "Environment",
      "Performance HUD",
      "System status"
    ]
  },
  {
    "source": "kit",
    "section": "Timeline & Graph",
    "tab": "widgets",
    "specimens": [
      "Dope-sheet timeline · full width",
      "Graph node",
      "Servo track"
    ]
  },
  {
    "source": "kit",
    "section": "Panels & Lists",
    "tab": "widgets",
    "specimens": [
      "Panel card · icon badge + subtitle + menu",
      "List rows · states",
      "Panel actions"
    ]
  },
  {
    "source": "kit",
    "section": "Visualization",
    "tab": "widgets",
    "specimens": [
      "Material spheres",
      "Visualization icon",
      "Visualization panel"
    ]
  },
  {
    "source": "kit",
    "section": "Node Graph",
    "tab": "widgets",
    "specimens": [
      "Logic nodes · types and states",
      "Node library",
      "Feature timeline",
      "Document tabs · floating pill"
    ]
  },
  {
    "source": "kit",
    "section": "Inputs",
    "tab": "elements",
    "specimens": [
      "Search field",
      "Stepper field",
      "Inspector tabs",
      "View cube",
      "Axis gizmo"
    ]
  },
  {
    "source": "kit",
    "section": "Dialogs, Inspectors & Feedback",
    "tab": "windows",
    "specimens": [
      "Property fields",
      "Command buttons",
      "Notification card",
      "Document tabs",
      "Mate dialog"
    ]
  },
  {
    "source": "kit",
    "section": "Overlays & Shapes",
    "tab": "icons",
    "specimens": [
      "Radial menu",
      "Shapes",
      "Color tokens"
    ]
  },
  {
    "source": "kit",
    "section": "Viewport",
    "tab": "windows",
    "specimens": [
      "Viewport mock",
      "Perspective grid"
    ]
  },
  {
    "source": "kit",
    "section": "Kit Widgets · ready for use",
    "tab": "elements",
    "specimens": [
      "Badges",
      "Metric card",
      "Labeled slider",
      "Segmented icons",
      "Chip picker",
      "Toast",
      "Callout",
      "Toggle row",
      "Progress card · busy state",
      "Progress bar"
    ]
  },
  {
    "source": "kit",
    "section": "Chrome",
    "tab": "windows",
    "specimens": [
      "Status bar"
    ]
  },
  {
    "source": "kit",
    "section": "Rex · Home, Assets and Hardware",
    "tab": "apps",
    "specimens": [
      "Recent project cards",
      "Import stat chips",
      "Controller identity",
      "Calibration range · map range with µs markers"
    ]
  },
  {
    "source": "kit",
    "section": "CodexUI · Viewport",
    "tab": "windows",
    "specimens": [
      "Robot mock viewport · mode pill, mini cube, camera chrome, stage frame"
    ]
  },
  {
    "source": "kit",
    "section": "CodexUI · Node canvas",
    "tab": "widgets",
    "specimens": [
      "Connected behavior graph, canvas status, zoom, and auto layout",
      "Typed ports"
    ]
  },
  {
    "source": "kit",
    "section": "CodexUI · Timelines",
    "tab": "widgets",
    "specimens": [
      "Live Follow dope sheet · keys + audio lane",
      "Show sequence · multi-media cue blocks"
    ]
  },
  {
    "source": "kit",
    "section": "CodexUI · Contextual animatronic widgets",
    "tab": "widgets",
    "specimens": [
      "Mate connectors + pose sliders",
      "Live hardware output",
      "Safety state · authoritative device layer",
      "Channel mapping · semantic motion → physical output"
    ]
  },
  {
    "source": "kit",
    "section": "CodexUI · Chrome",
    "tab": "windows",
    "specimens": [
      "Centered workspace navigator · authoring | utilities, label modes",
      "Guided workspace walkthrough",
      "Drop zone · load 3D assembly",
      "Theme tiles",
      "Inspector tabs with icons"
    ]
  },
  {
    "source": "atlas",
    "section": "Buttons & Controls",
    "tab": "elements",
    "specimens": [
      "Buttons, pills, and states",
      "Interactive input controls",
      "Document and inspector tabs"
    ]
  },
  {
    "source": "atlas",
    "section": "Rows & Fields",
    "tab": "widgets",
    "specimens": [
      "Hierarchy rows and states",
      "Numeric property inspector"
    ]
  },
  {
    "source": "atlas",
    "section": "Panels & Dialogs",
    "tab": "windows",
    "specimens": [
      "Mate authoring dialog",
      "Non-blocking notification",
      "Panel anatomy"
    ]
  },
  {
    "source": "atlas",
    "section": "Appearance & Layout",
    "tab": "icons",
    "specimens": [
      "Material controls",
      "Theme color tokens",
      "Live shell layout contract"
    ]
  },
  {
    "source": "atlas",
    "section": "App Chrome",
    "tab": "windows",
    "specimens": [
      "Centered workspace navigator"
    ]
  },
  {
    "source": "atlas",
    "section": "Contextual Animatronic Widgets",
    "tab": "widgets",
    "specimens": [
      "Hierarchy, mate, and hardware stack"
    ]
  },
  {
    "source": "atlas",
    "section": "Nodes",
    "tab": "widgets",
    "specimens": [
      "Node types and selection states",
      "Searchable categorized node library",
      "Selected-node inspector and typed ports"
    ]
  },
  {
    "source": "atlas",
    "section": "Node Canvas",
    "tab": "widgets",
    "specimens": [
      "Connected behavior graph, canvas status, zoom, and auto layout"
    ]
  },
  {
    "source": "atlas",
    "section": "Diagnostics & Status",
    "tab": "elements",
    "specimens": [
      "Viewport performance HUD",
      "Metric card",
      "Command icon button states"
    ]
  },
  {
    "source": "atlas",
    "section": "Timelines",
    "tab": "widgets",
    "specimens": [
      "Production dope-sheet timeline",
      "Full-width Live Follow timeline",
      "Show sequence"
    ]
  },
  {
    "source": "atlas",
    "section": "Viewport",
    "tab": "windows",
    "specimens": [
      "Viewport mock with selection and camera chrome"
    ]
  },
  {
    "source": "atlas",
    "section": "Settings",
    "tab": "windows",
    "specimens": [
      "Native appearance, layout, and behavior settings"
    ]
  },
  {
    "source": "atlas",
    "section": "Hardware",
    "tab": "widgets",
    "specimens": [
      "Channel mapping"
    ]
  },
  {
    "source": "atlas",
    "section": "Coverage",
    "tab": "apps",
    "specimens": [
      "Reusable component coverage"
    ]
  }
];


// ---------------------------------------------------------------------------
// Where every imported specimen files. Keyed by SECTION, not tab: a demo's
// toolbar sits in the toolbar section next to the Aether UI ribbons, its
// dialog in the dialog section, and so on (dev/docs/roadmap/Aether_UI_Showcase_Refinement.md).

export const SECTION = {
  buttons: "Buttons", tabs: "Tabs", text: "Text fields", toggles: "Property forms — fields, toggles and pickers in context",
  search: "Search fields", indicators: "Status indicators",
  ribbons: "Top tool bars", toolRails: "Tool rails", sideBars: "Side tool bars", tray: "Center tray tool bar", trees: "Trees + hierarchies — every variant side by side",
  tabular: "Tables", lists: "Lists + collections", inspectors: "Inspectors + property panels — every variant side by side",
  appearance: "Appearance, materials + visualization — every variant side by side", timelines: "Timelines — every variant side by side",
  nodes: "Node graphs", hardware: "Hardware + safety", panels: "Panels + cards", agent: "Assistant + agent panels", menus: "Menus",
  settings: "Settings window — universal per-app settings (macOS anatomy)", dialogs: "Dialogs + alerts", popovers: "Popovers",
  toasts: "Toasts + notification history", floating: "Floating + detached windows",
  header: "Header chrome — studio mode, workspace windows, appearance", navigator: "Workspace navigator + walkthrough",
  rail: "Rail + Dock panel + Tree", documentTabs: "Document tabs", layouts: "Window layouts",
  viewports: "Viewports — transform gizmo, navigation cube, camera chrome, imperative canvas", statusBar: "Status bar — every variant side by side",
  tokens: "Themes — the theme pack",
} as const;

/** Default section per kit group, per source. */
const KIT_GROUP_SECTION: Readonly<Record<string, string>> = {
  "kit:Buttons & Pills": SECTION.buttons, "kit:Rows & Fields": SECTION.lists, "kit:Panels & Toolbars": SECTION.ribbons, "kit:Contextual Widgets": SECTION.inspectors,
  "kit:Timeline & Graph": SECTION.timelines, "kit:Panels & Lists": SECTION.trees, "kit:Visualization": SECTION.appearance, "kit:Node Graph": SECTION.nodes,
  "kit:Inputs": SECTION.text, "kit:Dialogs, Inspectors & Feedback": SECTION.dialogs, "kit:Overlays & Shapes": SECTION.tokens, "kit:Viewport": SECTION.viewports,
  "kit:Kit Widgets · ready for use": SECTION.indicators, "kit:Chrome": SECTION.statusBar, "kit:Rex · Toolbars": SECTION.ribbons,
  "kit:Rex · Home, Assets and Hardware": SECTION.panels, "kit:CodexUI · Viewport": SECTION.viewports, "kit:CodexUI · Node canvas": SECTION.nodes,
  "kit:CodexUI · Timelines": SECTION.timelines, "kit:CodexUI · Contextual animatronic widgets": SECTION.hardware, "kit:CodexUI · Chrome": SECTION.navigator,
  "atlas:Buttons & Controls": SECTION.buttons, "atlas:Rows & Fields": SECTION.trees, "atlas:Panels & Dialogs": SECTION.dialogs, "atlas:Appearance & Layout": SECTION.appearance,
  "atlas:App Chrome": SECTION.navigator, "atlas:Contextual Animatronic Widgets": SECTION.trees, "atlas:Nodes": SECTION.nodes, "atlas:Node Canvas": SECTION.nodes,
  "atlas:Diagnostics & Status": SECTION.indicators, "atlas:Timelines": SECTION.timelines, "atlas:Viewport": SECTION.viewports, "atlas:Settings": SECTION.settings,
  "atlas:Hardware": SECTION.hardware, "atlas:Coverage": SECTION.panels,
};

/** Specimens that belong somewhere other than their group's default. */
const KIT_SPECIMEN_SECTION: Readonly<Record<string, string>> = {
  "kit:List rows · states": SECTION.lists,
  "kit:Panel card · icon badge + subtitle + menu": SECTION.floating,
  "kit:Stage chips": SECTION.tabs, "kit:Fields": SECTION.text, "kit:Panel": SECTION.floating,
  "kit:Curve card": SECTION.timelines, "kit:Environment": SECTION.appearance, "kit:Performance HUD": SECTION.viewports, "kit:System status": SECTION.hardware,
  "kit:Graph node": SECTION.nodes, "kit:Servo track": SECTION.timelines, "kit:Panel actions": SECTION.panels,
  "kit:Feature timeline": SECTION.timelines, "kit:Document tabs · floating pill": SECTION.documentTabs,
  "kit:Search field": SECTION.search, "kit:Inspector tabs": SECTION.tabs, "kit:View cube": SECTION.viewports, "kit:Axis gizmo": SECTION.viewports,
  "kit:Property fields": SECTION.inspectors, "kit:Command buttons": SECTION.buttons, "kit:Document tabs": SECTION.documentTabs, "kit:Notification card": SECTION.toasts,
  "kit:Radial menu": SECTION.menus,
  "kit:Labeled slider": SECTION.toggles, "kit:Segmented icons": SECTION.toggles, "kit:Chip picker": SECTION.toggles,
  "kit:Toast": SECTION.toasts, "kit:Toggle row": SECTION.toggles,
  "kit:Import stat chips": SECTION.indicators, "kit:Controller identity": SECTION.hardware, "kit:Calibration range · map range with µs markers": SECTION.toggles,
  "kit:Mate connectors + pose sliders": SECTION.inspectors,
  "kit:Drop zone · load 3D assembly": SECTION.panels, "kit:Theme tiles": SECTION.appearance, "kit:Inspector tabs with icons": SECTION.tabs,
  "atlas:Interactive input controls": SECTION.toggles, "atlas:Document and inspector tabs": SECTION.tabs, "atlas:Numeric property inspector": SECTION.inspectors,
  "atlas:Panel anatomy": SECTION.floating, "atlas:Theme color tokens": SECTION.tokens, "atlas:Live shell layout contract": SECTION.panels,
  
  "atlas:Viewport performance HUD": SECTION.viewports, "atlas:Command icon button states": SECTION.buttons,
};

/** The section one kit specimen files under. Labels are the specimen captions in KitSpecimens/AtlasKit. */
export function kitSpecimenSection(source: "kit" | "atlas", group: string, label: string): string {
  const byLabel = KIT_SPECIMEN_SECTION[`${source}:${label}`] ?? KIT_SPECIMEN_SECTION[`${source}:${label.split(" · ")[0]}`];
  const section = byLabel ?? KIT_GROUP_SECTION[`${source}:${group}`];
  if (!section) throw new Error(`inventory.ts: no section for ${source} "${group}" › "${label}"`);
  return section;
}

/**
 * Mode and data duplicates hidden from the showcase (Jonathan, 2026-09-24:
 * "one import per widget — I can flip modes directly"). Key → the instance
 * that stays. Nothing is deleted: the kits, templates and variant board are
 * whole in the native UI Dev browser (`?demo=ui-dev`), and the key's section
 * mapping below is unchanged, so un-hiding is one line.
 */
export const MODE_DUPLICATES: Readonly<Record<string, string>> = {
  // Aether kit
  "kit:Dope-sheet timeline · full width": "Timelines › animation-studio DopeSheetTimeline (one instance: keys, audio lane, badge, transport)",
  "kit:Live Follow dope sheet · keys + audio lane": "Timelines › animation-studio DopeSheetTimeline",
  "kit:Status bar": "Status bar › animation-studio StatusBar",
  "kit:Inspector tabs": "Tabs › Inspector tabs with icons (same widget, icons on)",
  "kit:Command buttons": "Tabs › Selection rail and adaptive actions (CommandButton in use) · Buttons keep the atlas states row",
  // Atlas kit — same kit component, same data as a kit row
  "atlas:Connected behavior graph, canvas status, zoom, and auto layout": "kit:Connected behavior graph, canvas status, zoom, and auto layout",
  "atlas:Production dope-sheet timeline": "Timelines › animation-studio DopeSheetTimeline",
  "atlas:Full-width Live Follow timeline": "Timelines › animation-studio DopeSheetTimeline",
  "atlas:Show sequence": "kit:Show sequence · multi-media cue blocks",
  "atlas:Channel mapping": "kit:Channel mapping · semantic motion → physical output",
  "atlas:Viewport mock with selection and camera chrome": "kit:Robot mock viewport · mode pill, mini cube, camera chrome, stage frame",
  "atlas:Viewport performance HUD": "kit:Performance HUD",
  "atlas:Metric card": "kit:Metric card",
  "atlas:Centered workspace navigator": "kit:Centered workspace navigator · authoring | utilities, label modes (has the label-mode switch)",
  "atlas:Document and inspector tabs": "kit:Document tabs + Inspector tabs with icons",
  "atlas:Node types and selection states": "kit:Logic nodes · types and states",
  "atlas:Command icon button states": "kit:Selection rail and adaptive actions (CommandButton)",
  "atlas:Hierarchy rows and states": "kit:List rows · states",
  "atlas:Numeric property inspector": "kit:Fields",
  "atlas:Mate authoring dialog": "kit:Mate dialog",
  "atlas:Non-blocking notification": "kit:Notification card",
  "atlas:Panel anatomy": "kit:Panel card · icon badge + subtitle + menu",
  "atlas:Theme color tokens": "kit:Color tokens",
  "atlas:Hierarchy, mate, and hardware stack": "kit:List rows · states + Live hardware output + Fields",
  "atlas:Reusable component coverage": "not a widget — the list is in WIDGETS.md and the Atlas app's UI Kit",
  // Native templates that re-render another template or a flat widget in another mode
  "template:viewport-controls": "template:workspace-3d (same Workspace3DSpecimen)",
  "template:triad-manipulator": "template:workspace-3d (same specimen, triad on)",
  "template:animation-timeline": "Timelines › @aether/ui Timeline",
  "template:show-timeline": "Timelines › @aether/ui Timeline",
  "template:document-tab-strip": "Document tabs › @aether/ui DocumentTabs",
  "template:action-buttons": "Buttons › @aether/ui Button",
  "template:input-fields": "Text fields / Property forms › the same @aether/ui fields",
  "template:navigator": "Trees + hierarchies › @aether/ui Tree",
  "template:confirmation": "template:alert (same DialogSpecimen, confirmation on)",
  // Native state variants: every one re-renders a template or a flat widget in a state; the board stays whole in ?demo=ui-dev
  "variant:documentChrome": "template:production-chrome", "variant:workspaceRibbon": "template:production-chrome + floating-ribbon", "variant:compactWorkspaceChrome": "template:production-chrome",
  "variant:navigatorEmpty": "template:empty-state", "variant:navigatorHierarchy": "Trees + hierarchies › @aether/ui Tree", "variant:agentDocked": "template:agent",
  "variant:componentInspector": "template:component-inspector", "variant:mateInspector": "template:mate-editor", "variant:appearanceInspector": "template:appearance-inspector", "variant:hardwareInspector": "template:hardware-panel",
  "variant:dopeSheetTimeline": "template:timeline-design-b (SequenceEditor flips its own modes)", "variant:motionCurveTimeline": "template:timeline-design-b", "variant:showControlTimeline": "template:timeline-design-b", "variant:emptyTimeline": "template:timeline-design-b",
  // Toolbar states remain visible together for design review (Jonathan, 2026-10-15).
  "variant:informationDialog": "template:alert", "variant:confirmationDialog": "template:alert", "variant:graphicsPopover": "template:popover", "variant:componentContextMenu": "template:context-menu",
  "variant:emptyWorkspace": "template:empty-state", "variant:processingStatus": "template:progress-and-status", "variant:connectedStatus": "template:progress-and-status", "variant:emergencyStatus": "template:progress-and-status",
};
export const isModeDuplicate = (key: string) => Boolean(MODE_DUPLICATES[key]);

/** The 36 native UI Dev templates (UIDevWorkspace) by section. */
export const nativeTemplateSections: Readonly<Record<string, string>> = {
  "production-chrome": SECTION.header, "workspace-layouts": SECTION.layouts, "recent-projects": SECTION.panels, "navigator": SECTION.trees, "workspace-3d": SECTION.viewports,
  "agent": SECTION.agent, "document-tab-strip": SECTION.documentTabs, "animation-timeline": SECTION.timelines, "show-timeline": SECTION.timelines, "timeline-design-b": SECTION.timelines,
  "component-inspector": SECTION.inspectors, "appearance-inspector": SECTION.appearance, "material-editor": SECTION.appearance, "visualization-panel": SECTION.appearance,
  "mate-editor": SECTION.inspectors, "triad-manipulator": SECTION.viewports, "layered-icon-list": SECTION.trees, "hardware-panel": SECTION.hardware,
  "floating-tool": SECTION.floating, "floating-ribbon": SECTION.ribbons, "alert": SECTION.dialogs, "confirmation": SECTION.dialogs, "popover": SECTION.popovers, "context-menu": SECTION.menus,
  "notification-popup": SECTION.toasts, "model-import-staging": SECTION.dialogs, "action-buttons": SECTION.buttons, "input-fields": SECTION.text, "viewport-controls": SECTION.viewports,
  "layout-style-controls": SECTION.settings, "compact-tab-panel": SECTION.panels, "icon-theme-selector": SECTION.tokens, "empty-state": SECTION.indicators,
  "progress-and-status": SECTION.indicators, "concept-template-cards": SECTION.panels,
};

/** The 26 native state variants (NativeVariantCatalog) by section. */
export const nativeVariantSections: Readonly<Record<string, string>> = {
  documentChrome: SECTION.header, workspaceRibbon: SECTION.ribbons, compactWorkspaceChrome: SECTION.header,
  navigatorEmpty: SECTION.trees, navigatorHierarchy: SECTION.trees, agentDocked: SECTION.agent,
  componentInspector: SECTION.inspectors, mateInspector: SECTION.inspectors, appearanceInspector: SECTION.appearance, hardwareInspector: SECTION.hardware,
  dopeSheetTimeline: SECTION.timelines, motionCurveTimeline: SECTION.timelines, showControlTimeline: SECTION.timelines, emptyTimeline: SECTION.timelines,
  commandToolbar: SECTION.ribbons, selectionToolbar: SECTION.ribbons, disabledToolbar: SECTION.ribbons, verticalToolRail: SECTION.toolRails,
  informationDialog: SECTION.dialogs, confirmationDialog: SECTION.dialogs, graphicsPopover: SECTION.popovers, componentContextMenu: SECTION.menus,
  emptyWorkspace: SECTION.indicators, processingStatus: SECTION.indicators, connectedStatus: SECTION.indicators, emergencyStatus: SECTION.indicators,
};

/** Kept for the native browser's category tools: the tab each template resolves to via its section. */
export const nativeTemplateTabs: Readonly<Record<string, ShowcaseTabID>> = Object.fromEntries(
  Object.entries(nativeTemplateSections).map(([id, section]) => [id, sectionTab(section) ?? "widgets"]),
);

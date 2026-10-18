/**
 * The showcase home's "What's new" gallery. Newest first; add an entry with
 * each Aether UI release. `link` opens the section the entry describes.
 */
export interface WhatsNewEntry {
  id: string;
  title: string;
  description: string;
  status: "Available" | "Preview" | "Planned";
  /** Shared glyph shown on the card. */
  icon: string;
  color?: string;
  link?: { tab: string; section: string };
}

export const WHATS_NEW: readonly WhatsNewEntry[] = [
  { id: "material-studio", status: "Preview", icon: "cube", title: "Aether Material Studio", description: "A live 3D sculpture concept with independent material, transform, scene and playback widgets.", link: { tab: "apps", section: "Concept applications — launchable demos" } },
  { id: "concept-app-header", status: "Preview", icon: "windows", title: "Concept app header", description: "A slim neutral header with white pill navigation, dropdown pages and compact utility controls.", link: { tab: "windows", section: "Concept app header" } },
  { id: "app-header-bars", status: "Available", icon: "windows", title: "App header bars", description: "The actual CAD, Animation and Map headers, shown independently with workspace selection and the shared user controls.", link: { tab: "windows", section: "App header bars" } },
  { id: "avatar-studio", status: "Available", icon: "person", title: "Aether Avatar Studio", description: "A scene demo composed from the shared floating sidebar and toolbar, with independent media widgets and image export.", link: { tab: "apps", section: "Concept applications — launchable demos" } },
  { id: "top-app-navigation", status: "Available", icon: "layout", title: "Top app navigation", description: "Compact app identity, rounded page buttons and utility actions in the shared header. Try it in Aether Analytics.", link: { tab: "windows", section: "Top app navigation" } },
  { id: "analytics-dashboard", status: "Available", icon: "dashboard", title: "Aether Analytics", description: "A launchable dark dashboard with independent comparison charts, gauges, ranked lists, legends and status badges.", link: { tab: "apps", section: "Concept applications — launchable demos" } },
  { id: "workflow-widgets", status: "Available", icon: "layout", title: "Workflow widgets + Slate themes", description: "Forms, lists, team controls, plans and field mapping, with reusable elements and matching light/dark themes.", link: { tab: "widgets", section: "Workflow widgets — forms, lists and account controls" } },
  { id: "overlay-containers", status: "Available", icon: "windows", color: "#3b6ef5",
    title: "Overlays: shared containers", description: "Sidebars, toolbars, floating panels and popups provide the standard frame and behavior. Apps choose the widgets and elements inside them.",
    link: { tab: "windows", section: "Overlay containers — standards" } },
  { id: "workspace-windows", status: "Available", icon: "screen-play", color: "#3b6ef5",
    title: "Widgets on their own. Workspaces in windows.", description: "Attached and detached sidebars are shown directly, side by side. Open complete concepts from Overlays → Workspaces to try them in a separate window.",
    link: { tab: "windows", section: "Workspaces — launchable concepts" } },
  { id: "floating-toolbars", status: "Available", icon: "tools", color: "#3b6ef5",
    title: "Floating toolbars", description: "The command-and-tools and compact document variants now have their own page. Find navigation bars, sidebars and toolbars together in Overlays.",
    link: { tab: "windows", section: "Floating toolbars" } },
  { id: "showcase-reorganised", status: "Available", icon: "design", color: "#3b6ef5",
    title: "A cleaner showcase", description: "Elements are single components with their allowed variations; widgets are built from them, grouped by shared and app-specific categories.",
    link: { tab: "elements", section: "Buttons" } },
  { id: "document-tabs", status: "Available", icon: "windows", color: "#7c9cbf",
    title: "Document tabs", description: "Browser-style document tabs with an add control, along the bottom or in the header.",
    link: { tab: "windows", section: "Document tabs" } },
  { id: "standard-sidebar", status: "Available", icon: "sidebar", color: "#9fc4b0",
    title: "The standard sidebar", description: "One sidebar for every Aether app: app identity, sections, workspaces, settings, apps and your account.",
    link: { tab: "windows", section: "Navigation sidebars — in use, and the reference configurations" } },
  { id: "mac-style", status: "Preview", icon: "palette", color: "#e8c98a",
    title: "macOS-inspired styling", description: "Soft shaded controls, title-case labels and hairline borders across the suite." },
];

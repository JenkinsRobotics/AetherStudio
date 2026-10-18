import { LEGACY_WORKSPACE_SECTIONS, WORKSPACE_SECTION } from "../WorkspaceDemos";
import { aetherThemes } from "../../src/themes";
import { SHOWCASE_TABS, isShowcaseTab, sectionID, sectionTab, type ShowcaseTabID } from "../showcase";
import { SECTION } from "./inventory";
import { relocatedStudioSections, STUDIO_SPECIMEN_SOURCES } from "./studio-specimen-sections";

export type CollectionKind = "collection" | "app" | "theme";
export interface ShowcaseCollection {
  id: string;
  label: string;
  description: string;
  kind: CollectionKind;
  sections: readonly string[];
  themeId?: string;
  custom?: boolean;
}
export const ALL_SECTIONS = SHOWCASE_TABS.flatMap(tab => [...tab.sections]);
const widgetGroup = (id: string) => SHOWCASE_TABS.find(tab => tab.id === "widgets")!.groups.find(group => group.id === id)!.sections;
const themeSections = [SECTION.buttons, SECTION.text, SECTION.toggles, SECTION.menus, SECTION.inspectors, "Flow diagrams", "Themes — the theme pack"];

/** Collections reference the existing specimens; nothing is copied into a second gallery. */
export const SHOWCASE_COLLECTIONS: readonly ShowcaseCollection[] = [
  { id: "pdm", label: "PDM", description: "Revision trees, branches, versions, releases and document collaboration.", kind: "collection", sections: [...widgetGroup("pdm")] },
  { id: "flow-signals", label: "Flow & signals", description: "Connected editing, moving signals and instrument displays.", kind: "collection", sections: ["Flow diagrams", SECTION.nodes, "Electronics + instruments"] },
  { id: "workspace-patterns", label: "Workspace patterns", description: "Navigation, sidebars and reusable workspace layouts.", kind: "collection", sections: [SECTION.ribbons, SECTION.sideBars, SECTION.tray, WORKSPACE_SECTION] },
  { id: "app-cad", label: "Aether CAD", description: "CAD document lists, dimensioned sketches, feature editors and shared inspection and viewport components.", kind: "app", sections: [...widgetGroup("cad"), SECTION.inspectors, SECTION.appearance, SECTION.viewports] },
  { id: "app-animation", label: "Aether Animation", description: "Timeline, behavior graph and hardware interface specimens.", kind: "app", sections: [SECTION.timelines, SECTION.nodes, SECTION.hardware, SECTION.tray] },
  { id: "app-map", label: "Aether Map", description: "Shared parameter, media presentation and routing components for mapping workspaces.", kind: "app", sections: [SECTION.toggles, SECTION.appearance, "Flow diagrams", SECTION.panels] },
  { id: "app-io", label: "Aether IO", description: "Electronics, connectors and signal presentation.", kind: "app", sections: ["Electronics + instruments", "Flow diagrams", SECTION.hardware] },
  { id: "app-studio", label: "Studio & Drive", description: "Shared application homes, files and document collaboration panels.", kind: "app", sections: ["Revision trees + branches", "Document history + collaboration", WORKSPACE_SECTION, SECTION.lists, SECTION.tabular] },
  ...aetherThemes.map(theme => ({ id: `theme-${theme.id}`, label: theme.name, description: theme.description || "Shared widgets in this theme.", kind: "theme" as const, themeId: theme.id, sections: theme.id === "aether-slate" ? [...themeSections, "Workflow widgets — forms, lists and account controls"] : theme.id === "aether-analytics" ? [...themeSections, "Analytics charts + rankings", "Top app navigation", "Dashboard navigation", "Chart legends", "Status badges"] : themeSections })),
];
export const COLLECTIONS_STORAGE_KEY = "aether-ui-showcase-collections-v1";

export function parseCollections(text: string): ShowcaseCollection[] {
  if (text.length > 100_000) throw new Error("Saved collections are too large.");
  const data = JSON.parse(text);
  if (data?.version !== 1 || !Array.isArray(data.collections) || data.collections.length > 50) throw new Error("Invalid saved collections.");
  const ids = new Set<string>();
  return data.collections.map((item: unknown) => {
    if (!item || typeof item !== "object") throw new Error("Invalid saved collection.");
    const value = item as Record<string, unknown>;
    if (typeof value.id !== "string" || !value.id.startsWith("custom-") || value.id.length > 100 || ids.has(value.id) || typeof value.label !== "string" || !value.label.trim() || value.label.length > 80 || typeof value.description !== "string" || value.description.length > 240 || !["collection", "app", "theme"].includes(value.kind as string) || !Array.isArray(value.sections)) throw new Error("Invalid saved collection.");
    ids.add(value.id);
    const sections = [...new Set(value.sections.flatMap(title => typeof title !== "string" ? [] : LEGACY_WORKSPACE_SECTIONS.includes(title) ? [WORKSPACE_SECTION] : relocatedStudioSections(title)).filter(title => ALL_SECTIONS.includes(title)))];
    if (!sections.length || (value.kind === "theme" && !aetherThemes.some(theme => theme.id === value.themeId))) throw new Error("Saved collection references unavailable content.");
    return { id: value.id, label: value.label.trim(), description: value.description, kind: value.kind as CollectionKind, sections, custom: true, ...(value.kind === "theme" ? { themeId: value.themeId as string } : {}) };
  });
}

export interface ShowcaseLocation { tab: ShowcaseTabID; section: string; collectionId?: string; mode: "light" | "dark" }
export function readShowcaseLocation(hash: string, collections: readonly ShowcaseCollection[]): ShowcaseLocation {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const requestedTab = params.get("tab");
  const tab = requestedTab === "chrome" ? "windows" : isShowcaseTab(requestedTab) ? requestedTab : "home";
  const collection = collections.find(item => item.id === params.get("collection"));
  // Section identity survives moves between tabs. Saved collections still
  // restrict navigation to their own members.
  const candidates = collection?.sections ?? ALL_SECTIONS;
  const fallback = collection?.sections[0] ?? SHOWCASE_TABS.find(item => item.id === tab)!.sections[0];
  const studioSource = STUDIO_SPECIMEN_SOURCES.find(source => sectionID(source.oldSection) === params.get("section"));
  const requestedSection = LEGACY_WORKSPACE_SECTIONS.some(title => sectionID(title) === params.get("section")) ? sectionID(WORKSPACE_SECTION)
    : studioSource ? sectionID(relocatedStudioSections(studioSource.oldSection).find(title => candidates.includes(title)) ?? relocatedStudioSections(studioSource.oldSection)[0]) : params.get("section");
  const section = candidates.find(title => sectionID(title) === requestedSection) ?? fallback;
  return { tab: sectionTab(section)!, section, collectionId: collection?.id, mode: params.get("mode") === "dark" ? "dark" : "light" };
}
export function showcaseHash(view: ShowcaseLocation, currentHash = ""): string {
  const params = new URLSearchParams(currentHash.replace(/^#/, ""));
  params.set("tab", view.tab); params.set("section", sectionID(view.section));
  if (view.collectionId) params.set("collection", view.collectionId); else params.delete("collection");
  if (view.collectionId) params.set("mode", view.mode); else params.delete("mode");
  return `#${params}`;
}

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AetherIcon, ApplicationSidebar, Button, DocumentBar, SearchField, SegmentedControl, StatusBar, Tabs, WorkspaceShell, type AetherIconName, type LayoutPreset, type SidebarSection, type WorkspacePanelState } from "../../src/index";
import { SidebarDesignMenu } from "../../src/SidebarDesignMenu";
import { StudioModeButton, WorkspaceWindowMenu } from "../../src/StudioChrome";
import { ToolIconTheme, useGlobalToolIconPack } from "../../src/ToolIconTheme";
import { aetherThemes } from "../../src/themes";
import { useDemoSidebarDesign } from "../useDemoSidebarDesign";
import { useSuiteApps } from "../suite-apps";
import { SHOWCASE_TABS, comparisonGroup, isShowcaseTab, sectionID, sectionIcon, sectionLabel, sectionTab } from "../showcase";
import { ShowcaseCollectionEditor, ShowcaseCollections } from "./ShowcaseCollections";
import { ShowcaseViewContext } from "./ShowcaseView";
import { COLLECTIONS_STORAGE_KEY, SHOWCASE_COLLECTIONS, parseCollections, readShowcaseLocation, showcaseHash, type CollectionKind, type ShowcaseCollection, type ShowcaseLocation } from "./collections";

function loadCollections() {
  try { const saved = localStorage.getItem(COLLECTIONS_STORAGE_KEY); return { items: saved ? parseCollections(saved) : [], notice: "" }; }
  catch { return { items: [], notice: "Saved collections could not be read. Built-in collections are available." }; }
}
// Categories live in the standard sidebar; the rail panels are collections only.
const panelFor = (view: ShowcaseLocation, collections: readonly ShowcaseCollection[]) => collections.find(item => item.id === view.collectionId)?.kind ?? "none";
const TAB_ICONS: Record<string, AetherIconName> = { elements: "button", widgets: "layout", windows: "windows", apps: "apps", icons: "star" };

/** Gallery navigation and personal organization; specimen state remains with the specimens. */
export function ShowcaseBrowser({ children }: { children: ReactNode }) {
  const applications = useSuiteApps();
  const [sidebarDesign, setSidebarDesign] = useDemoSidebarDesign("gallery");
  const [preset, setPreset] = useState<LayoutPreset>("docked");
  const [initial] = useState(loadCollections);
  const [custom, setCustom] = useState<ShowcaseCollection[]>(initial.items);
  const [notice, setNotice] = useState(initial.notice);
  const collections = [...SHOWCASE_COLLECTIONS, ...custom];
  const [view, setView] = useState(() => readShowcaseLocation(location.hash, collections));
  const [panels, setPanels] = useState<WorkspacePanelState>(() => ({ [panelFor(view, collections)]: { placement: "docked" } }));
  const [editing, setEditing] = useState<ShowcaseCollection | null>(null);
  const [query, setQuery] = useState("");
  const [removed, setRemoved] = useState<ShowcaseCollection | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const lastSection = useRef(new Map([[view.tab, view.section]]));
  const current = SHOWCASE_TABS.find(item => item.id === view.tab)!;
  const collection = collections.find(item => item.id === view.collectionId);
  const comparison = comparisonGroup(view.tab, view.section, Boolean(collection));
  const pageSections = comparison?.sections ?? [view.section];
  const sections = collection?.sections ?? current.groups.flatMap(item => item.reviewTogether ? [item.sections[0]] : [...item.sections]);
  const position = sections.indexOf(comparison?.sections[0] ?? view.section);
  const pageTitle = comparison?.label ?? sectionLabel(view.section);
  const group = current.groups.find(item => item.sections.includes(view.section));
  const theme = aetherThemes.find(item => item.id === collection?.themeId);
  const iconPack = useGlobalToolIconPack();
  const jump = (next: ShowcaseLocation, panel?: string) => {
    setView(next); lastSection.current.set(next.tab, next.section);
    const hash = showcaseHash(next, location.hash);
    if (location.hash !== hash) history.pushState(null, "", hash);
    if (panel) setPanels({ [panel]: { placement: "docked" } });
  };
  useEffect(() => { history.replaceState(null, "", showcaseHash(view, location.hash)); }, []);
  useEffect(() => {
    const follow = () => {
      const next = readShowcaseLocation(location.hash, collections);
      setView(next); setPanels({ [panelFor(next, collections)]: { placement: "docked" } });
    };
    window.addEventListener("hashchange", follow); window.addEventListener("popstate", follow);
    return () => { window.removeEventListener("hashchange", follow); window.removeEventListener("popstate", follow); };
  }, [custom]);
  useEffect(() => {
    const scroller = content.current;
    if (!scroller) return;
    const target = comparison && view.section !== comparison.sections[0] ? scroller.querySelector(`#${sectionID(view.section)}`) : null;
    scroller.scrollTop = target ? scroller.scrollTop + target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 16 : 0;
  }, [view.section, view.collectionId]);
  const chooseSection = (section: string, item?: ShowcaseCollection) => jump({ ...view, tab: sectionTab(section)!, section, collectionId: item?.id });
  const chooseCollection = (item: ShowcaseCollection, section?: string) => chooseSection(section ?? (item.sections.includes(view.section) ? view.section : item.sections[0]), item);
  const showTab = (id: string) => {
    if (!isShowcaseTab(id)) return;
    jump({ tab: id, section: lastSection.current.get(id) ?? SHOWCASE_TABS.find(item => item.id === id)!.sections[0], mode: view.mode }, "none");
  };
  const persist = (items: ShowcaseCollection[]) => {
    setCustom(items);
    try { localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify({ version: 1, collections: items })); setNotice("Collections saved in this browser."); }
    catch { setNotice("Browser storage is unavailable. Collection changes will last for this session."); }
  };
  const createCollection = (kind: CollectionKind) => {
    if (custom.length >= 50) { setNotice("You can save up to 50 personal collections. Edit an existing collection to add more sections."); return; }
    setEditing({ id: `custom-${crypto.randomUUID()}`, label: "", description: "", kind, sections: [...pageSections], themeId: kind === "theme" ? collection?.themeId : undefined, custom: true });
  };
  const saveCollection = (item: ShowcaseCollection) => {
    persist(custom.some(entry => entry.id === item.id) ? custom.map(entry => entry.id === item.id ? item : entry) : [...custom, item]);
    setEditing(null);
    const section = item.sections.includes(view.section) ? view.section : item.sections[0];
    jump({ ...view, tab: sectionTab(section)!, section, collectionId: item.id }, item.kind);
  };
  const themeStyle = theme ? Object.fromEntries(Object.entries({ ...theme.geometry, ...theme.font, ...theme.effects, ...theme.modes[view.mode] }).map(([name, value]) => [`--aether-${name}`, value])) as CSSProperties : undefined;
  // The standard Aether sidebar: this workspace's categories as sections, one row per page.
  const search = query.trim().toLowerCase();
  const navSections: SidebarSection[] = view.tab === "home"
    ? [{ id: "workspaces", title: "Workspaces", items: SHOWCASE_TABS.filter(item => item.id !== "home").map(item => ({ id: item.id, label: item.label, icon: TAB_ICONS[item.id], onSelect: () => showTab(item.id) })) }]
    : current.groups.map(item => ({ id: item.id, title: current.grouped ? item.label : current.label,
      items: (item.reviewTogether ? [item.sections[0]] : item.sections).filter(title => !search || `${item.label} ${item.reviewTogether ? item.sections.map(sectionLabel).join(" ") : sectionLabel(title)}`.toLowerCase().includes(search)).map(title => ({
        id: title, label: item.reviewTogether ? item.label : sectionLabel(title), icon: sectionIcon(title, item.id) as AetherIconName, current: !collection && (item.reviewTogether ? item.sections.includes(view.section) : view.section === title), onSelect: () => chooseSection(title),
      })) })).filter(item => item.items.length);
  const collectionPanel = (kind: CollectionKind) => <ShowcaseCollections kind={kind} collections={collections} selectedId={view.collectionId} selectedSection={view.section} onNavigate={chooseCollection} onCreate={createCollection} />;
  return <ToolIconTheme pack={iconPack}><div className="gallery-application gallery-application--sidebar">
    <ApplicationSidebar id="aether-ui-showcase" name="Aether UI" app="ui" homeUrl="#tab=home&section=showcase-home"
      apps={applications} currentApp="ui" sections={navSections} userLabel={view.tab === "home" ? "Aether UI" : current.label}
      action={view.tab === "home" ? undefined : <SearchField ariaLabel={`Search ${current.label.toLowerCase()}`} placeholder="Find a page…" value={query} onQueryChange={setQuery} />}>
      {search && navSections.length === 0 && <p className="showcase-nav-empty" role="status">No matching sections.</p>}
    </ApplicationSidebar>
    <div className="gallery-application-main">
    <DocumentBar
      center={<Tabs tabs={SHOWCASE_TABS.map(({ id, label }) => ({ id, label }))} activeID={view.tab} onSelect={showTab} />}
      viewControls={<><StudioModeButton preset={preset} onChange={setPreset} /><SidebarDesignMenu value={sidebarDesign} onChange={setSidebarDesign} /><WorkspaceWindowMenu /></>} />
    <WorkspaceShell preset={preset} contentPresentation="framed" sidebarVariant={sidebarDesign} preservePanelContent panelState={panels} onPanelStateChange={setPanels} style={{ flex: 1, minHeight: 0 }}
      leftPanels={[
        { id: "collection", title: "Collections", icon: <AetherIcon name="folder" />, content: collectionPanel("collection") },
        { id: "app", title: "App collections", icon: <AetherIcon name="stack-3d" />, content: collectionPanel("app") },
        { id: "theme", title: "Theme collections", icon: <AetherIcon name="palette" />, content: collectionPanel("theme") },
      ]}
      statusBar={<StatusBar>{view.tab === "home" ? <span>Aether UI · Home</span> : <><span>{collection?.label ?? current.label} · {pageTitle}</span><span>{position + 1} / {sections.length} pages · {preset}</span></>}</StatusBar>}>
      <div className={`gallery-content${theme ? ` showcase-theme-preview aether-${view.mode}-theme` : ""}`} style={themeStyle} ref={content}>
        {/* Home is its own page: no breadcrumb, paging or collection actions. */}
        {view.tab !== "home" && <header className="showcase-page-header">
          <div className="showcase-breadcrumb">{collection ? `${collection.kind === "app" ? "App collections" : collection.kind === "theme" ? "Theme collections" : "Collections"} / ${collection.label}` : `${current.label}${current.grouped ? ` / ${group?.label}` : ""}`}</div>
          <div className="showcase-page-title"><h1>{pageTitle}</h1><div className="showcase-page-actions">
            <Button aria-label="Previous section" disabled={position <= 0} onClick={() => chooseSection(sections[position - 1], collection)}>Previous</Button>
            <Button aria-label="Next section" disabled={position >= sections.length - 1} onClick={() => chooseSection(sections[position + 1], collection)}>Next</Button>
          </div></div>
          <p>{collection?.description ?? group?.description ?? "Shared Aether components and their interactive variants."}</p>
          {comparison && comparison.id !== "dialogs-overlays" && <nav className="showcase-comparison-jumps" aria-label={`${comparison.label} designs`}>
            {comparison.sections.map(title => <Button key={title} appearance="link" onClick={() => chooseSection(title)}>{sectionLabel(title)}</Button>)}
          </nav>}
          <div className="showcase-page-actions">
            {theme && <SegmentedControl ariaLabel="Collection preview mode" value={view.mode} onChange={mode => jump({ ...view, mode: mode as "light" | "dark" })} options={[{ id: "light", label: "Light" }, { id: "dark", label: "Dark" }]} />}
            <Button onClick={() => createCollection("collection")}>Save as collection</Button>
            {collection?.custom && <><Button onClick={() => setEditing(collection)}>Edit collection</Button><Button onClick={() => {
              persist(custom.filter(item => item.id !== collection.id)); setRemoved(collection);
              jump({ ...view, collectionId: undefined }, "collection");
            }}>Remove collection</Button></>}
          </div>
          {(notice || removed) && <div className="showcase-save-notice" role="status">{notice}{removed && <Button disabled={custom.length >= 50} onClick={() => { persist([...custom, removed]); setRemoved(null); }}>Undo collection removal</Button>}</div>}
        </header>}
        <ShowcaseViewContext.Provider value={view}>{children}</ShowcaseViewContext.Provider>
      </div>
    </WorkspaceShell>
    </div>
    {editing && <ShowcaseCollectionEditor key={editing.id} initial={editing} existing={collections} onSave={saveCollection} onClose={() => setEditing(null)} />}
  </div></ToolIconTheme>;
}

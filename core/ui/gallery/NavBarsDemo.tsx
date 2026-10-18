import { useState, type ReactNode } from "react";
import { AetherIcon, ApplicationSidebar, Button, SearchField, SidebarLabel, SidebarNavigation, WorkspaceIcon, type SidebarSection, type AppMarkName } from "../src/index";
import { useSuiteApps } from "./suite-apps";
import { StudioNavigationSpecimens } from "./StudioNavigationSpecimens";

/** Overlays › Navigation bars: every navigation sidebar the suite uses today,
 * then the reference configurations (Jonathan, 2026-10-14), all one widget. */
export const referenceSections: SidebarSection[] = [
  { id: "dashboard", title: "Dashboard", items: [
    { id: "overview", label: "Overview", icon: "home" },
    { id: "projects", label: "Current projects", icon: "grid-2", badge: 10 },
  ] },
  { id: "editor", title: "Editor", items: [
    { id: "designer", label: "Designer", icon: "circle-dashed" },
    { id: "build", label: "Magic build", icon: "sparkles" },
    { id: "colors", label: "Color system", icon: "palette" },
    { id: "files", label: "Current projects", icon: "folder" },
    { id: "upload", label: "Upload new", icon: "export" },
  ] },
  { id: "reports", title: "Reports", items: [
    { id: "report", label: "Overview", icon: "chart-bars" },
    { id: "scheduled", label: "Scheduled reports", icon: "clock" },
  ] },
];

const homeSections: SidebarSection[] = [
  { id: "library", items: [
    { id: "home", label: "Home", icon: "home", current: true },
    { id: "personal", label: "My files", icon: "folder" },
    { id: "shared", label: "Shared with me", icon: "link" },
    { id: "trash", label: "Recycle bin", icon: "delete" },
  ] },
  { id: "org", title: "Jenkins Robotics", items: [
    { id: "w1", label: "Animatronics", icon: <WorkspaceIcon name="Animatronics" /> },
    { id: "w2", label: "Show Control", icon: <WorkspaceIcon name="Show Control" /> },
  ] },
];

const showcaseSections: SidebarSection[] = [
  { id: "sidebars", title: "Sidebars", items: [
    { id: "nav", label: "Navigation sidebars", icon: "sidebar", current: true },
    { id: "tools", label: "Side tool bars", icon: "sidebar-right" },
    { id: "rail", label: "Rail + Dock panel + Tree", icon: "list-tree" },
  ] },
  { id: "layouts", title: "Layouts", items: [
    { id: "presets", label: "Layout presets", icon: "layout" },
    { id: "shell", label: "Workspace shell", icon: "workspace" },
  ] },
];

function Frame({ label, light, dark, reference, children }: { label: string; light?: boolean; dark?: boolean; reference?: "tint" | "solid" | "dark"; children: ReactNode }) {
  const theme = light ? "aether-light-theme" : dark ? "aether-theme-aether-default aether-dark-theme" : "";
  return <figure className="nav-bar-specimen">
    <div className={`nav-bar-specimen-window ${theme}${reference ? " nav-bar-reference-window" : ""}`} data-nav-reference={reference}>
      {children}
    </div>
    <figcaption>{label}</figcaption>
  </figure>;
}

function ReferenceSidebar({ id, app, name, collapsed, tint }: { id: string; app: AppMarkName; name: string; collapsed?: boolean; tint?: boolean }) {
  const [selected,setSelected] = useState("settings");
  const sections = referenceSections.map(section => ({...section, items: section.items.map(item => ({...item, current:selected===item.id, onSelect:()=>setSelected(item.id)}))}));
  return <ApplicationSidebar id={id} name={name} app={app}
    variant="captioned" defaultCollapsed={collapsed} selection={tint ? "tint" : "solid"} sections={sections}
    settings={{current:selected==="settings",onSelect:()=>setSelected("settings")}} />;
}

export function NavBarsDemo() {
  const apps = useSuiteApps();
  return <div className="nav-bar-specimens">
    <StudioNavigationSpecimens />
    <h4>In use today</h4>
    <div className="nav-bar-row">
      <Frame label="App home (Drive, CAD, Map… homes) · Create or upload, library, workspaces, Plugins">
        <ApplicationSidebar id="gallery-nav-home" name="Aether Drive" app="drive" homeUrl="#" settings apps={apps} currentApp="drive" userLabel="Jonathan Jenkins"
          action={<Button primary aria-label="Create or upload" title="Create or upload"><AetherIcon name="plus" /><SidebarLabel>Create or upload</SidebarLabel></Button>} sections={homeSections}
          footerTools={<SidebarNavigation ariaLabel="Plugins" sections={[{ id: "plugins", items: [{ id: "plugins", label: "Plugins", icon: "package" }] }]} />} />
      </Frame>
      <Frame label="Aether UI showcase · search, categories of the current workspace">
        <ApplicationSidebar id="gallery-nav-showcase" name="Aether UI" app="ui" homeUrl="#" apps={apps} currentApp="ui" userLabel="Overlays"
          action={<SearchField placeholder="Find a page…" aria-label="Find a page" />} sections={showcaseSections} />
      </Frame>
    </div>
    <h4>Reference configurations</h4>
    <div className="nav-bar-row">
      <Frame label="Aether CAD · collapsed rail" light reference="tint">
        <ReferenceSidebar id="gallery-nav-rail" app="cad" name="Aether CAD" collapsed tint />
      </Frame>
      <Frame label="Aether Map · soft tint selection · light" light reference="tint">
        <ReferenceSidebar id="gallery-nav-tint" app="map" name="Aether Map" tint />
      </Frame>
      <Frame label="Aether Sketch · solid selection · light" light reference="solid">
        <ReferenceSidebar id="gallery-nav-solid" app="sketch" name="Aether Sketch" />
      </Frame>
      <Frame label="Aether Studio · dark" dark reference="dark">
        <ReferenceSidebar id="gallery-nav-dark" app="studio" name="Aether Studio" />
      </Frame>
    </div>
  </div>;
}

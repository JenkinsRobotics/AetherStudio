import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { appMarkSources } from "@aether/assets/branding/marks/sources";
import { SidebarGroup, ApplicationSidebar } from "./ApplicationSidebar";
import { SidebarLabel } from "./CollapsibleSidebar";
import { NavBarsDemo } from "../gallery/NavBarsDemo";
import { StudioNavigationSpecimens } from "../gallery/StudioNavigationSpecimens";

afterEach(() => { cleanup(); localStorage.clear(); });
test("global navigation keeps account and tools in the footer and retains collapse across content changes", () => {
  const sidebar = (workspace: string) => <ApplicationSidebar id="map-navigation" name="Aether Map" icon={<span />} homeUrl="/map/" footerTools={<button>Layout</button>}>
    <nav aria-label="Workspaces"><button aria-label={workspace}><SidebarLabel>{workspace}</SidebarLabel></button></nav>
  </ApplicationSidebar>;
  const view = render(sidebar("Mapping"));
  const rail = screen.getByRole("complementary", { name: "Aether Map sidebar" });
  expect(rail.querySelector('.aui-sidebar-footer [data-aether-account-layout="sidebar"]')).not.toBeNull();
  expect(rail.querySelector('.aui-sidebar-footer')?.contains(screen.getByRole('button', {name:'Layout'}))).toBe(true);
  fireEvent.click(screen.getByLabelText("Collapse Aether Map sidebar"));
  view.rerender(sidebar("Visualization"));
  expect(rail.classList.contains("aui-sidebar--collapsed")).toBe(true);
  expect(screen.getByRole('button', {name:'Visualization'})).not.toBeNull();
  view.unmount();
  render(sidebar("Show"));
  expect(screen.getByRole('button', {name:'Expand Aether Map sidebar'})).not.toBeNull();
  expect(screen.getByRole('link', {name:'Aether Map home'}).getAttribute('href')).toBe('/map/');
});

test("standard sidebar renders sections, badges, the current page, settings and the account footer", () => {
  const opened: string[] = [];
  const settings = (event: Event) => { event.preventDefault(); opened.push("settings"); };
  document.addEventListener("aether-open-settings", settings);
  const chosen: string[] = [];
  render(<ApplicationSidebar id="cad-library" name="Aether CAD" icon={<span />} homeUrl="/cad/" settings
    action={<button>Create or upload</button>}
    sections={[
      { id: "library", items: [
        { id: "home", label: "Home", icon: "home", current: true, onSelect: () => chosen.push("home") },
        { id: "projects", label: "Current projects", icon: "folder", badge: 10, onSelect: () => chosen.push("projects") },
      ] },
      { id: "workspaces", title: "Workspaces", items: [{ id: "jr", label: "Jenkins Robotics", icon: <span>J</span>, href: "#jr" }] },
    ]} />);
  const rail = screen.getByRole("complementary", { name: "Aether CAD sidebar" });
  expect(screen.getByRole("button", { name: "Home" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("button", { name: "Current projects" }).textContent).toContain("10");
  expect(screen.getByText("Workspaces")).not.toBeNull();
  expect(screen.getByRole("navigation", { name: "Workspaces" }).textContent).toContain("Jenkins Robotics");
  expect(screen.getByRole("navigation", { name: "Aether CAD" }).textContent).toContain("Home");
  expect(screen.getByRole("link", { name: "Jenkins Robotics" }).getAttribute("href")).toBe("#jr");
  fireEvent.click(screen.getByRole("button", { name: "Current projects" }));
  expect(chosen).toEqual(["projects"]);
  const footer = rail.querySelector(".aui-sidebar-footer")!;
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  expect(opened).toEqual(["settings"]);
  expect(footer.contains(screen.getByRole("button", { name: "Settings" }))).toBe(true);
  expect(footer.querySelector('[data-aether-account-layout="sidebar"]')).not.toBeNull();
  expect(rail.querySelector(".aui-application-sidebar-action")?.textContent).toBe("Create or upload");
  document.removeEventListener("aether-open-settings", settings);
});

test("brand can be left to a page header while the collapse control remains", () => {
  render(<ApplicationSidebar id="x" name="Aether Map" brand={false} sections={[]} />);
  expect(screen.queryByRole("link", { name: "Aether Map home" })).toBeNull();
  expect(screen.getByLabelText("Collapse Aether Map sidebar")).not.toBeNull();
});

test("the suite app launcher sits below Settings and opens the app list", async () => {
  render(<ApplicationSidebar id="cad-apps" name="Aether CAD" settings currentApp="cad"
    apps={[{ id: "cad", name: "Aether CAD", url: "/cad/" }, { id: "map", name: "Aether Map", url: "/map/" }]} />);
  const footer = screen.getByRole("complementary", { name: "Aether CAD sidebar" }).querySelector(".aui-application-sidebar-settings")!;
  const launcher = screen.getByRole("button", { name: "Aether Studio applications" });
  expect(footer.contains(launcher)).toBe(true);
  expect(footer.firstElementChild?.textContent).toContain("Settings");
  expect(launcher.textContent).toContain("Apps");
  fireEvent.click(launcher);
  expect((await screen.findByRole("menuitem", { name: /Aether Map/ })).getAttribute("href")).toBe("/map/");
});

test("workspace disclosure preserves its device preference without hiding the toggle",()=>{
 const renderGroup=()=>render(<SidebarGroup title="Workspaces" storageKey="test-workspaces"><button>Engineering</button></SidebarGroup>);
 const first=renderGroup();
 fireEvent.click(screen.getByRole("button",{name:"Hide Workspaces"}));
 expect(screen.queryByRole("button",{name:"Engineering"})).toBeNull();
 first.unmount();renderGroup();
 expect(screen.queryByRole("button",{name:"Engineering"})).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Show Workspaces"}));
 expect(screen.getByRole("button",{name:"Engineering"})).toBeTruthy();
});

test("captioned navigation retains static group labels and rows through collapse and expansion", () => {
  const sections = [{ id: "dashboard", title: "Dashboard", items: [{ id: "home", label: "Overview", icon: "home" }] }];
  render(<ApplicationSidebar id="captioned" name="Aether Map" icon={<svg aria-hidden="true" />} variant="captioned" defaultCollapsed sections={sections} settings />);
  const sidebar = screen.getByRole("complementary", { name: "Aether Map sidebar" });
  expect(sidebar.classList.contains("aui-sidebar--collapsed")).toBe(true);
  expect(sidebar.querySelector(".aui-application-sidebar-caption")?.textContent).toBe("Dashboard");
  expect(sidebar.querySelector(".aui-application-sidebar-disclosure")).toBeNull();
  expect(sidebar.querySelector(".aui-application-sidebar-user")).toBeNull();
  expect(screen.queryByRole("button", { name: "Hide Dashboard" })).toBeNull();
  const brand = screen.getByRole("button", { name: "Expand Aether Map sidebar" });
  expect(sidebar.querySelectorAll(".aui-sidebar-toggle")).toHaveLength(1);
  expect(screen.queryByRole("link", { name: "Aether Map home" })).toBeNull();
  expect(brand.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(brand.querySelector("svg")!);
  expect(sidebar.classList.contains("aui-sidebar--collapsed")).toBe(false);
  expect(screen.getByRole("button", { name: "Overview" })).toBeTruthy();
  expect(sidebar.querySelector(".aui-application-sidebar-caption")?.textContent).toBe("Dashboard");
  expect(brand.getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(brand);
  expect(sidebar.classList.contains("aui-sidebar--collapsed")).toBe(true);
  expect(screen.getByRole("button", { name: "Overview" })).toBeTruthy();
  expect(brand.getAttribute("aria-expanded")).toBe("false");
});

test("reference configurations use captioned navigation and independent current-page state", () => {
  const { container } = render(<NavBarsDemo />);
  expect(container.querySelectorAll(".aui-application-sidebar--captioned")).toHaveLength(4);
  const map = screen.getByRole("complementary", { name: "Aether Map sidebar" });
  const sketch = screen.getByRole("complementary", { name: "Aether Sketch sidebar" });
  expect(within(map).getByRole("button", { name: "Settings" }).getAttribute("aria-current")).toBe("page");
  fireEvent.click(within(map).getByRole("button", { name: "Designer" }));
  expect(within(map).getByRole("button", { name: "Designer" }).getAttribute("aria-current")).toBe("page");
  expect(within(map).getByRole("button", { name: "Settings" }).getAttribute("aria-current")).toBeNull();
  expect(within(sketch).getByRole("button", { name: "Settings" }).getAttribute("aria-current")).toBe("page");
  expect(map.querySelector("img")?.getAttribute("width")).toBe("40");
  const overview = within(map).getAllByRole("button", { name: "Overview" })[0];
  fireEvent.click(overview);
  expect(overview.getAttribute("aria-current")).toBe("page");
  expect(map.classList.contains("aui-sidebar--collapsed")).toBe(false);
  expect(map.querySelector(".aui-application-sidebar-brand a")).toBeNull();
});

test("studio navigation uses one brand toggle and an app-owned footer without changing other variants", () => {
  render(<ApplicationSidebar id="studio-test" name="Aether CAD" variant="studio" icon={<svg />} defaultCollapsed
    sections={[{id:"modes",items:[{id:"design",label:"Design",icon:"box",current:true}]}]}
    footer={<button>Document context</button>} />);
  const sidebar=screen.getByRole("complementary",{name:"Aether CAD sidebar"});
  expect(sidebar.classList.contains("aui-application-sidebar--studio")).toBe(true);
  expect(sidebar.querySelectorAll(".aui-sidebar-toggle")).toHaveLength(1);
  expect(sidebar.querySelector("[data-aether-account]")).toBeNull();
  expect(sidebar.querySelector(".aui-sidebar-footer")?.contains(screen.getByRole("button",{name:"Document context"}))).toBe(true);
  fireEvent.click(screen.getByRole("button",{name:"Expand Aether CAD sidebar"}));
  expect(sidebar.classList.contains("aui-sidebar--collapsed")).toBe(false);
  expect(screen.getByRole("button",{name:"Design"}).getAttribute("aria-current")).toBe("page");
});

test("studio comparison retains independent navigation, workspace and status state through collapse", () => {
  const {container}=render(<StudioNavigationSpecimens/>);
  const [expanded,collapsed]=screen.getAllByRole("complementary",{name:"Aether CAD sidebar"});
  expect(container.querySelector("[data-icon-missing]")).toBeNull();
  expect(expanded.classList.contains("aui-sidebar--collapsed")).toBe(false);
  expect(collapsed.classList.contains("aui-sidebar--collapsed")).toBe(true);
  fireEvent.click(within(expanded).getByRole("button",{name:"Sketch"}));
  expect(within(expanded).getByRole("button",{name:"Sketch"}).getAttribute("aria-current")).toBe("page");
  expect(within(collapsed).getByRole("button",{name:"Design"}).getAttribute("aria-current")).toBe("page");
  fireEvent.click(within(expanded).getByRole("button",{name:"Document and workspace"}));
  fireEvent.click(screen.getByRole("menuitem",{name:"Review workspace"}));
  fireEvent.click(within(expanded).getByRole("button",{name:"Cloud status: Up to date. Preview states"}));
  fireEvent.click(screen.getByRole("menuitem",{name:"Preview: Offline"}));
  fireEvent.click(within(expanded).getByRole("button",{name:"Collapse Aether CAD sidebar"}));
  fireEvent.click(within(expanded).getByRole("button",{name:"Expand Aether CAD sidebar"}));
  expect(within(expanded).getByRole("button",{name:"Document and workspace"}).textContent).toContain("Review");
  expect(within(expanded).getByRole("button",{name:"Cloud status: Offline. Preview states"})).toBeTruthy();
  expect(within(collapsed).getByRole("button",{name:"Cloud status: Up to date. Preview states"})).toBeTruthy();
  expect(container.querySelector("a[href*='demo=']")).toBeNull();
});


test("registered navigation uses the approved logo family while custom branding stays intact", () => {
  const { rerender } = render(<ApplicationSidebar id="brand-test" name="Aether Animation" variant="captioned" icon={<span>Old artwork</span>}/>);
  const brand = screen.getByRole("button", { name: "Collapse Aether Animation sidebar" });
  expect(brand.querySelector(".aui-app-wordmark")?.getAttribute("data-app")).toBe("animation");
  expect(brand.querySelector(".aui-application-sidebar-mark img")?.getAttribute("src")).toBe(appMarkSources.animation);
  expect(screen.queryByText("Old artwork")).toBeNull();
  fireEvent.click(brand);
  expect(screen.getByRole("button", { name: "Expand Aether Animation sidebar" })).toBeTruthy();
  rerender(<ApplicationSidebar id="brand-test" name="Custom app" icon={<span>Custom artwork</span>} homeUrl="/custom"/>);
  expect(screen.getByRole("link", { name: "Custom app home" }).getAttribute("href")).toBe("/custom");
  expect(screen.getByText("Custom artwork")).toBeTruthy();
  expect(document.querySelector(".aui-app-wordmark")).toBeNull();
});

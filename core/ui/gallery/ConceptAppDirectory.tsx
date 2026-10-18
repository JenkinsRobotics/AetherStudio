import { demoWindowURL, useDemoWindowLauncher } from "./DemoWindowLauncher";
import { AppIcon, LinkCard, LinkCardGrid, type LaunchableApp } from "../src/index";
import { originalGallery } from "./CADFeatureGallery";
import { isInstalledGallery, studioAppURL } from "./demo-location";

/** The native CAD test app (Aether-CAD gallery/test-window.html). */
const cadTestWindowURL = import.meta.env.VITE_CAD_TEST_WINDOW_URL || studioAppURL("/cad/gallery/test-window.html");
export const conceptApps: readonly LaunchableApp[] = [
  { id: "wheel-navigation", name: "Aether Navigation Studio", description: "Collapsible app navigation beside a full-height three-column wheel workspace, with center-only toolbars and no outer header or footer", url: "?demo=wheel-navigation" },
  { id: "wheel-reference", name: "Aether Reference Studio", description: "Close train-wheel reference with a dense 19-item feature tree, full modeling ribbon, workspace modes, compact inspector and live steel-blue wheel", url: "?demo=wheel-reference" },
  { id: "wheel-studio", name: "Aether Wheel Studio", description: "Train wheel concept with full-height feature and property panels, editable steel-blue geometry, a wheelset assembly and live studio rendering", url: "?demo=wheel-studio" },
  { id: "spotlight-studio", name: "Aether Spotlight Studio", description: "Graphite design study with a live metallic enclosure, rounded edges, adjustable spotlight, soft shadows and PNG rendering", url: "?demo=spotlight-studio" },
  { id: "plasticity-studio", name: "Aether Model Studio", description: "Plasticity-inspired robot study with compact sidebars, floating tools, live 3D selection, transforms and surface finishes", url: "?demo=plasticity-studio" },
  { id: "sketch-studio", name: "Aether Sketch Studio", description: "Model Studio's floating workspace for vector drawing: an acoustic speaker study with editable paths, layers and stroke controls", url: "?demo=sketch-studio" },
  { id: "map-studio", name: "Aether Map Studio", description: "Model Studio's floating workspace for projection mapping: a luminous pavilion with editable surfaces and an animated preview", url: "?demo=map-studio" },
  { id: "io-studio", name: "Aether IO Studio", description: "Model Studio's floating workspace for electronics: a detailed controller board with component selection, placement and copper layers", url: "?demo=io-studio" },
  { id: "material-studio", name: "Aether Material Studio", description: "Live sculpture study with floating material and transform editors, scene hierarchy, studio lighting and turntable preview", url: "?demo=material-studio" },
  { id: "avatar-studio", name: "Aether Avatar Studio", description: "Illustrated presenter scenes with our floating sidebar and toolbar, drawing, framing and PNG export", url: "?demo=avatar-studio" },
  { id: "analytics-dashboard", name: "Aether Analytics", description: "Dark analytics dashboard with comparative charts, gauges, acquisition lists and searchable customers", url: "?demo=analytics-dashboard" },
  { id: "properties-studio", name: "Properties Studio", description: "Mint and blue styling inspector with a live shape preview", url: "?demo=properties-studio" },
  { id: "commerce-dashboard", name: "Commerce Dashboard", description: "Business dashboard with metrics, charts, goals and commerce workflows", url: "?demo=commerce-dashboard" },
  { id: "animation", name: "Aether Animation Studio", description: "Former Swift-based Anima Studio app — migrated to Aether UI", url: "?demo=animation-studio" },
  { id: "cad", name: "Aether CAD", description: "Ribbon workspace and live sample part", url: "?demo=cad-workspace" },
  { id: "animation-mockup", name: "Aether Animation Mockup", description: "The dark-theme SwiftUI mockup, ported 1:1", url: "?demo=animation-mockup" },
  { id: "atlas-demo", name: "Atlas Studio Demo", description: "The CodexUI \"Atlas Animatronic\" walkthrough, ported 1:1", url: "?demo=atlas-demo" },
  { id: "ui-dev", name: "Aether UI Dev browser", description: "The native template and state-variant browser, as its own tool", url: "?demo=ui-dev" },
  { id: "application-splash", name: "Application splash", description: "Startup screens and the CAD background collection", url: "?demo=application-splash" },
  { id: "workbench", name: "Workbench window", description: "Original two-column window with a resizable navigator and editable sample documents", url: "./workbench-window.html" },
  { id: "cad-test-window", name: "CAD test app", description: "Native sprocket workspace: edit dimensions, roll back history, save and reopen", url: cadTestWindowURL },
  { id: "cad-features", name: "CAD feature collection", description: "The original Sketch, Extrude, Revolve, Sweep, Loft, Thicken, Enclose, Plane and Mate editors", url: originalGallery },
  { id: "cad-harness", name: "CAD harness demo", description: "Harness connectors and pin tables in Aether CAD", url: studioAppURL("/cad/index.html?demo=harness") },
  { id: "io", name: "Aether IO", description: "The installed electronics application", url: studioAppURL("/io/") },
  { id: "ui", name: "Aether UI", description: "Widget, feature, and workspace gallery", url: "./" },
];

export function ConceptAppDirectory({ ids, title = "Concept applications" }: { ids?: readonly string[]; title?: string } = {}) {
  const { launch, feedback } = useDemoWindowLauncher();
  const hostedIDs = ["cad-test-window", "cad-features", "cad-harness", "io"];
  const cards = (hosted: boolean) => conceptApps.filter(app => app.id !== "ui" && hostedIDs.includes(app.id) === hosted && (!ids || ids.includes(app.id)));
  const grid = (apps: readonly LaunchableApp[], label: string) => <LinkCardGrid ariaLabel={label}>
    {apps.map(app => {
      const studioOnly = hostedIDs.includes(app.id) && !isInstalledGallery();
      return <LinkCard key={app.id}
      onSelect={() => launch({ id: app.id, title: app.name, url: hostedIDs.includes(app.id) ? app.url : demoWindowURL(app.url), studioOnly })}
      icon={<AppIcon app={app.id.startsWith("cad") || ["plasticity-studio", "spotlight-studio", "wheel-studio", "wheel-reference", "wheel-navigation"].includes(app.id) ? "cad" : ["io", "io-studio"].includes(app.id) ? "io" : app.id === "sketch-studio" ? "sketch" : app.id === "map-studio" ? "map" : ["animation", "animation-mockup", "atlas-demo", "avatar-studio", "material-studio"].includes(app.id) ? "animation" : "ui"} size={52} />}
      title={app.name} description={app.description} action="Open workspace window" />;
    })}
  </LinkCardGrid>;
  return <div className="concept-app-directory demo-launch-directory" aria-label="Aether UI concept applications">
    <header>
      <span>LAUNCHABLE DEMOS</span>
      <h3>{title}</h3>
      <p>Demo apps and standalone windows, together in one place. Each opens in its own resizable workspace window.</p>
    </header>
    {grid(cards(false), "Concept application demos")}
    {cards(true).length > 0 && <section aria-label="Studio applications and demos"><h3>Studio applications and CAD demos</h3><p>{isInstalledGallery() ? "These open from your Studio installation. Sign in to Studio if prompted." : "Studio apps open from installed Aether UI. From this standalone preview, copy the Studio address and paste it into your browser’s address bar."}</p>{grid(cards(true), "Studio application demos")}</section>}
    {feedback}
  </div>;
}

import { AetherIcon, AppIcon, ApplicationUpdates, LinkCard, LinkCardGrid, type AetherIconName } from "../../src/index";
import heroArtwork from "../../../assets/branding/new-aether-2026-09/aether-ui-hero.webp";
import { sectionID } from "../showcase";
import { SHOWCASE_COLLECTIONS, showcaseHash } from "./collections";
import { WHATS_NEW } from "./whats-new";

const APP_IDS: Record<string, string> = { "app-cad": "cad", "app-animation": "animation", "app-map": "map", "app-io": "io", "app-studio": "studio" };

const go = (hash: string) => { location.hash = hash; };

/** The Aether UI home: what's new in the library, then one card per app's showcase. */
export function ShowcaseHome() {
  const apps = SHOWCASE_COLLECTIONS.filter((item) => item.kind === "app");
  return <div className="showcase-home">
    <ApplicationUpdates name="Aether UI" description="The shared components and visual language behind every Aether application."
      artwork={<img src={heroArtwork} alt="" />}
      updates={WHATS_NEW.map((entry) => ({ id: entry.id, title: entry.title, description: entry.description, status: entry.status, color: entry.color,
        artwork: <button type="button" className="showcase-home-update-art" aria-label={`Open ${entry.title}`} disabled={!entry.link}
          onClick={() => entry.link && go(`#tab=${entry.link.tab}&section=${sectionID(entry.link.section)}`)}>
          <AetherIcon name={entry.icon as AetherIconName} width={56} height={56} />
        </button> }))} />
    <section className="showcase-home-apps" aria-labelledby="showcase-home-apps-title">
      <header><h2 id="showcase-home-apps-title">App showcases</h2><p>The components each Aether app is built from.</p></header>
      <LinkCardGrid ariaLabel="App showcases">{apps.map((app) => <LinkCard key={app.id}
        href={showcaseHash({ tab: "widgets", section: app.sections[0], collectionId: app.id, mode: "light" })}
        icon={<AppIcon app={APP_IDS[app.id] ?? "studio"} size={52} />} title={app.label} description={app.description} action="Open showcase" />)}</LinkCardGrid>
    </section>
  </div>;
}

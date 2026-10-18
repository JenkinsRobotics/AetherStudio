import type { ReactNode } from "react";
import { AetherIcon } from "./AetherIcon";
import { CollapsibleSidebar, SidebarLabel } from "./CollapsibleSidebar";
import { AppearanceToggle } from "./StudioChrome";
import { ThemeMenu } from "./ThemeMenu";
import { EmptyState } from "./EmptyState";
import { ApplicationWelcome } from "./ApplicationWelcome";
import { ApplicationSettings } from "./ApplicationChrome";
import { ApplicationSidebar } from "./ApplicationSidebar";
import "./ComingSoonHome.css";

/** Presentation-only product home; identity and navigation belong to the caller. */
export function ComingSoonHome({ id, name, description, icon, artwork, wideArtwork, homeUrl, suiteUrl, suiteName, navigation = "header" }: {
  /** Sidebar puts all application chrome in one full-height collapsible rail. */
  navigation?: "header" | "sidebar";
  id: string;
  name: string;
  description: string;
  icon: ReactNode;
  artwork: ReactNode;
  wideArtwork?: ReactNode;
  homeUrl: string;
  suiteUrl: string;
  suiteName: string;
}) {
  return (
    <div className={`aui-coming-home${navigation === "sidebar" ? " aui-coming-home--sidebar" : ""}`}>
      {navigation === "header" && <header className="aui-coming-top">
        <a href={homeUrl} aria-label={`${name} home`}>{icon}</a>
        <strong>{name}</strong>
        <span className="aui-coming-status">Coming soon</span>
        <div className="aui-coming-account"><ThemeMenu /><AppearanceToggle /><div data-aether-account="" /></div>
      </header>}
      {navigation === "sidebar" ? <ApplicationSidebar id={`${id}-home`} name={name} icon={icon} homeUrl={homeUrl}>
        <section><h2 className="aui-application-sidebar-caption"><SidebarLabel>Workspace</SidebarLabel></h2>
          <nav aria-label={`${name} navigation`}>
            <a href={homeUrl} aria-current="page" title="Home" aria-label="Home"><AetherIcon name="home" /><SidebarLabel>Home</SidebarLabel></a>
            <a href={suiteUrl} title={suiteName} aria-label={suiteName}><AetherIcon name="items" /><SidebarLabel>{suiteName}</SidebarLabel></a>
          </nav>
        </section>
      </ApplicationSidebar> : <CollapsibleSidebar id={`${id}-home`} ariaLabel={`${name} sidebar`} className="aui-coming-nav">
        <nav aria-label={`${name} navigation`}>
          <a href={homeUrl} aria-current="page" title="Home" aria-label="Home"><AetherIcon name="home" /><SidebarLabel>Home</SidebarLabel></a>
          <a href={suiteUrl} title={suiteName} aria-label={suiteName}><AetherIcon name="items" /><SidebarLabel>{suiteName}</SidebarLabel></a>
        </nav>
      </CollapsibleSidebar>}
      <main className="aui-coming-main">
        <ApplicationWelcome id={id} name={name} description={description} artwork={artwork} wideArtwork={wideArtwork} badge="Coming soon" />
        <section className="aui-coming-library" aria-labelledby={`${id}-work`}>
          <h2 id={`${id}-work`}>Your workspace</h2>
          <EmptyState title="Room for your next idea" description="Creation tools and your document library are coming soon." icon={<AetherIcon name="folder" width={42} height={42} />} />
        </section>
      </main>
      {navigation === "sidebar" && <ApplicationSettings name={name} />}
    </div>
  );
}

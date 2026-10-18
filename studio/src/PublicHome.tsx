import { APP_UPDATES } from "./app-updates";
import { ApplicationCard } from "./ApplicationCard";
import { ApplicationArtwork } from "@aether/session/library/ApplicationArtwork";
import { ApplicationWelcome } from "@aether/ui";
import { useState } from "react";
import { AppIcon, AetherIcon, Button, ListBox } from "@aether/ui";
import type { App } from "./main";

export function PublicHome({
  name,
  apps,
  onSignIn,
}: {
  name: string;
  apps: App[];
  onSignIn: () => void;
}) {
  const [page, setPage] = useState("home");
  return (
    <>
      <aside className="studio-sidebar">
        <div className="workspace-identity">
          <span className="workspace-avatar">
            <AppIcon app="studio" size={34} />
          </span>
          <div>
            <strong>{name}</strong>
            <small>Your creative workspace</small>
          </div>
        </div>
        <div className="nav-heading">Workspace</div>
        <nav aria-label="Studio navigation">
          <ListBox
            ariaLabel="Workspace sections"
            items={[
              { id: "home", label: "Home", icon: <AetherIcon name="home" /> },
              {
                id: "apps",
                label: "Applications",
                icon: <AetherIcon name="items" />,
              },
              {
                id: "start",
                label: "Get started",
                icon: <AetherIcon name="help" />,
              },
            ]}
            selectedIDs={new Set([page])}
            onSelect={(ids) => ids[0] && setPage(ids[0])}
          />
        </nav>
        <div className="sidebar-bottom">
          <p className="public-account-hint">
            Sign in to access your work and open applications.
          </p>
          <Button primary onClick={onSignIn}>
            Sign in
          </Button>
        </div>
      </aside>
      <div className="studio-body">
        <main className="studio-content">
          {page !== "start" ? (
            <>
              <div className="page-heading">
                <div>
                  <h1>
                    {page === "home"
                      ? "Welcome to your Studio."
                      : "Your applications"}
                  </h1>
                  <p>
                    {page === "home"
                      ? "One place for your creative tools. Hosted on your own device."
                      : "Open a tool to start creating. Sign in when prompted."}
                  </p>
                </div>
              </div>
              {page === "home" && <ApplicationWelcome updates={APP_UPDATES.studio} id="studio-public-welcome" name="Aether Studio" description="Your creative applications, together in one workspace." artwork={<ApplicationArtwork app="studio" />} />}
              <section className="section">
                <div className="section-heading">
                  <h2>Applications</h2>
                </div>
                <div className="application-grid">
                  {apps.map((app) => (
                    <ApplicationCard key={app.id} app={app} />
                  ))}
                </div>
                {apps.length === 0 && (
                  <div className="empty">
                    No applications are enabled for this installation yet. Sign
                    in as an administrator to choose your tools.
                  </div>
                )}
              </section>
              <section className="section">
                <div className="section-heading">
                  <h2>Your workspace</h2>
                </div>
                <div className="welcome-panel">
                  <AetherIcon name="folder" width={32} height={32} />
                  <div>
                    <h3>Your work stays yours</h3>
                    <p>
                      Sign in to access your private workspace. Administrators
                      can manage people, applications and server settings from
                      the sidebar.
                    </p>
                    <Button onClick={onSignIn} style={{ marginTop: 14 }}>
                      Sign in to your workspace
                    </Button>
                  </div>
                </div>
              </section>
              <section className="section">
                <div className="section-heading">
                  <h2>Make yourself at home</h2>
                </div>
                <div className="welcome-panel">
                  <AetherIcon name="window" width={32} height={32} />
                  <div>
                    <h3>Open it your way</h3>
                    <p>
                      Bookmark Studio, open an application directly by its
                      address, or add it to your Dock for its own window.
                    </p>
                    <Button
                      onClick={() => setPage("start")}
                      style={{ marginTop: 14 }}
                    >
                      Get started
                    </Button>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <h1>Get started</h1>
                  <p>
                    Your installation is ready. Here’s how to make it part of
                    your day.
                  </p>
                </div>
              </div>
              <div className="getting-started">
                <section className="welcome-panel">
                  <span className="guide-number">1</span>
                  <div>
                    <h3>Sign in to your workspace</h3>
                    <p>
                      Use the account created during setup, or ask your
                      administrator to create one for you.
                    </p>
                    <Button
                      primary
                      onClick={onSignIn}
                      style={{ marginTop: 14 }}
                    >
                      Sign in
                    </Button>
                  </div>
                </section>
                <section className="welcome-panel">
                  <span className="guide-number">2</span>
                  <div>
                    <h3>Open your application</h3>
                    <p>
                      Choose a card on the homepage, or bookmark a direct app
                      address. Studio will ask you to sign in when necessary,
                      then take you to the app.
                    </p>
                    <div className="direct-links">
                      {apps
                        .filter((app) => app.installed)
                        .map((app) => (
                          <a key={app.id} href={app.url}>
                            {location.origin}
                            {app.url} ↗
                          </a>
                        ))}
                    </div>
                  </div>
                </section>
                <section className="welcome-panel">
                  <span className="guide-number">3</span>
                  <div>
                    <h3>Add an app to your Dock</h3>
                    <p>
                      In Safari, open Studio or an application, then choose File
                      → Add to Dock. The host keeps running when the window
                      closes.
                    </p>
                  </div>
                </section>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

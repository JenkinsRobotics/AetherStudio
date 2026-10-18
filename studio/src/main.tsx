import { AgentConsent } from "./AgentConsent";
import { APP_UPDATES } from "./app-updates";
import { PluginLibrary } from "./PluginWindow";
import { DriveAdministration } from "./DriveAdministration";
import { ServerManagement } from "./ServerManagement";
import type { ServerStorage } from "./ServerStoragePanel";
import { ApplicationCard } from "./ApplicationCard";
import { ApplicationArtwork } from "@aether/session/library/ApplicationArtwork";
import { ApplicationWelcome } from "@aether/ui";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  AppIcon,
  AetherIcon,
  Button,
  CollapsibleSidebar,
  SidebarLabel,
  SidebarRow,
  SidebarToggle,
  SelectField,
  StatusDot,
  TextField,
  ThemeMenu,
} from "@aether/ui";
import "@aether/ui/tokens.css";
import "@aether/ui/widgets.css";
import "@aether/session/library/studio.css";
import "./StudioChrome.css";
import { AgentWorkspace } from "./AgentWorkspace";
import { PluginMarketplace } from "./PluginMarketplace";
import { AdministrationPanels } from "./Administration";
import { LibraryHome } from "./LibraryHome";
import { PublicHome } from "./PublicHome";
import { Recovery } from "./Recovery";
import { EmailSettings, type MailSettings } from "./EmailSettings";
import { api } from "@aether/session/library/api";
import { adminPages, personalPages, readStudioRoute, studioRouteURL, type StudioArea } from "./workspace-route";
import {
  SetupWizard,
  SetupComplete,
  SignInFrame,
  type Installation,
} from "./SetupWizard";

export type User = {
  id: string;
  username: string;
  full_name: string;
  email: string;
  email_verified: boolean;
  avatar: string;
  theme: "dark" | "light" | "system";
  theme_id?: string;
  role: string;
  active: boolean;
  must_change: boolean;
};
export type App = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  installed: boolean;
  url: string;
  admin_only: boolean;
  coming_soon?: boolean;
};
type Status = {
  ready: boolean;
  name: string;
  theme?: { base: string; apps: Record<string, string> };
  user: User | null;
  apps: App[];
  installation: Installation | null;
  email_recovery_available: boolean;
};
type Settings = {
  name: string;
  bind_address: string;
  port: number;
  public_url: string;
  tls_cert: string;
  tls_key: string;
};
export type Admin = {
  storage: ServerStorage | null;
  mail: MailSettings | null;
  runtime?: string;
  public_url?: string;
  applications?: App[];
  service_apps?: string[];
  capabilities?: {mail: boolean; network_settings: boolean; backups: boolean; service_accounts: boolean; maintenance: boolean};
  teams: { id: string; name: string; members: string[]; apps: string[] }[];
  access: Record<string, number>;
  services: {
    id: string;
    name: string;
    apps: string[];
    expires: number;
    active: number;
  }[] | null;
  backups: { name: string; size: number; created: number }[] | null;
  users: User[];
  settings: Settings | null;
  running_settings: Settings | null;
  restart_required: boolean;
  uptime_s: number;
  sessions: { username: string; count: number }[];
  audit: {
    id: number;
    time: number;
    actor: string;
    action: string;
    target: string;
  }[];
};
const roles = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Administrator" },
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-heading">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  );
}
function Authentication({
  status,
  refresh,
  report,
  onRecover,
}: {
  onRecover: () => void;
  status: Status;
  refresh: () => Promise<void>;
  report: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api(
        "/api/login",
        Object.fromEntries(new FormData(event.currentTarget)),
      );
      await refresh();
      const next = new URLSearchParams(location.search).get("next");
      const current = await api<Status>("/api/status");
      const destination = next ? new URL(next, location.origin) : null;
      if (
        destination && destination.origin === location.origin &&
        current.apps.some(app => app.enabled && (
          destination.pathname === app.url || destination.pathname === app.url + "index.html"
        )) &&
        !current.user?.must_change
      )
        location.assign(destination.href);
    } catch (e) {
      report((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <SignInFrame>
      <form className="auth-card" onSubmit={submit}>
        <span className="setup-eyebrow">{status.name}</span>
        <h2>Welcome back</h2>
        <p>Sign in to your workspace.</p>
        <Field label="Username or email">
          <TextField
            name="username"
            required
            autoComplete="username"
            maxLength={254}
          />
        </Field>
        <Field label="Password">
          <TextField
            name="password"
            type="password"
            required
            maxLength={256}
            autoComplete="current-password"
          />
        </Field>
        <Button primary type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <Button onClick={onRecover}>Forgot username or password?</Button>
      </form>
    </SignInFrame>
  );
}
function Studio() {
  const [recovery, setRecovery] = useState<string | null>(() => new URLSearchParams(location.hash.slice(1)).get("reset"));
  const [setupComplete, setSetupComplete] = useState(false);
  const [signInMode, setSignInMode] = useState(
    () =>
      new URLSearchParams(location.search).has("next") ||
      new URLSearchParams(location.search).has("signin") ||
      new URLSearchParams(location.search).has("agent-connect"),
  );
  const [status, setStatus] = useState<Status | null>(null);
  const [adminDetails, setAdminDetails] = useState<{ owner: string; revision: number; details: Admin } | null>(null);
  const [route, setRoute] = useState(readStudioRoute);
  const [serviceSecret, setServiceSecret] = useState<{owner: string; value: string} | null>(null);
  const [adminRevision, setAdminRevision] = useState(0);
  const [adminError, setAdminError] = useState("");
  const isAdministration = route.area === "admin" && status?.user?.role === "admin" && !status.user.must_change;
  useEffect(() => { setServiceSecret(null); }, [isAdministration, route.page, status?.user?.id]);
  const needsAdminDetails = isAdministration && route.page !== "organizations";
  const admin = isAdministration && adminDetails?.owner === status?.user?.id && adminDetails?.revision === adminRevision ? adminDetails.details : null;
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [editUser, setEditUser] = useState<User | null>(null);
  const [network, setNetwork] = useState<Settings | null>(null);
  const refresh = async () => {
    const current = await api<Status>("/api/status");
    setStatus(current);
    setAdminRevision(revision => revision + 1);
  };
  useEffect(() => {
    const restore = () => {
      setRoute(readStudioRoute());
      setQuery(""); setError(""); setNotice(""); setEditUser(null);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    let active = true;
    setAdminDetails(null); setNetwork(null); setAdminError("");
    if (location.pathname === "/" && needsAdminDetails) {
      void api<Admin>("/api/admin/state").then(details => {
        if (active) { setAdminDetails({ owner: status!.user!.id, revision: adminRevision, details }); setNetwork(details.settings); }
      }).catch((e: Error) => { if (active) setAdminError(e.message); });
    }
    return () => { active = false; };
  }, [needsAdminDetails, status?.user?.id, adminRevision]);
  useEffect(() => {
    refresh().catch((e: Error) => setError(e.message));
    const sync = (event: Event) => {
      const user = (event as CustomEvent<User | null>).detail;
      setStatus(current => current ? {...current, user} : current);
    };
    document.addEventListener("aether-account", sync);
    return () => document.removeEventListener("aether-account", sync);
  }, []);
  const run = async (path: string, body: object, message: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ warning?: string }>(path, body);
      await refresh();
      setNotice(result.warning || message);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const navigate = (id: string, area: StudioArea = route.area) => {
    const next = { area, page: id };
    history.pushState(null, "", studioRouteURL(next));
    setRoute(next);
    setQuery("");
    setError("");
    setNotice("");
    setEditUser(null);
  };
  const report = (message: string) => {
    setError(message);
    setNotice("");
  };
  const banners = (
    <div className="messages" aria-live="polite">
      {error && (
        <div role="alert" className="message error">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="message">
          {notice}
          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
  if (!status)
    return (
      <div className="studio aether-home-theme">
        <div className="auth">
          <h1>Aether Studio</h1>
          {error ? (
            <>
              <p role="alert">{error}</p>
              <Button
                onClick={() => refresh().catch((e: Error) => report(e.message))}
              >
                Retry connection
              </Button>
            </>
          ) : (
            <p>Connecting to your workspace…</p>
          )}
        </div>
      </div>
    );
  if (recovery !== null && status.ready) return <div className="studio aether-home-theme"><Recovery token={recovery} available={status.email_recovery_available} onBack={() => { setRecovery(null); setSignInMode(true); refresh().catch((e: Error) => setError(e.message)); }} /></div>;
  if (!status.ready)
    return (
      <div className="studio aether-home-theme">
        <SetupWizard
          installation={
            status.installation ?? {
              host_ready: true,
              storage_ready: true,
              packages: [],
            }
          }
          refresh={refresh}
          onComplete={() => setSetupComplete(true)}
        />
      </div>
    );
  if (setupComplete && status.user)
    return (
      <div className="studio aether-home-theme">
        <SetupComplete
          name={status.name}
          onContinue={() => setSetupComplete(false)}
        />
      </div>
    );
  if (!status.user && !signInMode)
    return (
      <div className="studio aether-home-theme">
        <PublicHome
          name={status.name}
          apps={status.apps}
          onSignIn={() => setSignInMode(true)}
        />
      </div>
    );
  if (!status.user)
    return (
      <div className="studio aether-home-theme">
        {banners}
        <Authentication status={status} refresh={refresh} report={report} onRecover={() => setRecovery("")} />
      </div>
    );
  const connectionRequest = new URLSearchParams(location.search).get("agent-connect");
  if (connectionRequest && !status.user.must_change) return <AgentConsent request={connectionRequest} username={status.user.username}/>;
  const agentApp = new URLSearchParams(location.search).get("agent");
  const pluginApp = new URLSearchParams(location.search).get("pluginApp");
  if (pluginApp && status.apps.some(app => app.id === pluginApp && app.enabled) && !status.user.must_change) return <div className="plugin-embedded-page"><PluginLibrary app={pluginApp} canManage={status.user.role === "admin"}/></div>;
  if (agentApp && status.apps.some(app => app.id === agentApp) && !status.user.must_change) return <AgentWorkspace app={agentApp}/>;
  const homeApp = new URLSearchParams(location.search).get("home");
  if ((homeApp === 'io' || homeApp === 'sketch') && status.apps.some(app => app.id === homeApp && app.enabled) && !status.user.must_change) return <LibraryHome workspace={status.name} app={homeApp}/>;
  if (location.pathname === "/cad/" && !status.user.must_change) return <LibraryHome workspace={status.name} />;
  if (location.pathname === "/animation/" && !status.user.must_change) return <LibraryHome workspace={status.name} app="animation" />;
  if (location.pathname === "/map/" && !status.user.must_change) return <LibraryHome workspace={status.name} app="map" />;
  const user = status.user;
  const isAdmin = user.role === "admin" && !user.must_change;
  const navigation: { id: string; label: string; icon: ReactNode; badge?: string }[] = [
    { id: "overview", label: "Overview", icon: <AetherIcon name="home" /> },
    { id: "server", label: "Server management", icon: <AetherIcon name="hardware" /> },
    ...(!user.must_change
      ? [
          { id: "home", label: "Home", icon: <AetherIcon name="home" /> },
          { id: "plugins", label: "Plugins", icon: <AetherIcon name="items" /> },
          {
            id: "apps",
            label: "Applications",
            icon: <AetherIcon name="items" />,
          },
        ]
      : []),
    ...(isAdmin
      ? [
          { id: "organizations", label: "Organizations & workspaces", icon: <AetherIcon name="folder" /> },
          { id: "users", label: "Users", icon: <AetherIcon name="assembly" /> },
          { id: "email", label: "Email delivery", icon: <AetherIcon name="document" /> },
          { id: "teams", label: "Teams", icon: <AetherIcon name="assembly" /> },
          {
            id: "access",
            label: "Roles & permissions",
            icon: <AetherIcon name="mate" />,
          },
          {
            id: "services",
            label: "Service accounts",
            icon: <AetherIcon name="hardware" />,
          },
          { id: "backups", label: "Backups", icon: <AetherIcon name="save" /> },
          { id: "themes", label: "Appearance", icon: <AetherIcon name="appearance" /> },
          {
            id: "network",
            label: "Server & network",
            icon: <AetherIcon name="settings" />,
          },
          {
            id: "activity",
            label: "Activity",
            icon: <AetherIcon name="history" />,
          },
        ]
      : []),
    {
      id: "account",
      label: "My account",
      icon: <AetherIcon name="document" />,
    },
  ];
  const visiblePage = user.must_change ? "account" : route.area === "admin" && !isAdmin ? "denied" : route.page;
  const visibleNavigation = navigation.filter(item => user.must_change ? item.id === "account" : (isAdministration ? adminPages : personalPages).includes(item.id));
  const submitUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (
      await run(
        "/api/admin/users",
        Object.fromEntries(new FormData(form)),
        "Account created. Share the temporary password with the user; they must change it at first sign-in.",
      )
    )
      form.reset();
  };
  const passwordForm = (
    <form
      className="form"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        if (data.password !== data.confirm) {
          report("Passwords do not match.");
          return;
        }
        await run(
          "/api/password",
          data,
          "Password changed. Sign in again with your new password.",
        );
      }}
    >
      <Field label="Current password">
        <TextField
          name="current_password"
          type="password"
          required
          autoComplete="current-password"
        />
      </Field>
      <Field label="New password">
        <TextField
          name="password"
          type="password"
          minLength={12}
          maxLength={256}
          required
          autoComplete="new-password"
        />
      </Field>
      <Field label="Confirm new password">
        <TextField
          name="confirm"
          type="password"
          minLength={12}
          required
          autoComplete="new-password"
        />
      </Field>
      <Button type="submit" primary disabled={busy}>
        Change password
      </Button>
    </form>
  );
  return (
    <div className="studio aether-home-theme" data-workspace={isAdministration ? "admin" : "personal"}>
      <CollapsibleSidebar id="studio-nav" ariaLabel="Studio sidebar" className="studio-sidebar aui-application-sidebar" toggle="custom">
        <div className="workspace-identity">
          <span className="workspace-avatar">
            <AppIcon app="studio" size={34} />
          </span>
          <SidebarLabel>
            <strong>{status.name}</strong>
            <small>
              {isAdministration ? "Administration workspace" : "Personal workspace"}
            </small>
          </SidebarLabel>
        </div>
        <div className="aui-application-sidebar-user"><SidebarLabel>{user.full_name || user.username}</SidebarLabel><SidebarToggle /></div>
        <div className="sidebar-search">
          <TextField
            aria-label="Search navigation"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="nav-heading">
          <SidebarLabel>{isAdministration ? "Administration" : "Workspace"}</SidebarLabel>
        </div>
        <nav aria-label="Studio navigation">
          {visibleNavigation
            .filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
            .map((item) => (
              <SidebarRow key={item.id} item={{id:item.id,label:item.label,icon:item.icon,badge:item.badge,current:visiblePage === item.id,onSelect:()=>navigate(item.id,isAdministration ? "admin" : "personal")}}/>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <ThemeMenu />
          {isAdmin && <Button onClick={() => navigate(isAdministration ? "home" : "overview", isAdministration ? "personal" : "admin")} title={isAdministration ? "Back to my workspace" : "Open administration"}>
            <AetherIcon name={isAdministration ? "home" : "settings"} />
            <SidebarLabel>{isAdministration ? "Back to my workspace" : "Open administration"}</SidebarLabel>
          </Button>}
          <HostLabel />
          <button className="profile" title={user.full_name || user.username} onClick={() => navigate("account", "personal")}>
            {user.avatar ? <img className="avatar" src={user.avatar} alt="" style={{objectFit:"cover"}} /> : <span className="avatar">{(user.full_name || user.username)[0].toUpperCase()}</span>}
            <SidebarLabel>
              <strong>{user.full_name || user.username}</strong>
              <small>
                {user.role === "admin" ? "Administrator" : "Member"}
              </small>
            </SidebarLabel>
          </button>
          <Button
            onClick={() => run("/api/logout", {}, "Signed out.")}
            disabled={busy}
          >
            Sign out
          </Button>
        </div>
      </CollapsibleSidebar>
      <div className="studio-body">
        <main className="studio-content">
          {banners}
          {visiblePage === "denied" && <Section title="Administration access required">
            <p>This workspace is available to administrators. Your personal workspace is still available.</p>
            <Button primary onClick={() => navigate("home", "personal")}>Back to my workspace</Button>
          </Section>}
          {needsAdminDetails && !admin && <Section title="Administration">
            {adminError ? <><p role="alert">{adminError}</p><Button onClick={() => void refresh().catch((e: Error) => report(e.message))}>Retry</Button></> : <p role="status">Loading administration…</p>}
          </Section>}
          {visiblePage === "organizations" && isAdministration && <DriveAdministration />}
          {visiblePage === "server" && admin && (admin.capabilities?.maintenance === false ? <Section title="Native Studio server"><p>The Rust host is running at {admin.public_url}. Installation maintenance is managed from the server console while its browser controls are being migrated.</p></Section> : <ServerManagement onNavigate={navigate} />)}
          {visiblePage === "overview" && admin && <>
            <div className="page-heading"><div><h1>Aether Studio Admin Center</h1><p>Manage users, application access, and this Aether Studio installation.</p></div><span className="badge">Administrator access</span></div>
            <Section title="Installation overview"><div className="overview-grid">
              <div className="summary-card"><AetherIcon name="assembly" /><strong>{admin.users.filter(u => u.active).length}</strong><span>Active users</span></div>
              <div className="summary-card"><AetherIcon name="items" /><strong>{(admin.applications ?? status.apps).filter(app => app.enabled).length}</strong><span>Enabled applications</span></div>
              <div className="summary-card"><AetherIcon name="hardware" /><strong>{Math.floor(admin.uptime_s / 60)} min</strong><span>Host uptime</span></div>
            </div></Section>
            <Section title="Team server">
              {admin.running_settings && <p>{admin.running_settings.bind_address === "127.0.0.1" ? "This server currently accepts connections from this device only. Configure HTTPS in Server settings to connect other team members." : `Team address: ${admin.running_settings.public_url}`}</p>}
              {admin.storage && <><p>Data folder: <code style={{ overflowWrap: "anywhere" }}>{admin.storage.data_directory}</code></p>
              <p>{admin.storage.interval_hours ? `Automatic backups every ${admin.storage.interval_hours} hours.` : "Automatic backups are disabled."} {admin.storage.error}</p></>}
              <div className="actions"><Button onClick={() => navigate("network")}>Set up team access</Button><Button onClick={() => navigate("backups")}>Manage backups</Button><Button onClick={() => navigate("organizations")}>Manage organizations & workspaces</Button></div>
              <p>Document history is always enabled. Saves are recovery history; named versions and branches are deliberate actions. No Git setup is required.</p>
              <p className="hint">Create server accounts in Users, then assign organization and workspace membership in Organizations & workspaces. Application teams control access to apps; Drive memberships control access to files.</p>
            </Section>
            <Section title="Manage your installation"><div className="actions">
              <Button onClick={() => navigate("users")}>Manage users</Button><Button onClick={() => navigate("apps")}>Manage applications</Button><Button onClick={() => navigate("plugins")}>Manage plugins</Button><Button onClick={() => navigate("network")}>Server settings</Button>
            </div><p>Changes here affect the installation. Your account, creative applications, and agent sign-ins live in your personal workspace.</p></Section>
          </>}
          {visiblePage === "home" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Your workspace, together.</h1>
                  <p>Open your creative tools and manage your personal account.</p>
                </div>
                <span className="page-heading-tools">
                  <span className="badge">
                    <StatusDot kind="ok" /> Online
                  </span>
                  <Button
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      refresh()
                        .catch((e: Error) => report(e.message))
                        .finally(() => setBusy(false));
                    }}
                    aria-label="Refresh server status"
                  >
                    <AetherIcon name="history" />
                  </Button>
                </span>
              </div>
              <ApplicationWelcome updates={APP_UPDATES.studio} id="studio-welcome" name="Aether Studio" description="Your creative applications, together in one workspace." artwork={<ApplicationArtwork app="studio" />} />
              <Section title="Your applications">
                <div className="application-grid">
                  {status.apps
                    .filter((app) => app.enabled)
                    .map((app) => (
                      <ApplicationCard key={app.id} app={app} />
                    ))}
                </div>
                {!status.apps.some((app) => app.enabled) && (
                  <div className="empty">
                    No applications are enabled.{" "}
                    {isAdmin
                      ? "Open administration to enable an application."
                      : "Ask your administrator to enable an application."}
                  </div>
                )}
              </Section>
              <Section title="Workspace overview">
                <div className="overview-grid">
                  <div className="summary-card">
                    <AetherIcon name="items" />
                    <strong>
                      {
                        status.apps.filter(
                          (app) => app.enabled && app.installed,
                        ).length
                      }
                    </strong>
                    <span>Available applications</span>
                  </div>
                  <div className="summary-card">
                    <AetherIcon name="assembly" />
                    <strong>Private</strong>
                    <span>Your workspace storage</span>
                  </div>
                  <div className="summary-card">
                    <AetherIcon name="hardware" />
                    <strong>Connected</strong>
                    <span>Host connection</span>
                  </div>
                </div>
              </Section>
              <Section title="Make it yours">
                <div className="welcome-panel">
                  <AetherIcon name="window" width={32} height={32} />
                  <div>
                    <h3>Your apps, one click away</h3>
                    <p>
                      Open an application in Safari, then choose File → Add to
                      Dock. The Aether host stays running when you close the
                      window.
                    </p>
                  </div>
                </div>
              </Section>
            </>
          )}
          {visiblePage === "apps" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Applications</h1>
                  <p>
                    {isAdministration
                      ? "Choose the tools available on this installation."
                      : "Tools enabled by your administrator."}
                  </p>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Application</th>
                      <th>Package</th>
                      <th>Access</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(admin?.applications ?? status.apps).filter(app => isAdministration || app.enabled).map((app) => (
                      <tr key={app.id}>
                        <td>
                          <div className="table-name">
                            <AppIcon app={app.id} size={30} />
                            <div>
                              <strong>{app.name}</strong>
                              <small>{app.description}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          {app.installed ? "Installed" : "Build required"}
                        </td>
                        <td>
                          {app.admin_only
                            ? "Administrators"
                            : "All signed-in users"}
                        </td>
                        <td>
                          <div className="actions">
                            {app.enabled && app.installed && (
                              <a className="text-link" href={app.url}>
                                Open ↗
                              </a>
                            )}
                            {isAdministration && (
                              <Button
                                active={app.enabled}
                                disabled={
                                  busy || (!app.installed && !app.enabled)
                                }
                                onClick={() =>
                                  run(
                                    "/api/admin/apps",
                                    { id: app.id, enabled: !app.enabled },
                                    `${app.name} ${app.enabled ? "disabled" : "enabled"}.`,
                                  )
                                }
                              >
                                {app.enabled ? "Disable" : "Enable"}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {isAdministration && <p className="hint">
                Enablement controls both application pages and backend access.
                Existing work is kept when an app is disabled.
              </p>}
            </>
          )}
          {visiblePage === "users" && admin && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Users & access</h1>
                  <p>Manage local accounts, permissions and sign-ins.</p>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Sessions</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {admin.users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.full_name || u.username}</strong><small style={{display:"block"}}>{u.username}{u.email ? ` · ${u.email}` : " · Email not added"}</small>
                          {u.id === user.id && <small> You</small>}
                        </td>
                        <td>
                          {u.role === "admin" ? "Administrator" : "Member"}
                        </td>
                        <td>
                          {!u.active
                            ? "Disabled"
                            : u.must_change
                              ? "Password change required"
                              : "Active"}
                        </td>
                        <td>
                          {admin.sessions.find((s) => s.username === u.username)
                            ?.count ?? 0}
                        </td>
                        <td>
                          <Button onClick={() => setEditUser(u)}>Manage</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {editUser && (
                <Section title={`Manage ${editUser.username}`}>
                  <form
                    key={editUser.id}
                    className="form inline-form"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const values = Object.fromEntries(
                        new FormData(event.currentTarget),
                      );
                      if (
                        await run(
                          "/api/admin/user",
                          {
                            id: editUser.id,
                            action: "update",
                            role: values.role,
                            active: values.active === "true",
                          },
                          "Account updated; existing sessions revoked.",
                        )
                      )
                        setEditUser(null);
                    }}
                  >
                    <Field label="Role">
                      <SelectField
                        name="role"
                        defaultValue={editUser.role}
                        options={roles}
                      />
                    </Field>
                    <Field label="Account status">
                      <SelectField
                        name="active"
                        defaultValue={editUser.active ? "true" : "false"}
                        options={[
                          { value: "true", label: "Active" },
                          { value: "false", label: "Disabled" },
                        ]}
                      />
                    </Field>
                    <Button primary type="submit" disabled={busy}>
                      Save access
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        run(
                          "/api/admin/user",
                          { id: editUser.id, action: "revoke_sessions" },
                          "All sessions revoked.",
                        )
                      }
                    >
                      Revoke sign-ins
                    </Button>
                    <Button onClick={() => setEditUser(null)}>Close</Button>
                  </form>
                  <form className="form inline-form" key={editUser.id + "identity"} onSubmit={async e => { e.preventDefault(); if(await run("/api/admin/user", { id: editUser.id, action: "identity", ...Object.fromEntries(new FormData(e.currentTarget)) }, "User details updated."))setEditUser(null); }}><Field label="Full name"><TextField name="full_name" defaultValue={editUser.full_name} required maxLength={120} /></Field><Field label="Email address"><TextField name="email" type="email" defaultValue={editUser.email} required maxLength={254} /></Field><Button type="submit" disabled={busy}>Save user details</Button></form>
                  {editUser.id !== user.id && (
                    <form
                      className="form inline-form"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        const form = event.currentTarget;
                        const values = Object.fromEntries(new FormData(form));
                        if (
                          await run(
                            "/api/admin/user",
                            {
                              id: editUser.id,
                              action: "reset_password",
                              password: values.password,
                            },
                            "Password reset. The user must change this temporary password at sign-in.",
                          )
                        )
                          form.reset();
                      }}
                    >
                      <Field label="New temporary password">
                        <TextField
                          name="password"
                          type="password"
                          required
                          minLength={12}
                          maxLength={256}
                          autoComplete="new-password"
                        />
                      </Field>
                      <Button type="submit" disabled={busy}>
                        Reset password
                      </Button>
                    </form>
                  )}
                </Section>
              )}
              <Section
                title="Add a user"
                description="New users must change their temporary password at first sign-in."
              >
                <form className="form inline-form" onSubmit={submitUser}>
                  <Field label="Full name"><TextField name="full_name" required maxLength={120} autoComplete="off" /></Field>
                  <Field label="Email address"><TextField name="email" type="email" required maxLength={254} autoComplete="off" /></Field>
                  <Field label="Username">
                    <TextField
                      name="username"
                      required
                      minLength={2}
                      maxLength={64}
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Temporary password">
                    <TextField
                      name="password"
                      type="password"
                      minLength={12}
                      maxLength={256}
                      required
                      autoComplete="new-password"
                    />
                  </Field>
                  <Field label="Role">
                    <SelectField name="role" options={roles} />
                  </Field>
                  <Button primary type="submit" disabled={busy}>
                    Create user
                  </Button>
                </form>
              </Section>
            </>
          )}
          {visiblePage === "network" && admin?.capabilities?.network_settings === false && <Section title="Server & network"><p>Current address: {admin.public_url}</p><p>Listener and HTTPS configuration are managed by the server operator. Browser network changes and restart controls are still being migrated.</p></Section>}
          {visiblePage === "network" && admin && network && admin.running_settings && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Server & network</h1>
                  <p>Configure where your Aether installation is available.</p>
                </div>
              </div>
              <div className="connection-strip">
                <StatusDot kind="ok" />
                <span>
                  Currently serving at{" "}
                  <strong>{admin.running_settings.public_url}</strong>
                </span>
              </div>
              <Section
                title="Connection settings"
                description="Use 127.0.0.1 for this device only, or 0.0.0.0 to listen on your network. Network access requires HTTPS."
              >
                <form
                  className="form network-form"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    await run(
                      "/api/admin/settings",
                      network,
                      "Settings saved. Restart the host to apply connection changes.",
                    );
                  }}
                >
                  <Field label="Workspace name">
                    <TextField
                      value={network.name}
                      required
                      maxLength={80}
                      onChange={(e) =>
                        setNetwork({ ...network, name: e.target.value })
                      }
                    />
                  </Field>
                  <div className="form-row">
                    <Field label="Bind address">
                      <TextField
                        value={network.bind_address}
                        required
                        onChange={(e) =>
                          setNetwork({
                            ...network,
                            bind_address: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Port">
                      <TextField
                        type="number"
                        min={1024}
                        max={65535}
                        value={network.port}
                        required
                        onChange={(e) =>
                          setNetwork({
                            ...network,
                            port: Number(e.target.value),
                          })
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Public URL">
                    <TextField
                      type="url"
                      value={network.public_url}
                      required
                      onChange={(e) =>
                        setNetwork({ ...network, public_url: e.target.value })
                      }
                    />
                    <small>
                      The address your devices will open, including the port.
                    </small>
                  </Field>
                  <Field label="TLS certificate file">
                    <TextField
                      value={network.tls_cert}
                      placeholder="/path/on/host/certificate.pem"
                      onChange={(e) =>
                        setNetwork({ ...network, tls_cert: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="TLS private key file">
                    <TextField
                      value={network.tls_key}
                      placeholder="/path/on/host/private-key.pem"
                      onChange={(e) =>
                        setNetwork({ ...network, tls_key: e.target.value })
                      }
                    />
                    <small>
                      Paths refer to files on the host. Leave both blank for
                      local HTTP.
                      {admin.runtime === "rust" && " Choose certificates from the directory configured by your server operator. When changing the bind address, choose a free port so the replacement listener can be checked before the current one stops."}
                    </small>
                  </Field>
                  <Button primary type="submit" disabled={busy}>
                    Save settings
                  </Button>
                </form>
              </Section>
              <Section title="Connect your on-site team">
                <ol>
                  <li>Use aether-studio as the server name under your organization’s DNS domain. Reserve its IP address on your router and point that DNS record to this server.</li>
                  {admin.runtime === "rust" ? <li>Ask your server operator to install a certificate for this hostname and its private key in Studio’s configured certificate directory. Team devices must trust its issuing authority.</li> : <><li>Use your organization’s TLS certificate, or generate one on the server: <code>python -m core.host certificate --hostname aether-studio.example.com --ip 192.168.1.20</code>. Replace both examples with your server’s actual address.</li><li>For a generated certificate, trust its <code>ca.pem</code> on each team device. Keep both private keys on the server.</li></>}
                  <li>Set bind address to <code>0.0.0.0</code>, enter the HTTPS URL and certificate paths, save, then restart. Allow the selected port through the server firewall for your local network.</li>
                  <li>Open that URL from a second device and sign in with a member account. Keep this server awake while your team works.</li>
                </ol>
                <p className="hint">For a small Bonjour-enabled network, aether-studio.local can be configured as the Mac’s Local Hostname in System Settings → General → Sharing. Managed DNS works across office network segments and devices without relying on Bonjour.</p>
                <p className="hint">Back up certificate files separately and renew them before expiry. No router port forwarding is needed for an on-site team.</p>
              </Section>
              {admin.restart_required && (
                <div className="restart-panel">
                  <h3>Restart required</h3>
                  <p>
                    {admin.runtime === "rust" ? "Studio will drain active connections and restart its network listener. Saved files, accounts and engine sessions are kept." : "Save open work before restarting. Engine sessions will be cleared; saved files and accounts are kept."}
                  </p>
                  <Button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const result = await api<{ url: string }>(
                          "/api/admin/restart",
                          {},
                        );
                        setNotice(
                          `Host restarting. Reconnect at ${result.url}`,
                        );
                        setTimeout(() => location.assign(result.url), 2500);
                      } catch (e) {
                        report((e as Error).message);
                        setBusy(false);
                      }
                    }}
                  >
                    Restart host and reconnect
                  </Button>
                </div>
              )}
            </>
          )}
          {visiblePage === "themes" && admin && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Appearance</h1>
                  <p>Workspace themes for every member. Every theme includes light and dark modes.</p>
                </div>
              </div>
              <Section title="Workspace theme" description="Applied to everyone and every application unless overridden. Installed themes live in core/assets/themes.">
                <form className="form" key={JSON.stringify(status.theme ?? {})} onSubmit={async (e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  const apps: Record<string, string> = {};
                  for (const id of ["studio", ...status.apps.map(app => app.id)]) {
                    const value = String(form.get("app-" + id) ?? "").trim();
                    if (value) apps[id] = value;
                  }
                  await run("/api/admin/theme", { base: String(form.get("base") ?? ""), apps }, "Workspace theme updated.");
                }}>
                  <Field label="Base theme id"><TextField name="base" defaultValue={status.theme?.base ?? "aether-default"} required maxLength={64} /></Field>
                  {[{ id: "studio", name: "Aether Studio" }, ...status.apps].map(({ id, name }) => (
                    <Field key={id} label={name + " override"}>
                      <TextField name={"app-" + id} placeholder="Inherit base theme" defaultValue={status.theme?.apps?.[id] ?? ""} maxLength={64} />
                    </Field>
                  ))}
                  <Button type="submit" primary disabled={busy}>Save workspace theme</Button>
                </form>
                <p className="hint" style={{ marginTop: 12 }}>Precedence: a member's personal theme, then the application override, then the base. "aether-default" is the built-in theme.</p>
              </Section>
            </>
          )}
          {visiblePage === "activity" && admin && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Activity</h1>
                  <p>
                    Recent sign-ins and administrative changes on this server.
                  </p>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admin.audit.map((entry) => (
                      <tr key={entry.id}>
                        <td>{new Date(entry.time * 1000).toLocaleString()}</td>
                        <td>{entry.actor}</td>
                        <td>{entry.action.replaceAll("_", " ")}</td>
                        <td>{entry.target || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {visiblePage === "plugins" && <PluginMarketplace key={route.area} admin={isAdministration} canManage={status.user.role === "admin"}/>}
          {admin && (
            <AdministrationPanels
              secret={serviceSecret?.owner === user.id ? serviceSecret.value : ""}
              setSecret={value => setServiceSecret(value ? {owner: user.id, value} : null)}
              page={visiblePage}
              apps={admin.applications ?? status.apps}
              admin={admin}
              run={run}
              refresh={refresh}
              report={report}
              busy={busy}
            />
          )}
          {visiblePage === "email" && admin && (admin.mail ? <EmailSettings key={JSON.stringify(admin.mail)} settings={admin.mail} publicURL={admin.public_url ?? admin.running_settings?.public_url ?? location.origin} run={run} busy={busy} /> : <Section title="Email delivery"><p>The server operator must configure private mail credential storage before enabling email delivery.</p></Section>)}
          {visiblePage === "account" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>My account</h1>
                  <p>
                    Signed in as {user.username} ·{" "}
                    {user.role === "admin" ? "Administrator" : "Member"}
                  </p>
                </div>
              </div>
              {Boolean(user.must_change) && (
                <div className="restart-panel">
                  Change your temporary password to finish setting up your
                  account.
                </div>
              )}
              {!user.must_change && <Section title="Personal details" description="Your full name appears in the workspace. Use your email address or username to sign in."><form className="form" key={user.email + user.full_name} onSubmit={async e => {e.preventDefault();await run("/api/profile",Object.fromEntries(new FormData(e.currentTarget)),"Account details updated.");}}><Field label="Full name"><TextField name="full_name" defaultValue={user.full_name} autoComplete="name" required maxLength={120} /></Field><Field label="Email address"><TextField name="email" type="email" defaultValue={user.email} autoComplete="email" required maxLength={254} /></Field><Field label="Current password to save details"><TextField name="current_password" type="password" autoComplete="current-password" required /></Field><Button type="submit" primary disabled={busy}>Save personal details</Button></form><p className="hint" style={{marginTop:12}}>{status.email_recovery_available ? "Email recovery is available. A recovery link verifies access to your mailbox when used." : "Email recovery becomes available after an administrator configures Email delivery."}</p></Section>}
              {!user.must_change && <Section title="Profile picture" description="Shown beside your name across the suite. PNG or JPEG up to 256 KB.">
                <div className="account-picture-row">
                  {user.avatar ? <img className="account-picture" src={user.avatar} alt="" /> : <span className="account-picture account-picture-initial">{(user.full_name || user.username).slice(0, 1).toUpperCase()}</span>}
                  <div className="account-picture-actions">
                    <input id="account-picture-input" type="file" accept="image/png,image/jpeg" hidden onChange={async (event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      if (!file) return;
                      if (file.size > 262144) { setError("Choose a PNG or JPEG smaller than 256 KB."); return; }
                      const reader = new FileReader();
                      reader.onload = () => { void run("/api/preferences", { avatar: reader.result }, "Profile picture updated."); };
                      reader.readAsDataURL(file);
                    }} />
                    <Button disabled={busy} onClick={() => document.getElementById("account-picture-input")?.click()}>Choose picture…</Button>
                    {user.avatar ? <Button disabled={busy} onClick={() => void run("/api/preferences", { avatar: "" }, "Profile picture removed.")}>Remove picture</Button> : null}
                  </div>
                </div>
              </Section>}
              {!user.must_change && <Section title="Theme" description="Override the workspace theme for your account. Leave empty to follow the workspace. Applies on every device you sign in from.">
                <form className="form" key={user.theme_id ?? ""} onSubmit={async (e) => {
                  e.preventDefault();
                  await run("/api/preferences", { theme_id: String(new FormData(e.currentTarget).get("theme_id") ?? "").trim() }, "Theme updated.");
                }}>
                  <Field label="Personal theme id"><TextField name="theme_id" placeholder="Follow workspace theme" defaultValue={user.theme_id ?? ""} maxLength={64} /></Field>
                  <Button type="submit" primary disabled={busy}>Save theme</Button>
                </form>
              </Section>}
              <Section
                title="Change password"
                description="Changing your password signs you out on every device."
              >
                {passwordForm}
              </Section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
type Connection = { kind: "ok" | "warn" | "error" | "busy"; label: string };

/** How often the sidebar re-checks the server. Cheap against a local host. */
const CONNECTION_POLL_MS = 15000;

/**
 * What the dot means. Only states the host actually reports: reachable and
 * ready, reachable but incompletely set up or unable to write its storage, or
 * not reachable at all. Nothing here invents a health signal the server does
 * not send.
 */
function readConnection(status: Status): Connection {
  if (!status.ready) return { kind: "warn", label: "Connected — setup is not finished" };
  if (status.installation && status.installation.storage_ready === false)
    return { kind: "warn", label: "Connected — the server cannot write its storage" };
  return { kind: "ok", label: "Connected to the server" };
}

/**
 * Live server health for the Studio sidebar.
 */
function useConnection(): { connection: Connection; status: Status | null } {
  const [status, setStatus] = useState<Status | null>(null);
  const [connection, setConnection] = useState<Connection>({
    kind: "busy",
    label: "Connecting to the server…",
  });

  useEffect(() => {
    let live = true;
    const check = () =>
      api<Status>("/api/status")
        .then((next) => {
          if (!live) return;
          setStatus(next);
          setConnection(readConnection(next));
        })
        .catch(() => {
          if (!live) return;
          setConnection({ kind: "error", label: "Cannot reach the server" });
        });

    void check();
    const timer = setInterval(check, CONNECTION_POLL_MS);
    // Recover promptly after a sleep or a dropped network rather than waiting
    // out the interval.
    const wake = () => void check();
    addEventListener("online", wake);
    addEventListener("offline", wake);
    document.addEventListener("visibilitychange", wake);

    const sync = (event: Event) => {
      const user = (event as CustomEvent<User | null>).detail;
      setStatus((current) => (current ? { ...current, user } : current));
    };
    document.addEventListener("aether-account", sync);
    return () => {
      live = false;
      clearInterval(timer);
      removeEventListener("online", wake);
      removeEventListener("offline", wake);
      document.removeEventListener("visibilitychange", wake);
      document.removeEventListener("aether-account", sync);
    };
  }, []);

  return { connection, status };
}

/** The sidebar's server indicator. It used to be a hardcoded green dot that
 *  said "connected" whether or not it was. */
function HostLabel() {
  const { connection } = useConnection();
  return (
    <div className="host-label" role="status" aria-live="polite" title={connection.label}>
      <StatusDot kind={connection.kind} /> {connection.label}
    </div>
  );
}

const agentEmbed = new URLSearchParams(location.search).has("agent");
document.body.classList.toggle("studio-agent-embed", agentEmbed);
createRoot(document.getElementById("root")!).render(<Studio />);

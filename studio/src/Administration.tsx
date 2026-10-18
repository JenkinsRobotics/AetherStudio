import { ServerStoragePanel } from "./ServerStoragePanel";
import { useEffect, useState } from "react";
import { AetherIcon, Button, Checkbox, TextField } from "@aether/ui";
import type { Admin, App } from "./main";
import { api } from "@aether/session/library/api";

type Props = {
  page: string;
  admin: Admin;
  apps: App[];
  busy: boolean;
  run: (path: string, data: object, message: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  report: (message: string) => void;
  secret: string;
  setSecret: (value: string) => void;
};
export function AdministrationPanels({
  page,
  admin,
  apps,
  busy,
  run,
  refresh,
  report, secret, setSecret,
}: Props) {
  const memberApps = apps.filter(app => !app.admin_only);
  const [team, setTeam] = useState<Admin["teams"][number] | null>(null);
  const [working, setWorking] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  useEffect(() => {
    if (page !== "backups" || !admin.storage?.in_progress) return;
    const timer = window.setTimeout(() => { void refresh().catch((error: Error) => report(error.message)); }, 2000);
    return () => window.clearTimeout(timer);
  }, [page, admin.storage?.in_progress, refresh, report]);
  if (page === "teams")
    return (
      <>
        <div className="page-heading">
          <div>
            <h1>Teams</h1>
            <p>
              Group users and grant access to applications with restricted
              access.
            </p>
          </div>
          <Button
            primary
            onClick={() => setTeam({ id: "", name: "", members: [], apps: [] })}
          >
            Create team
          </Button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Team</th>
                <th>Members</th>
                <th>Application grants</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {admin.teams.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.members.length}</td>
                  <td>{item.apps.join(", ") || "None"}</td>
                  <td>
                    <Button onClick={() => setTeam(item)}>Edit team</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!admin.teams.length && (
            <div className="empty">
              No teams yet. Create one to manage application access for a group.
            </div>
          )}
        </div>
        {team && (
          <form
            className="form team-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (await run("/api/admin/team", team, "Team saved."))
                setTeam(null);
            }}
          >
            <h2>{team.id ? "Edit team" : "New team"}</h2>
            <label className="field">
              <span>Team name</span>
              <TextField
                value={team.name}
                onChange={(e) => setTeam({ ...team, name: e.target.value })}
                required
                maxLength={80}
              />
            </label>
            <fieldset>
              <legend>Members</legend>
              {admin.users.map((u) => (
                <Checkbox
                  key={u.id}
                  label={u.username}
                  checked={team.members.includes(u.id)}
                  onChange={(e) =>
                    setTeam({
                      ...team,
                      members: e.target.checked
                        ? [...team.members, u.id]
                        : team.members.filter((id) => id !== u.id),
                    })
                  }
                />
              ))}
            </fieldset>
            <fieldset>
              <legend>Application grants</legend>
              {memberApps.map(({ id, name }) => (
                <Checkbox
                  key={id}
                  label={name}
                  checked={team.apps.includes(id)}
                  onChange={(e) =>
                    setTeam({
                      ...team,
                      apps: e.target.checked
                        ? [...team.apps, id]
                        : team.apps.filter((app) => app !== id),
                    })
                  }
                />
              ))}
            </fieldset>
            <p className="hint">
              Grants are enforced when an application requires team membership
              in Roles & permissions.
            </p>
            <div className="actions">
              <Button primary type="submit" disabled={busy}>
                Save team
              </Button>
              <Button onClick={() => setTeam(null)}>Cancel</Button>
              {team.id && (
                <Button
                  disabled={busy}
                  onClick={async () => {
                    if (confirmation !== team.id) {
                      setConfirmation(team.id);
                      return;
                    }
                    if (
                      await run(
                        "/api/admin/team",
                        { id: team.id, action: "delete" },
                        "Team deleted; membership grants removed.",
                      )
                    ) {
                      setTeam(null);
                      setConfirmation("");
                    }
                  }}
                >
                  {confirmation === team.id
                    ? "Confirm delete team"
                    : "Delete team"}
                </Button>
              )}
            </div>
          </form>
        )}
      </>
    );
  if (page === "access")
    return (
      <>
        <div className="page-heading">
          <div>
            <h1>Roles & permissions</h1>
            <p>Server roles and application access rules.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Role</th>
                <th>Permissions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Administrator</td>
                <td>
                  Manage the server, accounts, teams, backups and enabled
                  applications.
                </td>
              </tr>
              <tr>
                <td>Member</td>
                <td>
                  Open permitted applications, edit personal workspace files and
                  manage their own password.
                </td>
              </tr>
              <tr>
                <td>Service account</td>
                <td>
                  Call explicitly scoped application APIs using a revocable,
                  expiring token. No administration access.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <section className="section">
          <h2>Application access</h2>
          <p className="hint">
            Administrators retain access to enabled apps. Members need a
            matching team grant when restricted access is enabled.
          </p>
          <div className="policy-list">
            {memberApps.map(({ id, name }) => (
              <Checkbox
                key={id}
                label={`${name}: require team membership`}
                description="Uncheck to allow all active members."
                checked={Boolean(admin.access[id])}
                disabled={busy}
                onChange={(e) =>
                  run(
                    "/api/admin/access",
                    { id, restricted: e.target.checked },
                    "Application access policy updated.",
                  )
                }
              />
            ))}
          </div>
        </section>
      </>
    );
  if (page === "services" && !admin.services) return <section className="section"><h2>Service accounts</h2><p>Service-account administration is still being migrated. Existing agent connections remain available through the agent command interface.</p></section>;
  if (page === "services" && admin.services)
    return (
      <>
        <div className="page-heading">
          <div>
            <h1>Service accounts</h1>
            <p>Scoped API access for your scripts and integrations.</p>
          </div>
        </div>
        {secret && (
          <div className="restart-panel">
            <h3>Copy your token now</h3>
            <p>
              This is the only time the complete token is shown. Send it in the
              Authorization: Bearer header.
            </p>
            <TextField
              aria-label="New service account token"
              value={secret}
              readOnly
              onFocus={(e) => e.target.select()}
              style={{ width: "100%" }}
            />
            <Button onClick={() => setSecret("")} style={{ marginTop: 12 }}>
              I have saved this token
            </Button>
          </div>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Applications</th>
                <th>Expires</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {admin.services.map((service) => (
                <tr key={service.id}>
                  <td>{service.name}</td>
                  <td>{service.apps.join(", ")}</td>
                  <td>
                    {new Date(service.expires * 1000).toLocaleDateString()}
                  </td>
                  <td>
                    {service.active && service.expires > Date.now() / 1000
                      ? "Active"
                      : "Revoked / expired"}
                  </td>
                  <td>
                    {Boolean(service.active) && (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          run(
                            "/api/admin/service",
                            { id: service.id, action: "revoke" },
                            "Service token revoked.",
                          )
                        }
                      >
                        Revoke
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form
          className="form team-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            setWorking(true);
            setSecret("");
            try {
              const result = await api<{ token: string }>(
                "/api/admin/service",
                {
                  ...(admin.runtime === "rust" ? {can_write: data.get("write") === "on", can_edit_content: data.get("edit") === "on"} : {}),
                  name: data.get("name"),
                  days: Number(data.get("days")),
                  apps: data.getAll("apps"),
                },
              );
              setSecret(result.token);
              form.reset();
              await refresh();
            } catch (e) {
              report((e as Error).message);
            } finally {
              setWorking(false);
            }
          }}
        >
          <h2>Create a service account</h2>
          {admin.runtime === "rust" && <><p>Use these tokens with the command API or CLI/MCP. Each token uses its creator’s current file permissions. Resetting the creator’s password revokes it.</p><Checkbox name="write" label="Allow document changes and Animation RPC" /><Checkbox name="edit" label="Allow saved content editing (also requires document changes)" /></>}
          <label className="field">
            <span>Name</span>
            <TextField name="name" required maxLength={80} />
          </label>
          <label className="field">
            <span>Expires after (days)</span>
            <TextField
              name="days"
              type="number"
              min={1}
              max={365}
              defaultValue={30}
              required
            />
          </label>
          <fieldset>
            <legend>Application scopes</legend>
            {memberApps.filter(app => !admin.service_apps || admin.service_apps.includes(app.id)).map(app => <Checkbox key={app.id} name="apps" value={app.id} label={app.name} />)}
          </fieldset>
          <Button primary type="submit" disabled={working}>
            Create token
          </Button>
        </form>
      </>
    );
  if (page === "backups" && (!admin.storage || !admin.backups)) return <section className="section"><h2>Backups</h2><p>Browser backup controls are still being migrated. Use the server's verified database and object-store backup procedure until those controls are available.</p></section>;
  if (page === "backups" && admin.storage && admin.backups)
    return (
      <>
        <div className="page-heading">
          <div>
            <h1>Backups</h1>
            <p>Snapshots of accounts, settings and saved workspace files.</p>
          </div>
          <Button
            primary
            disabled={busy || admin.storage.in_progress}
            onClick={() =>
              run("/api/admin/backup", {}, admin.runtime === "rust" ? "Backup started. Its download appears when verification finishes." : "Backup created. Download it below.")
            }
          >
            Create backup
          </Button>
        </div>
        <ServerStoragePanel storage={admin.storage} busy={busy} run={run} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Backup</th>
                <th>Created</th>
                <th>Size</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {admin.backups.map((backup) => (
                <tr key={backup.name}>
                  <td>{backup.name}</td>
                  <td>{new Date(backup.created * 1000).toLocaleString()}</td>
                  <td>{(backup.size / 1024).toFixed(1)} KB</td>
                  <td>
                    <a
                      className="text-link"
                      href={`/api/admin/backups/${backup.name}`}
                      download
                    >
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!admin.backups.length && (
            <div className="empty">No backups yet.</div>
          )}
        </div>
        <div className="welcome-panel">
          <AetherIcon name="save" width={32} height={32} />
          <div>
            <h3>Restore from the host console</h3>
            {admin.runtime === "rust" ? <p>Extract the archive into a new private folder and verify every file against <code>manifest.json</code>. Restore <code>native.sql</code> into an empty PostgreSQL database, then run the native host’s <code>verify-store</code> command against its <code>objects</code> folder before starting it. Restore credentials and operator configuration separately. Follow the native host recovery guide; the Python restore command cannot read this format.</p> : <><p>
              Restore into an empty data directory with the Studio CLI. Existing
              installations are never overwritten. Restore clears sign-ins,
              revokes service tokens and resets the network to local-only
              access.
            </p>
            <code>
              python -m core.host restore --archive backup.zip --data
              /path/to/empty-directory
            </code>
            </>}
            <p className="hint">
              Backups include password hashes and project files; keep them
              private. They exclude browser-local unsaved work, TLS files and
              installed application builds.
            </p>
          </div>
        </div>
      </>
    );
  return null;
}

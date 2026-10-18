import { useState } from "react";
import { ApplicationListHeading, ApplicationListControls, AetherIcon, IconButton } from "@aether/ui";
import type { DriveWorkspace } from "@aether/session/library/drive-api";
import "./DriveWorkspaces.css";

/** The organization directory. File contents remain in the common Drive browser. */
export function DriveWorkspaces({ organizations, workspaces, query, onOpen, onFavorite }: {
  organizations: readonly {id: string; name: string}[]; workspaces: readonly DriveWorkspace[]; query: string;
  onOpen: (workspace: DriveWorkspace) => void;
  onFavorite: (workspace: DriveWorkspace, favorite: boolean) => Promise<void>;
}) {
  const [filter, setFilter] = useState("");
  const [mode, setMode] = useState("all");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const matches = workspaces.filter(workspace =>
    (mode !== "favorites" || workspace.favorite) && (mode !== "recent" || workspace.opened) &&
    [filter, query].every(value => workspace.name.toLocaleLowerCase().includes(value.trim().toLocaleLowerCase()))
  ).sort((a, b) => mode === "recent" ? (b.opened ?? 0) - (a.opened ?? 0) :
    Number(!!b.is_default) - Number(!!a.is_default) || a.name.localeCompare(b.name));
  return <section className="drive-workspace-directory" aria-label="Organization workspaces">
    <ApplicationListHeading description="Browse your organization’s shared workspaces across all apps.">Workspaces</ApplicationListHeading>
    <ApplicationListControls filters={
      <div className="aui-file-type-filters" role="group" aria-label="Filter workspaces">
        <button type="button" aria-pressed={mode === "all"} onClick={() => setMode("all")}>All</button>
        <button type="button" aria-pressed={mode === "recent"} onClick={() => setMode("recent")}><AetherIcon name="history" />Recent</button>
        <button type="button" aria-pressed={mode === "favorites"} onClick={() => setMode("favorites")}><AetherIcon name="star" />Favorites</button>
      </div>} search={<input className="library-name-filter" aria-label="Filter workspaces by name" placeholder="Filter by name"
        value={filter} onChange={event => setFilter(event.target.value)} />}/>
    {error && <p role="alert">{error}</p>}
    {organizations.map(organization => <section key={organization.id} aria-label={`${organization.name} workspaces`}>
      <h3 className="drive-organization-heading">{organization.name}</h3>
      <div className="drive-workspace-cards">
      {matches.filter(workspace => workspace.organization === organization.id).map(workspace => <article className="drive-workspace-card" key={workspace.id} aria-label={workspace.name}>
        <button type="button" className="drive-workspace-open" onClick={() => onOpen(workspace)} aria-label={`Open workspace ${workspace.name}`}>
          <span className="drive-workspace-avatar" aria-hidden="true">{workspace.name.split(/\s+/).filter(Boolean).slice(0,2).map(word => word[0]).join("").toLocaleUpperCase()}</span>
          <span><strong>{workspace.name}</strong><small>{workspace.is_default ? "Organization workspace" : "Team workspace"} · Files</small>
          <small>{organizations.find(org => org.id === workspace.organization)?.name}</small>
          <small>{workspace.role === "owner" ? "Owner" : workspace.role === "editor" ? "Can edit" : "Can view"}</small></span>
        </button>
        <div className="drive-workspace-actions">
          <IconButton label={`${workspace.favorite ? "Unfavorite" : "Favorite"} workspace ${workspace.name}`} aria-pressed={!!workspace.favorite}
            disabled={pending !== null} onClick={async () => {setPending(workspace.id); setError("");
              try {await onFavorite(workspace, !workspace.favorite);} catch(e) {setError((e as Error).message);} finally {setPending(null);}}}>
            <AetherIcon name="star" />
          </IconButton>
        </div>
      </article>)}
      </div>
    </section>)}
    {!matches.length && <div className="drive-workspace-empty"><AetherIcon name="folder" /><h3>{filter || query ? "No matching workspaces" : mode === "recent" ? "No recent workspaces" : mode === "favorites" ? "No favorite workspaces" : "No workspaces available"}</h3>
      <p>{mode === "recent" ? "Open a workspace to find it here next time." : mode === "favorites" ? "Use the star on a workspace to add it to Favorites and quick access." : "Try another name or ask your organization manager for access."}</p></div>}
  </section>;
}

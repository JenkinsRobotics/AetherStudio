import { useEffect, useState } from "react";
import { Button, Dialog } from "@aether/ui";
import { driveRequest, type DriveContext } from "./drive-api";

export function DriveMembers({
  context,
  organization,
  workspace,
  onClose,
  onChanged,
}: {
  context: DriveContext;
  organization: string;
  workspace?: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const organizationDefault = context.workspaces.some(w => w.id === workspace && w.is_default && w.id !== "shared");
  const [members, setMembers] = useState<
      {
        id: string;
        name: string;
        username?: string;
        assigned_workspace_role?: string | null;
        role: string;
        workspace_role?: string | null;
      }[]
    >([]),
    [user, setUser] = useState(""),
    [role, setRole] = useState(workspace ? "editor" : "member"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    driveRequest<{ members: typeof members }>("members", {
      organization,
      workspace,
    }).then((r) => setMembers(r.members));
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [organization, workspace]);
  return (
    <Dialog
      open
      title={workspace ? "Workspace members" : "Organization members"}
      onClose={onClose}
      actions={<Button onClick={onClose}>Done</Button>}
    >
      <p>
        {workspace
          ? "Select an organization member and set their workspace access."
          : "Add an existing Studio account by username. Server administrators create accounts in Studio."}
      </p>
      {organizationDefault && <p>All organization members can view this default workspace. Grant Editor to allow changes; organization owners manage access.</p>}
      <div className="drive-form-row">
        <label>
          {workspace ? "Member" : "Username"}
          {workspace ? (
            <select
              aria-label="Member"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            >
              <option value="">Choose member</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-label="Username"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            />
          )}
        </label>
        <label>
          Role
          <select
            aria-label="Member role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {(workspace
              ? ["viewer", "editor", "owner", "remove"]
              : ["member", "owner", "remove"]
            ).map((r) => (
              <option key={r} value={r}>
                {r === "remove" && organizationDefault ? "Use organization access (viewer)" : r}
              </option>
            ))}
          </select>
        </label>
        <Button
          disabled={busy || !user}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const target = members.find(m => workspace ? m.id === user : m.username === user || m.id === user);
              const expected = workspace
                ? target && "assigned_workspace_role" in target ? target.assigned_workspace_role : target?.workspace_role
                : target?.role;
              await driveRequest("member_update", {
                organization,
                workspace,
                user,
                role,
                expected_role: expected ?? null,
              });
              await load();
              onChanged();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Apply access
        </Button>
      </div>
      <ul>
        {members.map((m) => (
          <li key={m.id}>
            {m.name} ·{" "}
            {workspace ? (m.workspace_role ?? "No workspace access") : m.role}
            {m.id === context.user.id ? " (you)" : ""}
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
    </Dialog>
  );
}


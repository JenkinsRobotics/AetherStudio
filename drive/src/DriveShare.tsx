import { useEffect, useState } from "react";
import { Button, Dialog } from "@aether/ui";
import { driveRequest, type DriveFile } from "@aether/session/library/drive-api";
import { newSharingLink, DocumentError } from "@aether/session/documents";

export function DriveShare({
  file,
  onClose,
}: {
  file: DriveFile;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]),
    [grants, setGrants] = useState<
      {
        user_id: string;
        name: string;
        role: string;
        workspace_role?: string | null;
      }[]
    >([]),
    [links, setLinks] = useState<
      { id: string; role: string; expires: number; revoked: boolean }[]
    >([]);
  const [person, setPerson] = useState(""),
    [role, setRole] = useState("viewer"),
    [days, setDays] = useState(7),
    [url, setURL] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [pendingLink, setPendingLink] = useState<ReturnType<typeof newSharingLink> | null>(null);
  const load = async () => {
    const [people, sharing] = await Promise.all([
      driveRequest<{ members: { id: string; name: string }[] }>("members", {
        organization: file.organization,
      }),
      driveRequest<{ grants: typeof grants; links: typeof links }>("sharing", {
        id: file.id,
      }),
    ]);
    setMembers(people.members);
    setGrants(sharing.grants);
    setLinks(sharing.links);
  };
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [file.id]);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      title={`Share ${file.name}`}
      onClose={onClose}
      actions={<Button onClick={onClose}>Done</Button>}
    >
      <p>
        Grant access to people in this organization. Folder access also applies
        to its contents.
      </p>
      <div className="drive-form-row">
        <label>
          Person
          <select
            aria-label="Share with"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
          >
            <option value="">Choose a person</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Permission
          <select
            disabled={busy || pendingLink !== null}
            aria-label="Sharing permission"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="viewer">Can view</option>
            <option value="editor">Can edit</option>
          </select>
        </label>
        <Button
          disabled={!person || busy}
          onClick={() =>
            void run(() =>
              driveRequest("grant", { id: file.id, user: person, role, expected_role: grants.find(g => g.user_id === person)?.role ?? null }),
            )
          }
        >
          Share
        </Button>
      </div>
      <h3>Manage access</h3>
      {grants.length ? (
        grants.map((grant) => (
          <div className="drive-access-row" key={grant.user_id}>
            <span>
              {grant.name} · {grant.role}
            </span>
            <Button
              disabled={busy}
              onClick={() =>
                void run(() =>
                  driveRequest("grant", {
                    id: file.id,
                    user: grant.user_id,
                    role: "remove",
                    expected_role: grant.role,
                  }),
                )
              }
            >
              Remove access
            </Button>
          </div>
        ))
      ) : (
        <p>
          No direct grants. Workspace and containing-folder permissions still
          apply.
        </p>
      )}
      <h3>Organization link</h3>
      <p>
        People must sign in and belong to this organization. Links expire and
        can be revoked.
      </p>
      <div className="drive-form-row">
        <label>
          Expires in days
          <input
            disabled={busy || pendingLink !== null}
            aria-label="Link expiry in days"
            type="number"
            min="1"
            max="365"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </label>
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const request = pendingLink ?? newSharingLink(file.id, role, days);
              setPendingLink(request);
              try {
                const result = await driveRequest<{ url: string; active?: boolean }>("link_create", request);
                setPendingLink(null);
                setURL(result.active === false ? "" : new URL(result.url, location.origin).href);
                if (result.active === false) setError("This link has expired or was revoked. Create a new link to share again.");
              } catch (error) {
                if (!(error instanceof DocumentError) || error.detail?.code !== "outcome_unknown") setPendingLink(null);
                throw error;
              }
            })
          }
        >
          {pendingLink ? "Retry sharing link" : "Create sharing link"}
        </Button>
      </div>
      {url && (
        <div className="drive-form-row">
          <input aria-label="Sharing link" readOnly value={url} />
          <Button
            onClick={() =>
              void navigator.clipboard
                .writeText(url)
                .catch(() => setError("Select and copy the link above."))
            }
          >
            Copy link
          </Button>
        </div>
      )}
      {links
        .filter((l) => !l.revoked)
        .map((link) => (
          <div className="drive-access-row" key={link.id}>
            <span>
              {link.role} · expires{" "}
              {new Date(link.expires * 1000).toLocaleDateString()}
            </span>
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await driveRequest("link_revoke", { id: file.id, link: link.id });
                  setURL("");
                })
              }
            >
              Revoke link
            </Button>
          </div>
        ))}
      {error && <p role="alert">{error}</p>}
    </Dialog>
  );
}

export { DriveMembers } from "@aether/session/library/members";


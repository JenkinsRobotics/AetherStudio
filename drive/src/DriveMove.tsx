import { useEffect, useState } from "react";
import { AetherIcon, fileTypeDefinition, Button, Dialog } from "@aether/ui";
import { driveRequest, type DriveFile, type DriveContext, type DriveLocation } from "@aether/session/library/drive-api";

export function DriveMove({
  files,
  context,
  organization,
  copy,
  onClose,
  onDone,
}: {
  files: DriveFile[];
  context: DriveContext;
  organization: string;
  copy: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [dest, setDest] = useState<DriveLocation>({
      organization,
      workspace: null,
      parent: null,
    }),
    [folders, setFolders] = useState<DriveFile[]>([]),
    [path, setPath] = useState<{ id: string; name: string }[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setFolders([]);
    setPath([]);
    setError("");
    void driveRequest<{ files: DriveFile[]; path: typeof path }>("list", {
      ...dest,
      view: dest.workspace ? "workspace" : "personal",
    })
      .then((r) => {
        if (!active) return;
        setFolders(
          r.files.filter(
            (f) =>
              f.kind === "folder" &&
              f.writable &&
              !files.some((s) => s.id === f.id),
          ),
        );
        setPath(r.path);
      })
      .catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [dest, files]);
  return (
    <Dialog
      open
      title={copy ? "Copy to" : "Move to"}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            primary
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                for (const file of files)
                  await driveRequest(copy ? "copy" : "move", {
                    id: file.id,
                    destination: dest,
                    expected_structure_revision: file.structure_revision,
                    ...(copy ? { expected_revision: file.revision } : {}),
                  });
                onDone();
                onClose();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {copy ? "Copy here" : "Move here"}
          </Button>
        </>
      }
    >
      <label>
        Organization
        <select
          aria-label="Destination organization"
          value={dest.organization}
          onChange={(e) =>
            setDest({
              organization: e.target.value,
              workspace: null,
              parent: null,
            })
          }
        >
          {context.organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Destination
        <select
          aria-label="Destination library"
          value={dest.workspace ?? ""}
          onChange={(e) =>
            setDest({
              organization: dest.organization,
              workspace: e.target.value || null,
              parent: null,
            })
          }
        >
          <option value="">My files</option>
          {context.workspaces
            .filter(
              (w) =>
                w.organization === dest.organization && w.role !== "viewer",
            )
            .map((w) => (
              <option value={w.id} key={w.id}>
                {w.name}
              </option>
            ))}
        </select>
      </label>
      <nav className="drive-breadcrumb">
        <Button onClick={() => setDest({ ...dest, parent: null })}>Root</Button>
        {path.map((p) => (
          <Button key={p.id} onClick={() => setDest({ ...dest, parent: p.id })}>
            {p.name}
          </Button>
        ))}
      </nav>
      {folders.map((f) => (
        <button
          className="drive-folder-choice"
          key={f.id}
          onClick={() => setDest({ ...dest, parent: f.id })}
        >
          <AetherIcon name={fileTypeDefinition("folder").icon} />
          {f.name}
        </button>
      ))}
      {!folders.length && <p>No subfolders.</p>}
      {error && <p role="alert">{error}</p>}
    </Dialog>
  );
}


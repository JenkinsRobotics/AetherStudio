import { FileIcon } from "./FileIcon";
import { fileTypeFor } from "./file-types";
import { AetherIcon } from "./AetherIcon";
import { IconButton } from "./IconButton";
import { useEffect, useRef, useState } from "react";
import { FileManagerPanel, type FileManagerGroup, type FileManagerItem } from "./FileManagerPanel";
import type { DocumentConnection } from "./DocumentServices";

type LibraryRow = { id: string; name: string; kind: string; app?: string; mime?: string; versions?: number; latest_version?: string };
type Crumb = { id: string | null; name: string };
export interface DocumentFileManagerProps {
  connection: DocumentConnection;
  documentGroups?: readonly FileManagerGroup[];
  activeID?: string | null;
  onOpenItem?: (item: FileManagerItem) => void | Promise<void>;
  fileType?: (name: string) => string;
}

/** Shared library controller. The session owns transport/navigation; products
 * supply document contents and their selection behavior, never a second UI. */
export function DocumentFileManager({ connection, documentGroups = [], activeID, onOpenItem, fileType }: DocumentFileManagerProps) {
  const [scope, setScope] = useState("personal");
  const [path, setPath] = useState<Crumb[]>([{ id: null, name: "My files" }]);
  const [rows, setRows] = useState<LibraryRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const current = useRef(connection); current.current = connection;
  const browse = async (trail: Crumb[], view = scope) => {
    const request = ++generation.current;
    setBusy(true); setError("");
    try {
      const reply = await current.current.call<{ files: LibraryRow[] }>("list", { view, parent: trail.at(-1)?.id ?? null });
      if (request !== generation.current) return;
      setRows(reply.files ?? []); setPath(trail);
    } catch (e) { if (request === generation.current) setError((e as Error).message); }
    finally { if (request === generation.current) setBusy(false); }
  };
  useEffect(() => {
    setRows([]); setScope("personal");
    void browse([{ id: null, name: "My files" }], "personal");
    return () => { generation.current++; };
  }, [connection.key]);
  const navigate = (id: string | null) => {
    const index = path.findIndex(crumb => crumb.id === id);
    void browse(index >= 0 ? path.slice(0, index + 1) : [...path, { id, name: rows.find(row => row.id === id)?.name ?? "Folder" }]);
  };
  const open = async (item: FileManagerItem) => {
    setError("");
    try {
      if (documentGroups.some(group => group.items.includes(item))) await onOpenItem?.(item);
      else if (connection.openDocument) await connection.openDocument(item.id);
      else throw new Error("Opening library documents is not available in this workspace.");
    } catch (e) { setError((e as Error).message); }
  };
  return <FileManagerPanel ariaLabel="Part manager" documentName={connection.name}
    documentGroups={documentGroups} activeID={activeID} path={path}
    libraryItems={rows.map(row => ({ id: row.id, name: row.name,
      kind: row.kind === "folder" ? "folder" : "file",
      icon: <FileIcon file={{ ...row, app: row.app ?? connection.key.split(":")[0] }} />,
      detail: row.kind === "folder" ? "Folder" : fileType?.(row.name) ?? fileTypeFor({ ...row, app: row.app ?? connection.key.split(":")[0] }).label,
      badge: row.versions ? `V${row.versions}` : undefined,
      badgeTitle: row.latest_version ? `Latest version: ${row.latest_version}` : undefined,
      disabled: busy,
    }))} busy={busy} error={error} onOpen={item => void open(item)} onNavigate={navigate}
    onRefresh={() => void browse(path)}
    actions={connection.openLibrary ? <IconButton label="Open Aether Drive" onClick={connection.openLibrary}><AetherIcon name="open-external"/></IconButton> : undefined}
    libraryEmptyText={busy ? "Loading files…" : "No documents here yet."}
    libraryActions={<select className="aui-file-manager-scope" aria-label="File library" value={scope} disabled={busy}
      onChange={event => { const view = event.target.value; setScope(view); void browse([{ id: null, name: view === "personal" ? "My files" : "Workspace files" }], view); }}>
      <option value="personal">My files</option><option value="workspace">Workspace files</option>
    </select>} />;
}

import { useState } from "react";
import { AetherIcon, Button, Dialog } from "@aether/ui";
import { driveRequest, type DriveFile } from "@aether/session/library/drive-api";

/** Snapshot the complete bin before confirming; search/selection do not limit Empty. */
export function DriveRecycleToolbar({ organization, onChanged, disabled }: {
  organization: string; onChanged: () => Promise<void>; disabled?: boolean;
}) {
  const [items, setItems] = useState<DriveFile[] | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function prepare() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await driveRequest<{files: DriveFile[]}>("list", {organization, view: "trash"});
      const manageable = result.files.filter(file => file.manageable);
      if (manageable.length) setItems(manageable);
      else setNotice("There are no recycled items you can permanently delete.");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function empty() {
    if (!items) return;
    setBusy(true); setError("");
    try {
      await driveRequest("empty_trash", {organization, ids: items.map(file => file.id)});
      setItems(null); setNotice("Permanently deleted the confirmed items."); await onChanged();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="drive-recycle-toolbar">
    <Button disabled={busy || disabled} onClick={() => void prepare()}><AetherIcon name="delete" />Empty recycle bin</Button>
    {notice && <span role="status">{notice}</span>}
    {error && !items && <span role="alert">{error}</span>}
    {items && <Dialog open title="Empty recycle bin?" onClose={() => {if (!busy) setItems(null);}}
      actions={<><Button disabled={busy} onClick={() => setItems(null)}>Cancel</Button>
        <Button primary disabled={busy} onClick={() => void empty()}>Empty recycle bin</Button></>}>
      <p>Permanently delete these {items.length} items and their contents from your recycle bin? This cannot be undone.</p>
      <p>Only items you can manage are included. This includes items hidden by your search.</p>
      <ul>{items.slice(0, 10).map(file => <li key={file.id}>{file.name}</li>)}</ul>
      {items.length > 10 && <p>And {items.length - 10} more items.</p>}
      {error && <p role="alert">{error}</p>}
    </Dialog>}
  </div>;
}

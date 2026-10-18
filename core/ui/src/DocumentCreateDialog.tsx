import { createPortal } from "react-dom";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { Dialog } from "./Dialog";
import { useOverlayHost } from "./OverlayScope";
import { DocumentVersionPanel } from "./DocumentVersionPanel";
import { DOCUMENT_HISTORY_CHANGED, type DocumentConnection } from "./DocumentServices";

/** One creation dialog, whether invoked from history or the command rail. */
export function DocumentCreateDialog({ connection, onClose, mode = "version", sourceRevision, sourceName }: {
  connection?: DocumentConnection; onClose: () => void; mode?: "version" | "branch"; sourceRevision?: number; sourceName?: string;
}) {
  const host = useOverlayHost();
  return createPortal(<div className="aui-version-dialog">
    <Dialog open title={`Create ${mode} from ${sourceName ?? connection?.branchLabel ?? (connection?.branch?.startsWith("branch-") ? "current workspace" : connection?.branch) ?? "Main"}`} onClose={onClose} actions={!connection && <Button onClick={onClose}>Cancel</Button>}>
      {connection ? <DocumentVersionPanel connection={connection} createOnly branchOnly={mode === "branch"} branchSource={sourceRevision} onCancel={onClose} onCreated={() => {
        window.dispatchEvent(new CustomEvent(DOCUMENT_HISTORY_CHANGED, { detail: connection.key }));
        onClose();
      }} /> : <EmptyState compact title="No document connected" description="Open a saved document to create a version or branch." />}
    </Dialog>
  </div>, host ?? document.body);
}

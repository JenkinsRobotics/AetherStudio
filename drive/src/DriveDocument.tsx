import { useMemo, useState } from "react";
import { useDocumentConnection } from "@aether/session/useDocumentConnection";
import { Button, Dialog, DocumentVersionPanel, DocumentCollaborationPanel, type DocumentConnection } from "@aether/ui";
import { driveRequest, type DriveFile } from "@aether/session/library/drive-api";

export function DriveDocument({
  file,
  tab,
  onClose,
}: {
  file: DriveFile;
  tab: "versions" | "comments" | "tasks" | "notes";
  onClose: () => void;
}) {
  const [branch, setBranch] = useState("Main");
  const liveConnection = useDocumentConnection({app:file.app,id:file.id,name:file.name,flush:async()=>{}});
  const connection = useMemo<DocumentConnection>(
    () => ({
      key: `drive:${file.id}:${branch}`,
      subscribeChanges: liveConnection.subscribeChanges,
      branch,
      openBranch: async (name) => setBranch(name),
      downloadSnapshot: async (revision) => {
        const link=document.createElement("a");
        link.href=`/api/drive/download?id=${encodeURIComponent(file.id)}&revision=${revision}`;
        link.download=file.name;
        link.click();
      },
      name: file.name,
      writable: file.writable,
      flush: async () => {},
      reload: async () => {},
      call: <T,>(action: string, data: Record<string, unknown> = {}) =>
        driveRequest<T>("document", { branch, ...data, id: file.id, action }),
    }),
    [file.id, file.writable, branch, liveConnection.subscribeChanges],
  );
  return (
    <Dialog
      open
      title={file.name}
      onClose={onClose}
      actions={<Button onClick={onClose}>Close</Button>}
    >
      <div className="drive-document-panel">
        {tab === "versions" ? (
          <DocumentVersionPanel connection={connection} />
        ) : (
          <DocumentCollaborationPanel connection={connection} kind={tab} />
        )}
      </div>
    </Dialog>
  );
}


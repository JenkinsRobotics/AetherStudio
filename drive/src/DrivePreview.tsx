import { useEffect, useState } from "react";
import { Button, Dialog } from "@aether/ui";
import { driveRequest, fileBlob, encodeFile, bytes, type DriveFile } from "@aether/session/library/drive-api";

export function DrivePreview({
  file,
  onClose,
}: {
  file: DriveFile;
  onClose: () => void;
}) {
  const [url, setURL] = useState(""),
    [text, setText] = useState(""),
    [error, setError] = useState("");
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(file.revision);
  const isText =
    file.mime.startsWith("text/") || /\.(json|md|yaml|csv)$/i.test(file.name);
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await driveRequest<DriveFile>("document", {
        id: file.id,
        action: "save",
        expected_revision: revision,
        data_base64: await encodeFile(new File([draft], file.name)),
      });
      setRevision(result.revision);
      setText(draft);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (
      file.size > 16 * 1024 * 1024 ||
      /^(image|video|audio)\//.test(file.mime) ||
      file.mime === "application/pdf"
    ) {
      setURL(`/api/drive/download?id=${encodeURIComponent(file.id)}&preview=1`);
      return;
    }
    let active = true,
      objectURL = "";
    void driveRequest<{ data_base64: string }>("read", { id: file.id })
      .then(async (r) => {
        const blob = fileBlob(r.data_base64, file.mime);
        if (!active) return;
        objectURL = URL.createObjectURL(blob);
        setURL(objectURL);
        if (
          file.mime.startsWith("text/") ||
          /\.(json|md|yaml|csv)$/i.test(file.name)
        )
          setText((await blob.text()).slice(0, 200000));
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [file.id]);
  return (
    <Dialog
      open
      title={file.name}
      onClose={onClose}
      actions={
        <>
          {isText &&
            file.writable &&
            file.size <= 200000 &&
            url &&
            (editing ? (
              <>
                <Button disabled={busy} onClick={() => setEditing(false)}>
                  Cancel editing
                </Button>
                <Button disabled={busy} primary onClick={() => void save()}>
                  Save changes
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  setDraft(text);
                  setEditing(true);
                }}
              >
                Edit text
              </Button>
            ))}
          <a
            className="aui-button"
            href={`/api/drive/download?id=${encodeURIComponent(file.id)}`}
            download={file.name}
          >
            Download
          </a>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="drive-preview">
        {error && <p role="alert">{error}</p>}
        {editing ? (
          <textarea
            className="drive-text-editor"
            aria-label="File contents"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        ) : !url ? (
          <p>Loading preview…</p>
        ) : file.mime.startsWith("image/") && !file.mime.includes("svg") ? (
          <img src={url} alt={file.name} />
        ) : file.mime.startsWith("video/") ? (
          <video src={url} controls />
        ) : file.mime.startsWith("audio/") ? (
          <audio src={url} controls />
        ) : isText ? (
          <pre>{text}</pre>
        ) : file.mime === "application/pdf" ? (
          <iframe title={file.name} src={url} />
        ) : (
          <p>
            {bytes(file.size)} · Preview is unavailable for this file type.
            Download to open it in a compatible application.
          </p>
        )}
      </div>
    </Dialog>
  );
}

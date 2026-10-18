import { useEffect, useState } from "react";
import { AetherIcon } from "./AetherIcon";
import { IconButton } from "./IconButton";
import "./FilePreview.css";

/**
 * Preview for a stored file, the way a drive shows you what something is
 * before you commit to opening it (Jonathan, 2026-10-04).
 *
 * The browser already renders images, PDFs, video and audio; this hands each
 * one to the element that knows how, and says plainly when it cannot. The
 * alternative — a thumbnail service — is a lot of machinery for a preview the
 * browser gives away, and it would need a second code path for every format.
 *
 * Presentation only: it is given a URL and a name, so Drive, the app libraries
 * and anything else with a content endpoint can use the same component.
 */

export type PreviewKind = "image" | "pdf" | "video" | "audio" | "text" | "none";

/** What the browser can show, decided by extension. */
export function previewKind(name: string): PreviewKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "svg", "ico"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (["mp4", "webm", "ogv", "mov"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)) return "audio";
  if (["txt", "md", "json", "csv", "log", "yml", "yaml", "xml", "svg"].includes(ext)) return "text";
  return "none";
}

export function canPreview(name: string): boolean {
  return previewKind(name) !== "none";
}

export interface FilePreviewProps {
  name: string;
  /** Where the bytes are. The component never builds this itself. */
  url: string;
  /** Shown under the name — size, owner, modified date, whatever fits. */
  detail?: string;
  onClose: () => void;
  /** Offered beside Close when the file can be opened in its editor. */
  onOpen?: () => void;
  onDownload?: () => void;
  /** Step through a selection without closing. */
  onPrevious?: () => void;
  onNext?: () => void;
}

export function FilePreview({ name, url, detail, onClose, onOpen, onDownload, onPrevious, onNext }: FilePreviewProps) {
  const kind = previewKind(name);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Text is the one kind the browser will not lay out for us inside a frame
  // without inheriting the page's styles, so it is fetched and shown as-is.
  useEffect(() => {
    if (kind !== "text") { setText(null); return; }
    let live = true;
    setText(null); setError("");
    fetch(url)
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error("The file could not be read."))))
      .then((body) => { if (live) setText(body.slice(0, 200_000)); })
      .catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [url, kind]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft" && onPrevious) onPrevious();
      else if (event.key === "ArrowRight" && onNext) onNext();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onPrevious, onNext]);

  return (
    <div className="aui-file-preview-scrim" role="dialog" aria-modal="true" aria-label={`Preview of ${name}`}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="aui-file-preview">
        <header>
          <span className="aui-file-preview-name">
            <strong title={name}>{name}</strong>
            {detail ? <small>{detail}</small> : null}
          </span>
          {onOpen ? <button type="button" className="aui-file-preview-open" onClick={onOpen}>Open</button> : null}
          {onDownload ? <IconButton label="Download" onClick={onDownload}><AetherIcon name="export" /></IconButton> : null}
          <IconButton label="Close preview" onClick={onClose}><AetherIcon name="close" /></IconButton>
        </header>

        <div className="aui-file-preview-stage" data-kind={kind}>
          {onPrevious ? (
            <IconButton label="Previous file" className="aui-file-preview-step" onClick={onPrevious}>
              <AetherIcon name="chevron-left" />
            </IconButton>
          ) : null}

          {kind === "image" ? <img src={url} alt={name} /> : null}
          {kind === "pdf" ? <iframe src={url} title={`Preview of ${name}`} /> : null}
          {kind === "video" ? <video src={url} controls preload="metadata" /> : null}
          {kind === "audio" ? <audio src={url} controls preload="metadata" /> : null}
          {kind === "text" ? (
            error ? <p className="aui-file-preview-none">{error}</p>
              : text === null ? <p className="aui-file-preview-none">Loading…</p>
                : <pre>{text}</pre>
          ) : null}
          {kind === "none" ? (
            <p className="aui-file-preview-none">
              <AetherIcon name="document-text" aria-hidden="true" />
              No preview for this kind of file. Download it, or open it in its app.
            </p>
          ) : null}

          {onNext ? (
            <IconButton label="Next file" className="aui-file-preview-step" onClick={onNext}>
              <AetherIcon name="chevron-right" />
            </IconButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

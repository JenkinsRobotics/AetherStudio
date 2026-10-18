import { useEffect, useRef, type ReactNode } from "react";
import { AetherIcon } from "./AetherIcon";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import "./DocumentNotesView.css";

interface DocumentNotesViewProps {
  loaded: boolean;
  canEdit: boolean;
  editing: boolean;
  busy: boolean;
  conflicted: boolean;
  text: string;
  savedText: string;
  error: string;
  conflict: ReactNode;
  onRefresh: () => void;
  onEdit: () => void;
  onChange: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

/** Read-first document notes, shared by the suite and its editors. */
export function DocumentNotesView(props: DocumentNotesViewProps) {
  const editButton = useRef<HTMLButtonElement | null>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (wasEditing.current && !props.editing) editButton.current?.focus();
    wasEditing.current = props.editing;
  }, [props.editing]);
  return (
    <section className="aui-document-notes" aria-label="Document notes">
      <header className="aui-document-notes-header">
        <h3>Document notes</h3>
        <IconButton label="Refresh document notes" disabled={props.busy} onClick={props.onRefresh}>
          <AetherIcon name="refresh" />
        </IconButton>
        <span ref={node => { editButton.current = node?.querySelector("button") ?? null; }}>
          <IconButton label="Edit document notes" aria-pressed={props.editing}
            disabled={!props.loaded || !props.canEdit || props.busy || props.editing}
            onClick={props.onEdit}>
            <AetherIcon name="pencil" />
          </IconButton>
        </span>
      </header>
      <div className="aui-document-notes-body">
        {props.error && <p role="alert">{props.error}</p>}
        {props.conflict}
        {!props.loaded && !props.editing ? <p role="status">Loading document notes…</p> : props.editing ? (
          <form onSubmit={event => { event.preventDefault(); props.onSave(); }}>
            <textarea autoFocus aria-label="Document notes text" value={props.text}
              onChange={event => props.onChange(event.target.value)}
              maxLength={50000} rows={12} disabled={props.busy}
              onKeyDown={event => {
                if (event.key === "Escape" && !props.busy) { event.preventDefault(); event.stopPropagation(); props.onCancel(); }
              }} />
            <div className="aui-document-notes-actions">
              <Button primary type="submit" disabled={props.busy || props.conflicted || !props.canEdit}>Save notes</Button>
              <Button disabled={props.busy} onClick={props.onCancel}>Cancel</Button>
            </div>
          </form>
        ) : (
          <p className="aui-document-notes-text" data-empty={!props.savedText || undefined}>
            {props.savedText || "No document notes yet."}
          </p>
        )}
      </div>
    </section>
  );
}

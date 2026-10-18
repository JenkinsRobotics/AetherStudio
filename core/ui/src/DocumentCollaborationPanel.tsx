import { useEffect, useRef, useState } from "react";
import { useDocumentMutation } from "./useDocumentMutation";
import { DocumentCommentsView } from "./DocumentCommentsView";
import { ActionItemsView } from "./ActionItemsView";
import { DocumentNotesView } from "./DocumentNotesView";
import { Button } from "./Button";
import type {
  CollaborationItem,
  DocumentCollaboration,
  DocumentConnection,
} from "./DocumentServices";
import "./DocumentPanels.css";
export type CollaborationKind = "comments" | "notes" | "tasks" | "reminders";
const titles = {
  comments: "Comments",
  notes: "Document notes",
  tasks: "Action items",
  reminders: "Reminders",
};
export function DocumentCollaborationPanel({
  connection,
  kind,
}: {
  connection: DocumentConnection;
  kind: CollaborationKind;
}) {
  const [disconnected, setDisconnected] = useState(false);
  const liveAccess = useRef(true), refreshRead = useRef(0);
  const [draftReset, setDraftReset] = useState(0);
  const [notesEditing, setNotesEditing] = useState(false);
  const [taskCollection, setTaskCollection] = useState<"tasks" | "reminders">("tasks");
  const effectiveKind = kind === "tasks" ? taskCollection : kind;
  const [following, setFollowing] = useState(true);
  const followRef = useRef(true);
  const [state, setState] = useState<DocumentCollaboration | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [text, setText] = useState(""),
    [due, setDue] = useState(""),
    [assignee, setAssignee] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [reply, setReply] = useState<string | null>(null),
    [filter, setFilter] = useState("open");
  const dirty = useRef(false),
    generation = useRef(0),
    editRevision = useRef<number | null>(null),
    editOriginal = useRef<string | number | null>(null);
  const [conflicted, setConflicted] = useState(false);
  const receivedRevision = useRef(-1);
  const receive = (next: DocumentCollaboration) => {
    if (next.revision < receivedRevision.current) return;
    receivedRevision.current = next.revision;
    setState(next);
    if (kind === "notes" && !dirty.current) setText(next.notes.text);
  };
  const mutation = useDocumentMutation(connection, async (_action, result) => {
    if (liveAccess.current) receive(result as DocumentCollaboration);
    dirty.current = false; editRevision.current = null; setConflicted(false);
    setEditing(null); setReply(null); setNotesEditing(false); setText(""); setDue("");
    setDraftReset(n => n + 1); setError("");
  }, state?.mutation_replay === "operation_id");
  const refresh = async () => {
    if (!liveAccess.current) return;
    const g = generation.current, request = ++refreshRead.current;
    try {
      const next =
        await connection.call<DocumentCollaboration>("collaboration");
      if (g === generation.current && request === refreshRead.current && liveAccess.current) receive(next);
    } catch (e) {
      if (g === generation.current && request === refreshRead.current) setError((e as Error).message);
    }
  };
  useEffect(() => {
    generation.current++;
    liveAccess.current = true; setDisconnected(false);
    receivedRevision.current = -1;
    dirty.current = false;
    setState(null);
    setNotesEditing(false);
    setTaskCollection("tasks");
    setBusy(false);
    setConflicted(false);
    editRevision.current = null;
    setText("");
    setEditing(null);
    setReply(null);
    setError("");
    void refresh();
    const subscriptionGeneration = generation.current;
    const unsubscribe = connection.subscribeChanges?.(event => {
      if (subscriptionGeneration !== generation.current) return;
      const wasUnavailable = !liveAccess.current;
      liveAccess.current = event.kind !== "unavailable";
      setDisconnected(!liveAccess.current);
      refreshRead.current++;
      if (!liveAccess.current) setState(null);
      else if (kind !== "comments" || followRef.current || wasUnavailable) void refresh();
    });
    const timer = setInterval(() => { if(kind !== "comments" || followRef.current) void refresh(); }, 10000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => {
      generation.current++;
      unsubscribe?.();
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [connection.key, kind]);
  useEffect(() => {
    if (!state?.actor) return;
    let enabled = true;
    try { enabled = localStorage.getItem(`aether-comments-follow:${connection.key}:${state.actor}`) !== "false"; } catch { /* Optional preference. */ }
    followRef.current = enabled; setFollowing(enabled);
  }, [connection.key, state?.actor]);
  const mutate = async (
    operation: string,
    value: Record<string, unknown>,
    item?: string,
    draft = false,
    collection: CollaborationKind = effectiveKind,
  ) => {
    if (!state || busy || mutation.uncertain || !liveAccess.current) return false;
    const g = generation.current;
    setBusy(true);
    setError("");
    try {
      const latest =
        await connection.call<DocumentCollaboration>("collaboration");
      const original = draft
        ? editOriginal.current
        : collection === "notes"
          ? state.notes.text
          : state[collection].find((i) => i.id === item)?.updated;
      const remote =
        collection === "notes"
          ? latest.notes.text
          : latest[collection].find((i) => i.id === item)?.updated;
      const unchanged = operation === "add" || original === remote;
      const expected = unchanged
        ? latest.revision
        : draft && editRevision.current !== null
          ? editRevision.current
          : state.revision;
      const next = await mutation.send<DocumentCollaboration>(
        "collaboration_mutate",
        {
          collection,
          operation,
          item,
          value,
          expected_revision: expected,
        },
      );
      if (g !== generation.current) return false;
      if (liveAccess.current) receive(next);
      return true;
    } catch (e) {
      if (g === generation.current) {
        setError((e as Error).message);
        if (draft && (e as Error & { status?: number }).status === 409)
          setConflicted(true);
        await refresh();
      }
      return false;
    } finally {
      if (g === generation.current) setBusy(false);
    }
  };
  const person = (id: string) =>
    state?.members.find((m) => m.id === id)?.name ?? "Former member";
  const canEdit = (i: CollaborationItem) =>
    state?.actor === state?.owner || i.author === state?.actor;
  const submit = async (metadata: Record<string, unknown> = {}) => {
    const ok = await mutate(
      kind === "notes" || editing ? "update" : "add",
      kind === "notes"
        ? { text }
        : kind === "comments"
          ? { text, ...metadata, ...(!editing ? { parent: reply } : {}) }
          : { text, due, ...(assignee ? { assignee } : {}) },
      editing ?? undefined,
      kind === "notes" || !!editing,
    );
    if (ok) {
      dirty.current = false;
      editRevision.current = null;
      setConflicted(false);
      if (kind !== "notes") setText("");
      else setNotesEditing(false);
      setEditing(null);
      setReply(null);
      setDue("");
    }
    return ok;
  };
  const edit = (i: CollaborationItem) => {
    editOriginal.current = i.updated;
    editRevision.current = state?.revision ?? null;
    setConflicted(false);
    setEditing(i.id);
    setReply(null);
    setText(i.text);
    setDue(i.due ?? "");
    setAssignee(i.assignee ?? "");
    dirty.current = true;
  };
  const deleted = (i: CollaborationItem, collection: CollaborationKind = effectiveKind) => {
    if (window.confirm("Remove this item? Its audit history will be retained."))
      void mutate("delete", {}, i.id, false, collection);
  };
  const items =
    kind === "comments"
      ? state?.comments.filter(
          (i) =>
            !i.parent &&
            (filter === "all" ||
              (filter === "done" ? i.resolved : !i.resolved)),
        )
      : kind === "notes"
        ? []
        : state?.[kind].filter(
            (i) =>
              !i.deleted &&
              (filter === "all" ||
                (filter === "done"
                  ? i.status === "done"
                  : i.status !== "done")),
          );
  const conflictPanel = mutation.uncertain ? <div role="group" aria-label="Confirm pending change">
    <p>The reply was lost. Confirm the original change before submitting again.</p>
    {mutation.canRetry ? <Button disabled={mutation.retrying} onClick={() => void mutation.retry().catch(e => setError(e.message))}>Retry original change</Button> : <p>This server cannot safely replay this change. Check the saved discussion before submitting again.</p>}
  </div> : (conflicted && state && (
        <div role="group" aria-label="Review conflicting edit">
          <p>
            The server changed while you were editing. Your draft is still in
            the editor.
          </p>
          <blockquote>
            {effectiveKind === "notes"
              ? state.notes.text
              : state[effectiveKind].find((i) => i.id === editing)?.text}
          </blockquote>
          <Button
            onClick={() => {
              editRevision.current = state.revision;
              editOriginal.current =
                effectiveKind === "notes"
                  ? state.notes.text
                  : (state[effectiveKind].find((i) => i.id === editing)?.updated ??
                    null);
              setConflicted(false);
              setError("Reviewed latest changes. Save when ready.");
            }}
          >
            Keep my draft after review
          </Button>
          <Button
            onClick={() => {
              setText(
                effectiveKind === "notes"
                  ? state.notes.text
                  : (state[effectiveKind].find((i) => i.id === editing)?.text ?? ""),
              );
              dirty.current = effectiveKind === "notes";
              editRevision.current = state.revision;
              editOriginal.current = effectiveKind === "notes" ? state.notes.text : (state[effectiveKind].find(i => i.id === editing)?.updated ?? null);
              if (kind === "tasks") {
                const item = state[taskCollection].find(item => item.id === editing);
                setDue(item?.due ?? ""); setAssignee(item?.assignee ?? "");
              }
              setDraftReset(value => value + 1);
              setConflicted(false);
            }}
          >
            Use latest text
          </Button>
        </div>
      ));
  const connectionError = disconnected ? "Live updates are disconnected. Your draft is kept. Reconnecting…" : error;
  if (kind === "comments") return <DocumentCommentsView connection={connection} state={state}
    draftReset={draftReset} text={text} editing={editing} reply={reply} busy={busy || mutation.uncertain || disconnected} error={connectionError} conflicted={conflicted} conflict={conflictPanel}
    following={following} onFollowing={value=>{
      followRef.current=value;setFollowing(value);
      try {localStorage.setItem(`aether-comments-follow:${connection.key}:${state?.actor}`,String(value));} catch { /* Optional preference. */ }
      if(value)void refresh();
    }}
    onText={value=>{dirty.current=true;setText(value);}}
    onCancel={()=>{setEditing(null);setReply(null);setText("");dirty.current=false;editRevision.current=null;setConflicted(false);}}
    onSubmit={submit} onEdit={edit} onRemove={deleted}
    onReply={item=>{setReply(item.id);setEditing(null);setText("");dirty.current=false;editRevision.current=null;setConflicted(false);}}
    onResolve={item=>void mutate("update",{resolved:!item.resolved},item.id)} />;
  if (kind === "notes") return <DocumentNotesView
    loaded={!!state} canEdit={!!state && state.actor === state.owner}
    editing={notesEditing} busy={busy || mutation.uncertain || disconnected} conflicted={conflicted} text={text}
    savedText={state?.notes.text ?? ""} error={connectionError} conflict={conflictPanel}
    onRefresh={() => void refresh()}
    onEdit={() => {
      if (!state || state.actor !== state.owner) return;
      setText(state.notes.text); setNotesEditing(true); setError("");
      dirty.current = true;
      editRevision.current = state.revision; editOriginal.current = state.notes.text;
    }}
    onChange={value => { dirty.current = true; setText(value); }}
    onSave={() => void submit()}
    onCancel={() => {
      setNotesEditing(false); setText(state?.notes.text ?? ""); setError("");
      dirty.current = false; editRevision.current = null; editOriginal.current = null; setConflicted(false);
    }} />;
  if (kind === "tasks") return <ActionItemsView documentKey={connection.key} state={state}
    busy={busy || mutation.uncertain || disconnected} error={connectionError} conflicted={conflicted} conflict={conflictPanel}
    editing={editing} collection={taskCollection} text={text} due={due} assignee={assignee}
    onCollection={setTaskCollection} onText={value => { dirty.current = true; setText(value); }} onDue={setDue} onAssignee={setAssignee}
    onSubmit={() => submit()} onCancel={() => {
      setEditing(null); setText(""); setDue(""); setAssignee(""); setError("");
      dirty.current = false; editRevision.current = null; editOriginal.current = null; setConflicted(false);
    }}
    onEdit={(item, collection) => { setTaskCollection(collection); edit(item); }}
    onRemove={deleted} onStatus={(item, collection, status) => void mutate("update", {status}, item.id, false, collection)} />;
  return (
    <section className="aui-document-panel" aria-label={titles[kind]}>
      <header>
        <h3>{titles[kind]}</h3>
        <Button disabled={busy || mutation.uncertain || disconnected} onClick={() => void refresh()}>Refresh</Button>
      </header>
      {connectionError && <p role="alert">{connectionError}</p>}
      {conflictPanel}
      {!state && <p>Connecting to this document…</p>}
      <label>
        Show
        <select aria-label={`${titles[kind]} filter`} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="open">Open</option><option value="done">Completed</option><option value="all">All</option>
        </select>
      </label>
      <form onSubmit={e => { e.preventDefault(); void submit(); }}>
        <label>
          {editing ? "Edit item" : "Reminder"}
          <textarea aria-label={`${titles[kind]} text`} value={text}
            onChange={e => { dirty.current = true; setText(e.target.value); }} maxLength={1000} rows={3} />
        </label>
        <label>Due date<input aria-label="Due date" type="date" value={due} onChange={e => setDue(e.target.value)} /></label>
        <label>
          Assigned to
          <select aria-label="Assigned to" value={assignee || state?.actor || ""} onChange={e => setAssignee(e.target.value)}>
            {state?.members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
        <div className="aui-document-actions">
          <Button primary type="submit" disabled={busy || disconnected || conflicted || !state || !text.trim()}>
            {editing ? "Save changes" : "Add reminder"}
          </Button>
          {editing && <Button onClick={() => {
            setEditing(null); setText(""); dirty.current = false; editRevision.current = null; setConflicted(false);
          }}>Cancel edit</Button>}
        </div>
      </form>
      <ul aria-label={titles[kind]}>
        {items?.map(item => <li key={item.id}>
          <strong>{item.text}</strong>
          <small>{person(item.assignee ?? item.author)}{item.due
            ? ` · Due ${item.due}${item.status !== "done" && item.due < new Date().toLocaleDateString("en-CA") ? " · Overdue" : ""}` : ""}</small>
          <label>
            Status
            <select aria-label={`Status for ${item.text}`} disabled={busy || !(canEdit(item) || item.assignee === state?.actor)}
              value={item.status} onChange={e => void mutate("update", {status: e.target.value}, item.id)}>
              <option value="open">Open</option><option value="in_progress">In progress</option><option value="done">Done</option>
            </select>
          </label>
          {canEdit(item) && <div className="aui-document-actions">
            <Button disabled={busy || mutation.uncertain || disconnected} onClick={() => edit(item)}>Edit item</Button>
            <Button disabled={busy || mutation.uncertain || disconnected} onClick={() => deleted(item)}>Remove item</Button>
          </div>}
        </li>)}
      </ul>
      {state && !items?.length && <p>No items in this view.</p>}
      {!!state?.activity.length && <details>
        <summary>Activity</summary>
        <ol>{state.activity.filter(event => event.collection === kind).map(event => <li key={event.revision}>
          <small>{event.author} · {event.operation} · {new Date(event.created * 1000).toLocaleString()}</small>
        </li>)}</ol>
      </details>}
    </section>
  );
}

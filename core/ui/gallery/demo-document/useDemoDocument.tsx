import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Dialog, FieldRow, TextField, type MenuItem } from "../../src";
import { demoDocumentMenu } from "./menu";
import { MAX_STUDY_BYTES, parseDemoDocument, studyFilename, type DemoDocument, type DemoMetadata } from "./document";
import "./demo-document.css";

export function useDemoDocument<T>({ app, initialName, data, validate, onOpen, onExport, onClose, demoItems, units, openLabel = "Open study…" }: {
  app: string; initialName: string; data: T; validate: (value: unknown) => T; onOpen: (data: T) => void;
  onExport: () => void; onClose: () => void; demoItems: readonly MenuItem[]; units: string; openLabel?: string;
}) {
  const key = `aether-ui-demo-recovery:${app}`;
  const [meta, setMeta] = useState<DemoMetadata>({ name: initialName, description: "", workspaceName: "Main", workspaceDescription: "" });
  const current: DemoDocument<T> = { format: "aether-ui-study", version: 1, app, ...meta, data };
  const serialized = JSON.stringify(current);
  const previous = useRef(serialized), saved = useRef(serialized);
  const picker = useRef<HTMLInputElement>(null);
  const [recovery, setRecovery] = useState<DemoDocument<T> | null>(() => {
    try { const text = localStorage.getItem(key); return text ? parseDemoDocument(text, app, validate) : null; } catch { return null; }
  });
  const [dialog, setDialog] = useState<string | null>(null), [draft, setDraft] = useState(meta);
  const [pending, setPending] = useState<DemoDocument<T> | null>(null), [error, setError] = useState("");
  const [download, setDownload] = useState<{ url: string; name: string; serialized: string } | null>(null);
  const dirty = saved.current !== serialized;
  useEffect(() => () => { if (download) URL.revokeObjectURL(download.url); }, [download]);
  useEffect(() => {
    if (serialized === previous.current) return;
    const timeout = window.setTimeout(() => {
      try { localStorage.setItem(key, serialized); setRecovery(JSON.parse(serialized)); previous.current = serialized; }
      catch { setError("Local recovery could not be stored. Save a study file to keep your changes."); }
    }, 400);
    return () => clearTimeout(timeout);
  }, [key, serialized]);
  function prepareDownload(doc: DemoDocument<T>) {
    setDownload({ url: URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" })), name: studyFilename(doc.name), serialized: JSON.stringify(doc) });
    setDialog("save");
  }
  function load(doc: DemoDocument<T>) {
    setMeta({ name: doc.name, description: doc.description, workspaceName: doc.workspaceName, workspaceDescription: doc.workspaceDescription });
    onOpen(doc.data); saved.current = JSON.stringify(doc); setPending(null); setDialog(null); setError("");
  }
  function run(id: string): boolean {
    if (!id.startsWith("file:")) return false;
    setError("");
    const action = id.slice(5);
    if (action === "export") onExport();
    else if (action === "save") prepareDownload(current);
    else if (action === "open") picker.current?.click();
    else if (action === "recover" && recovery) { setPending(recovery); setDialog("recover"); }
    else if (["details", "rename", "properties", "copy"].includes(action)) { setDraft(action === "copy" ? { ...meta, name: `Copy of ${meta.name}` } : meta); setDialog(action); }
    else if (action === "print") window.print();
    else if (action === "close") { if (dirty) setDialog("close"); else onClose(); }
    return true;
  }
  const currentRun = useRef(run); currentRun.current = run;
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || document.querySelector('[role="dialog"]')) return;
      if (event.key.toLowerCase() === "s" || event.key.toLowerCase() === "o") { event.preventDefault(); currentRun.current(event.key.toLowerCase() === "s" ? "file:save" : "file:open"); }
    };
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  }, []);
  async function readFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > MAX_STUDY_BYTES) throw Error("This study is too large to open (2 MB maximum).");
      const doc = parseDemoDocument(await file.text(), app, validate);
      if (dirty) { setPending(doc); setDialog("open"); } else load(doc);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not read the study."); setDialog("error"); }
  }
  const dismiss = () => { setDialog(null); setPending(null); };
  const titles: Record<string, string> = { save: "Save document", details: "Document details", rename: "Rename document", properties: "Workspace properties", copy: "Copy workspace", recover: "Recover local study", open: "Open study", close: "Close document", error: "Could not open study" };
  let content: ReactNode = null, actions: ReactNode = <Button onClick={dismiss}>Done</Button>;
  if (dialog === "save") content = <><p>Download a local demo study, including its editable objects and document properties. Reopen it with Open study.</p>{download && <a className="aui-button aui-button--primary" href={download.url} download={download.name} onClick={() => { if(download.serialized===serialized)saved.current = serialized; try { localStorage.setItem(key, serialized); setRecovery(current); } catch { setError("Recovery is unavailable; keep the downloaded file."); } }}>{download.name}</a>}</>;
  if (["rename", "details", "properties", "copy"].includes(dialog ?? "")) {
    const workspace = dialog === "properties";
    content = <div className="demo-document-fields">
      <FieldRow label={workspace ? "Workspace name" : "Document name"} htmlFor="demo-document-name"><TextField id="demo-document-name" autoFocus maxLength={160} value={workspace ? draft.workspaceName : draft.name} onChange={event => setDraft(value => ({ ...value, [workspace ? "workspaceName" : "name"]: event.target.value }))}/></FieldRow>
      {(dialog === "details" || workspace) && <FieldRow label="Description" htmlFor="demo-document-description"><TextField id="demo-document-description" maxLength={4000} value={workspace ? draft.workspaceDescription : draft.description} onChange={event => setDraft(value => ({ ...value, [workspace ? "workspaceDescription" : "description"]: event.target.value }))}/></FieldRow>}
      <p>{dialog === "copy" ? "Download an independent copy of this workspace. The current document stays open." : `Local demo study · ${units} · No Studio document connected`}</p>
    </div>;
    actions = <><Button onClick={dismiss}>Cancel</Button><Button primary disabled={!draft.name.trim() || !draft.workspaceName.trim()} onClick={() => { const next = { ...draft, name: draft.name.trim(), workspaceName: draft.workspaceName.trim() }; if (dialog === "copy") prepareDownload({ ...current, ...next }); else { setMeta(next); dismiss(); } }}>{dialog === "copy" ? "Create copy" : "Apply"}</Button></>;
  }
  if (dialog === "open" || dialog === "recover") {
    content = <><p>{dialog === "recover" ? "Restore the last local recovery saved in this browser." : "Replace the current study with this saved file."}</p><p><strong>{pending?.name}</strong> · {pending?.workspaceName}</p>{dirty && <p>Current edits will be replaced. Cancel and save first if you want to keep them.</p>}</>;
    actions = <><Button onClick={dismiss}>Cancel</Button><Button primary onClick={() => pending && load(pending)}>{dialog === "recover" ? "Recover" : "Open study"}</Button></>;
  }
  if (dialog === "close") {
    content = <p>This study has unsaved changes. Save a study file before closing to keep a portable copy.</p>;
    actions = <><Button onClick={dismiss}>Cancel</Button><Button onClick={onClose}>Close without saving</Button><Button primary onClick={() => prepareDownload(current)}>Save document</Button></>;
  }
  return {
    meta, dirty, run,
    items: demoDocumentMenu({ hasRecovery: !!recovery, openLabel, unitLabel: units, demoItems }),
    dialogs: <><input ref={picker} hidden type="file" aria-label="Open study file" accept=".aetherstudy.json,application/json" onChange={event => { void readFile(event.target.files?.[0]); event.target.value = ""; }}/><Dialog open={!!dialog} title={titles[dialog ?? ""] ?? "Document"} onClose={dismiss} actions={actions}>{content}{error && <p role="alert">{error}</p>}</Dialog>{error && !dialog && <output className="demo-document-error" role="status">{error}</output>}</>,
  };
}

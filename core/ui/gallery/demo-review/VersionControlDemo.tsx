import { useEffect, useState } from "react";
import { Button, Dialog, FieldRow, SelectField, TextField, VersionControl, type DocumentHistory, type VersionControlEntry } from "../../src";
import { documentHistoryGraph } from "../../src/document-history-graph";
import { documentHistoryPreview } from "../document-history-preview";
import { ReviewModelPreview } from "./ReviewModelPreview";

type CreateKind = "version" | "branch" | "release";
/** Window-local presentation adapter. Original history fixture, transport and
 * product restore/merge semantics are intentionally independent of this design. */
export function VersionControlDemo({ activeBranch, currentSnapshot, captureSnapshot }: { activeBranch?: string; currentSnapshot?: string; captureSnapshot?: () => string | undefined }) {
  const [entries, setEntries] = useState<VersionControlEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dialog, setDialog] = useState<CreateKind | "compare" | null>(null);
  const [creationSource, setCreationSource] = useState<string>();
  const [name, setName] = useState(""), [description, setDescription] = useState("");
  const [notice, setNotice] = useState(""), [target, setTarget] = useState("");
  useEffect(() => {
    let live = true;
    void documentHistoryPreview.call<DocumentHistory>("history").then(history => {
      if (!live) return;
      // This variant adds a merge example without changing the original reference fixture.
      const example = { ...history, revisions: history.revisions.map(save => save.revision === 6
        ? { ...save, merge_parent_revision: 7, saved: save.saved + 60 }
        : save.revision === 7 ? { ...save, saved: save.saved - 60 } : save) };
      setEntries(documentHistoryGraph(example).map(row => ({
        id: row.id, name: row.name, description: row.message || (row.kind === "workspace" ? "Latest development branch" : "Initial document"),
        kind: row.kind === "workspace" ? row.branch === "Main" ? "workspace" : "branch" : row.kind === "start" ? "start" : row.status === "released" ? "release" : row.status === "candidate" ? "review" : row.status === "obsolete" ? "deprecated" : row.id === "version:Merge checkpoint" ? "merge" : row.branch !== "Main" ? "branch" : "version",
        branch: row.branch, lane: row.lane, parents: row.parents, primaryParents: row.primaryParents, author: row.author || "Designer", saved: row.saved,
        current: row.id === "workspace:Main",
        changes: row.id === "workspace:Main" ? ["Reduced wall thickness to 2.5 mm", "Updated bracket clearance", "Modified mounting geometry"] : row.kind === "start" ? [] : [row.message || `Updated ${row.name}`],
        preview: row.id === "workspace:Main" ? <ReviewModelPreview/> : undefined,
      })));
    });
    return () => { live = false; };
  }, []);
  const displayedEntries = entries.map(entry => entry.current && currentSnapshot ? { ...entry, snapshot:currentSnapshot } : entry);
  const current = entries.find(entry => entry.id === selected);
  const other = entries.find(entry => entry.id === target);
  const invalid = !name.trim() ? "Enter a name." : entries.some(entry => entry.name.toLowerCase() === name.trim().toLowerCase()) ? "This name is already used." : "";
  function create(kind: CreateKind, sourceID?: string) { setCreationSource(sourceID); setDialog(kind); setName(""); setDescription(""); }
  function save() {
    if (invalid || !dialog || dialog === "compare") return;
    const id = crypto.randomUUID(), title = name.trim();
    const source = entries.find(entry => entry.id === creationSource) ?? current ?? entries.find(entry => entry.branch === activeBranch) ?? entries.find(entry => entry.current) ?? entries[0];
    const parents = source ? [source.id] : [];
    const entry: VersionControlEntry = { id, name: title, description: description.trim() || (dialog === "branch" ? `Branched from ${source?.name ?? 'Main'}` : "Named checkpoint"),
      kind: dialog, branch: dialog === "branch" ? title : source?.branch ?? "Main",
      lane: dialog === "branch" ? Math.max(0, ...entries.map(item => item.lane)) + 1 : source?.lane ?? 0,
      parents, primaryParents: parents, author: "You", saved: Date.now() / 1000,
      snapshot: captureSnapshot?.(),
      changes: [description.trim() || `Created ${dialog} from ${source?.name ?? 'Main'}`] };
    setEntries(value => [entry, ...value]); setSelected(id); setDialog(null); setNotice(`Created ${title} in this demo.`);
  }
  return <>
    <VersionControl entries={displayedEntries} activeBranch={activeBranch} selected={selected} onSelect={setSelected} onCreate={create}
      onCompare={id => { setSelected(id); setTarget(entries.find(entry => entry.id !== id)?.id ?? ""); setDialog("compare"); }}
      notice={notice}/>
    <Dialog open={dialog !== null} title={dialog === "compare" ? "Compare versions" : dialog === "branch" ? "Create branch" : dialog === "release" ? "Create release" : "Create version"} onClose={() => setDialog(null)} actions={<><Button onClick={() => setDialog(null)}>{dialog === "compare" ? "Done" : "Cancel"}</Button>{dialog !== "compare" && <Button primary disabled={!!invalid} onClick={save}>Create</Button>}</>}>
      {dialog === "compare" ? <>
        <FieldRow label="Compare"><strong>{current?.name}</strong></FieldRow>
        <FieldRow label="With"><SelectField aria-label="Compare with version" value={target} options={entries.filter(entry => entry.id !== selected).map(entry => ({ value: entry.id, label: entry.name }))} onChange={e => setTarget(e.target.value)}/></FieldRow>
        <p>Version details</p><div className="aui-vc-comparison"><section><strong>{current?.name}</strong><p>{current?.description}</p><ul>{current?.changes.filter(change => change !== current.description).map((change, index) => <li key={index}>{change}</li>)}</ul></section><section><strong>{other?.name}</strong><p>{other?.description}</p><ul>{other?.changes.filter(change => change !== other.description).map((change, index) => <li key={index}>{change}</li>)}</ul></section></div>
      </> : <form onSubmit={event => { event.preventDefault(); save(); }}>
        <FieldRow label="Name"><TextField autoFocus aria-label="Version name" placeholder={dialog === "branch" ? "Branch name" : "Version name"} value={name} onChange={event => setName(event.target.value)}/></FieldRow>
        <FieldRow label="Description"><TextField aria-label="Version description" placeholder="What changed?" value={description} onChange={event => setDescription(event.target.value)}/></FieldRow>
        {name.trim() && invalid && <p role="alert">{invalid}</p>}
      </form>}
    </Dialog>
  </>;
}

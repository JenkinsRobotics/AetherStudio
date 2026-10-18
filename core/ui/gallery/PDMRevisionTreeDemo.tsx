import { useState } from "react";
import { Button } from "../src/Button";
import { Dialog } from "../src/Dialog";
import { TextField } from "../src/TextField";
import { DocumentRevisionTree } from "../src/DocumentRevisionTree";
import { createPDMExample, exampleSelection, exampleDrafts, saveExample, createExampleVersion, branchExample, takeOverExample, releaseExample, nameProblem } from "./pdm-revision-example";
import "./PDMRevisionTreeDemo.css";

export function PDMRevisionTreeDemo() {
  const [state, setState] = useState(createPDMExample);
  const [dialog, setDialog] = useState<"version" | "branch" | "restore" | "reset" | null>(null);
  const [name, setName] = useState(""), [message, setMessage] = useState("");
  const [notice, setNotice] = useState("Select a milestone to branch, take over or release.");
  const selected = exampleSelection(state), drafts = exampleDrafts(state);
  const currentBranch = state.history.branches.find(item => item.id === state.branch)!;
  const head = state.content[currentBranch.head_revision];
  const invalid = dialog === "version" || dialog === "branch" ? nameProblem(state, dialog, name) : "";
  function open(kind: typeof dialog) { setName(""); setMessage(""); setDialog(kind); }
  function submit() {
    if (invalid) return;
    if (dialog === "version") { setState(createExampleVersion(state, name, message)); setNotice(`Created ${name.trim()} from the current draft.`); }
    if (dialog === "branch") { setState(branchExample(state, name)); setNotice(`Created ${name.trim()} from ${selected?.name}'s saved snapshot.`); }
    if (dialog === "restore") { setState(takeOverExample(state)); setNotice(`Copied ${selected?.name} into the ${currentBranch.name} draft. Save when ready.`); }
    if (dialog === "reset") { setState(createPDMExample()); setNotice("Example reset."); }
    setDialog(null);
  }
  return <div className="pdm-revision-demo">
    <div className="pdm-revision-demo-intro"><div><strong>Branches, versions & releases</strong><p>A compact PDM history, with room for every direction a document takes.</p></div><Button onClick={() => open("reset")}>Reset example</Button></div>
    <div className="pdm-revision-demo-surface">
      <DocumentRevisionTree history={state.history} branch={state.branch} selection={state.selection} drafts={drafts}
        onBranchChange={branch => { setState({ ...state, branch, selection: `workspace:${branch}` }); setNotice("Switched branch. Each branch keeps its draft edits."); }}
        onSelect={row => setState({ ...state, selection: row.id })}
        actions={{
          save: { onInvoke: () => { setState(saveExample(state)); setNotice("Draft saved. Create a version to mark this snapshot."); }, disabled: !drafts[state.branch].dirty, reason: "Save edits to this branch without creating a named version." },
          version: { onInvoke: () => open("version"), reason: "Save pending edits and capture a named version." },
          branch: { onInvoke: () => open("branch"), disabled: !selected, reason: "Branch from the selected saved snapshot; unsaved edits stay in their original branch." },
          restore: { onInvoke: () => open("restore"), disabled: !selected || state.content[selected.revision] === state.drafts[state.branch], reason: "Copy the selected saved snapshot into the current draft." },
          release: { onInvoke: () => { setState(releaseExample(state)); setNotice(`${selected?.name} marked as released.`); }, disabled: selected?.kind !== "version" || selected.status === "released" || selected.status === "obsolete", reason: "Select an unreleased version to release it." },
        }} />
    </div>
    <div className="pdm-revision-demo-workbench">
      <label className="pdm-revision-demo-editor"><span>Draft note <code>{currentBranch.name}</code><small>{drafts[state.branch].dirty ? "Unsaved" : "Saved"}</small></span>
        <textarea aria-label="Draft note" value={state.drafts[state.branch]} onChange={event => setState({ ...state, drafts: { ...state.drafts, [state.branch]: event.target.value } })} />
        <span className="pdm-revision-demo-hint">Edit this note, then save or create a version.</span>
      </label>
      <div className="pdm-revision-demo-inspector"><span>Selected snapshot <code>{selected?.name ?? "None"}</code></span><p>{selected ? state.content[selected.revision] : "Select a milestone."}</p><small>{selected?.kind === "workspace" ? "Saved branch content; pending draft edits are shown in the editor." : selected?.status === "released" ? "Released version · captured content stays unchanged." : "A captured version stays unchanged when you edit a draft."}</small></div>
    </div>
    <div className="pdm-revision-demo-status" role="status">{notice}</div>
    <p className="pdm-revision-demo-footnote">Local interaction preview · Changes last while this showcase is open. Studio owns saved PDM history, permissions and release rules.</p>
    <Dialog open={dialog !== null} title={dialog === "version" ? "Create version" : dialog === "branch" ? "Create branch" : dialog === "restore" ? "Take over snapshot" : "Reset example"} onClose={() => setDialog(null)} actions={<><Button onClick={() => setDialog(null)}>Cancel</Button><Button primary disabled={!!invalid} onClick={submit}>{dialog === "restore" ? "Replace draft" : dialog === "reset" ? "Reset" : "Create"}</Button></>}>
      {(dialog === "version" || dialog === "branch") ? <div className="pdm-revision-demo-form">
        <p>{dialog === "version" ? `Capture the current ${currentBranch.name} draft, including unsaved edits.` : `Start from ${selected?.name}'s saved content. Existing drafts are preserved.`}</p>
        <label>Name<TextField aria-label={dialog === "version" ? "Version name" : "Branch name"} value={name} maxLength={48} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") submit(); }} /></label>
        {dialog === "version" && <label>Description<TextField aria-label="Version description" value={message} maxLength={160} onChange={event => setMessage(event.target.value)} /></label>}
        {name && invalid && <p role="alert">{invalid}</p>}
      </div> : dialog === "restore" ? <div className="pdm-revision-demo-form"><p>Replace the current {currentBranch.name} draft with {selected?.name}'s saved content? Pending edits in this branch will be replaced. Existing snapshots and versions stay intact.</p><blockquote>{selected && state.content[selected.revision]}</blockquote><p>{head === state.drafts[state.branch] ? "This will be an unsaved draft change." : "You have unsaved edits in this draft."}</p></div> : <p>Discard local changes and return to the original three-branch example?</p>}
    </Dialog>
  </div>;
}

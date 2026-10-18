import { useState } from "react";
import { DashboardCard } from "./DashboardCards";
import { SegmentedControl } from "./SegmentedControl";
import { TextField } from "./TextField";
import { FileField } from "./FileField";
import { Button } from "./Button";
import "./WorkflowWidgets.css";
export interface PersonalizationSource { kind: string; url: string; files: readonly File[]; notes: string; }
export function PersonalizationForm({ onImport }: { onImport: (source: PersonalizationSource) => void }) {
  const [kind, setKind] = useState("website"), [url, setURL] = useState(""), [files, setFiles] = useState<readonly File[]>([]), [notes, setNotes] = useState("");
  return <DashboardCard contentOnly density="compact" title="Personalize" className="aui-workflow"><form className="aui-workflow-stack" onSubmit={e => { e.preventDefault(); onImport({ kind, url, files, notes }); }}>
    <SegmentedControl ariaLabel="Source type" value={kind} onChange={setKind} options={[{ id: "website", label: "Website" }, { id: "document", label: "Document" }, { id: "manual", label: "Manual" }]} />
    {kind === "website" ? <label className="aui-workflow-field">Company URL<TextField type="url" required value={url} onChange={e => setURL(e.target.value)} placeholder="https://company.com" /></label> : kind === "document" ? <FileField label="Company document" files={files} onFilesChange={setFiles} accept=".pdf,.txt,.docx" /> : <label className="aui-workflow-field">Company information<textarea required value={notes} onChange={e => setNotes(e.target.value)} placeholder="Describe your audience and value proposition" /></label>}
    <p className="aui-workflow-hint">Add your audience and value proposition from a source, or enter them manually.</p>
    <Button type="submit" disabled={kind === "document" && !files.length}>Import source</Button>
  </form></DashboardCard>;
}

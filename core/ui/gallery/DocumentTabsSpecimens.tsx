import { useState } from "react";
import { AetherIcon, Button, Dialog, DocumentTabBar, ToolIcon } from "../src";
import { WheelPreview } from "./wheel-studio/WheelReferenceWidgets";
import "./DocumentTabsSpecimens.css";

type StudyDocument = { id: string; label: string; detail: string };
const initial: StudyDocument[] = [
  { id: "wheel", label: "train when", detail: "Part Studio" },
  { id: "assembly", label: "Assembly 1", detail: "Assembly" },
];
const artwork = (doc: StudyDocument) => doc.id === "wheel" ? <WheelPreview /> : <ToolIcon name={doc.detail === "Assembly" ? "assembly" : "part"} />;

/** Independent navigation specimen: changing documents does not launch an app. */
export function DocumentTabsSpecimens() {
  const [documents, setDocuments] = useState(initial);
  const [active, setActive] = useState("wheel");
  const [overview, setOverview] = useState(false);
  const selected = documents.find(doc => doc.id === active)!;
  const add = (kind: string) => {
    const detail = kind === "assembly" ? "Assembly" : "Part Studio";
    const number = documents.filter(doc => doc.detail === detail).length + 1;
    const doc = { id: `${kind}-${documents.length + 1}`, label: `${detail} ${number}`, detail };
    setDocuments(current => [...current, doc]);
    setActive(doc.id);
  };
  return <div className="studio-document-specimen">
    <div className="studio-document-specimen-heading"><strong>Studio · thumbnail tabs</strong><span>50px footer · full width</span></div>
    <DocumentTabBar variant="studio" ariaLabel="Studio documents" tabs={documents.map(doc => ({ ...doc, icon: artwork(doc), current: doc.id === active, onSelect: () => setActive(doc.id) }))}
      addLabel="Add studio document" addItems={[{ id: "part", label: "Part Studio", icon: <ToolIcon name="part" /> }, { id: "assembly", label: "Assembly", icon: <ToolIcon name="assembly" /> }]} onAdd={add} onOverview={() => setOverview(true)} />
    <div className="studio-document-specimen-caption"><span aria-live="polite">{selected.label} · {selected.detail}</span><Button onClick={() => { setDocuments(initial); setActive("wheel"); }}>Reset example</Button></div>
    <p className="studio-document-specimen-note">Add documents, switch with the tabs or chevron, and browse them from the grid. Narrow rows collect extra tabs under More documents.</p>
    <Dialog open={overview} title="Document overview" onClose={() => setOverview(false)}>
      <div className="studio-document-overview">{documents.map(doc => <button key={doc.id} type="button" aria-current={doc.id === active ? "page" : undefined} onClick={() => { setActive(doc.id); setOverview(false); }}>
        <span aria-hidden>{artwork(doc)}</span><span><strong>{doc.label}</strong><small>{doc.detail}</small></span>{doc.id === active ? <AetherIcon name="check" /> : null}
      </button>)}</div>
    </Dialog>
  </div>;
}

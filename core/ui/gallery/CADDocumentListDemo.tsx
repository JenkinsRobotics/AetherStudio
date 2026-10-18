import { useState } from "react";
import { AetherIcon } from "../src/AetherIcon";
import { Button } from "../src/Button";
import { Dialog } from "../src/Dialog";
import { DocumentList } from "../src/DocumentList";
import { Menu } from "../src/Menu";
import { SelectField } from "../src/SelectField";
import { TextField } from "../src/TextField";
import { CAD_LIST_EXAMPLE, cadListItems, cadMetadataProblem, type CADListExample, type CADListFilter, type CADListSort } from "./cad-document-list-example";
import "./CADDocumentListDemo.css";

export function CADDocumentListDemo() {
  const [items, setItems] = useState([...CAD_LIST_EXAMPLE]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CADListFilter>("all"), [sort, setSort] = useState<CADListSort>("original"), [ascending, setAscending] = useState(true);
  const [edit, setEdit] = useState<CADListExample | null>(null), [reset, setReset] = useState(false);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [notice, setNotice] = useState("Select a document to inspect it. Double-click to edit its details.");
  const active = items.find(item => selected.has(item.id));
  const visible = cadListItems(items, filter, sort, ascending);
  const problem = edit ? cadMetadataProblem(items, edit) : "";
  function open(id: string) { const item = items.find(row => row.id === id); if (item) { setSelected(new Set([id])); setEdit({ ...item }); } }
  function save() {
    if (!edit || problem) return;
    const updated = { ...edit, name: edit.name.trim(), reference: edit.reference?.trim() };
    setItems(items.map(item => item.id === updated.id ? updated : item)); setNotice(`Updated ${updated.reference} · ${updated.name}.`); setEdit(null);
  }
  return <div className="cad-document-demo">
    <div className="cad-document-demo-heading"><div><strong>Every part, at a glance.</strong><p>Model thumbnails, part numbers and revision context in one quiet list.</p></div><Button onClick={() => setReset(true)}>Reset example</Button></div>
    <div className="cad-document-demo-layout">
      <div className="cad-document-demo-card">
        <DocumentList items={visible.map(item => ({ ...item, thumbnail: <img src={item.image} alt="" draggable={false} /> }))} selectedIDs={selected} query={query} onQueryChange={setQuery} ariaLabel="CAD documents" height={600}
          onSelect={(ids, mode) => setSelected(current => {
            if (mode !== "toggle") return new Set(ids);
            const next = new Set(current); for (const id of ids) { if (next.has(id)) next.delete(id); else next.add(id); } return next;
          })}
          onOpen={open} onContextMenu={(id,x,y) => setMenu({ id,x,y })}
          toolbar={<>
            <SelectField aria-label="Document filter" value={filter} onChange={event => setFilter(event.target.value as CADListFilter)} options={[{value:"all",label:"All documents"},{value:"parts",label:"Parts"},{value:"assemblies",label:"Assemblies"},{value:"drafts",label:"Drafts"}]} />
            <div className="cad-document-demo-sort"><SelectField aria-label="Sort documents" value={sort} onChange={event => setSort(event.target.value as CADListSort)} options={[{value:"original",label:"Library order"},{value:"reference",label:"Part number"},{value:"name",label:"Name"},{value:"version",label:"Version"}]} /><Button aria-label={ascending ? "Sort descending" : "Sort ascending"} title={ascending ? "Ascending — reverse order" : "Descending — reverse order"} onClick={() => setAscending(!ascending)}><AetherIcon name={ascending ? "chevron-up" : "chevron-down"} width={13} height={13} /></Button></div>
          </>} />
      </div>
      <aside className="cad-document-demo-inspector" aria-label="Document inspector">
        {active ? <>
          <div className="cad-document-demo-preview"><img src={active.image} alt={`${active.name} illustrative thumbnail`} /></div>
          <span className="cad-document-demo-reference">{active.reference}</span><h3>{active.name}</h3>
          <dl><dt>Type</dt><dd>{active.kind}</dd><dt>Material</dt><dd>{active.material}</dd><dt>Version</dt><dd>{active.version ?? "—"}</dd><dt>Revision</dt><dd>{active.revision ?? "—"}</dd>{active.status && <><dt>{active.status.kind === "branch" ? "Branch" : "Status"}</dt><dd>{active.status.label}</dd></>}</dl>
          <p className="cad-document-demo-notes">{active.notes || "No notes."}</p>
          <Button onClick={() => open(active.id)}><AetherIcon name="pencil" width={13} height={13} />Edit details</Button>
          {selected.size > 1 && <p className="cad-document-demo-hint">{selected.size} documents selected. Showing {active.reference}.</p>}
        </> : <div className="cad-document-demo-empty"><AetherIcon name="file-part" width={34} height={34} /><h3>Parts & assemblies</h3><p>Select a row to see its thumbnail, revision and notes.</p><p>⌘ / Ctrl-click to select more.<br />Shift-click for a range.<br />Arrow keys to browse.</p></div>}
      </aside>
    </div>
    <div className="cad-document-demo-notice" role="status">{notice}</div>
    <p className="cad-document-demo-footnote">Local showcase · Illustrative thumbnails and editable sample metadata. Changes last while this section is open.</p>
    {menu && <Menu open anchor={menu} ariaLabel="Document actions" items={[{ id:"details",label:"Edit details",icon:<AetherIcon name="pencil" /> }]} onSelect={() => { open(menu.id);setMenu(null); }} onClose={() => setMenu(null)} />}
    <Dialog open={!!edit} title="Document details" onClose={() => setEdit(null)} actions={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button primary disabled={!!problem} onClick={save}>Save details</Button></>}>
      {edit && <div className="cad-document-demo-form">
        <div className="cad-document-demo-form-preview"><img src={edit.image} alt={`${edit.name} illustrative thumbnail`} /><span>{edit.kind} · {edit.version ?? edit.status?.label ?? "Draft"}{edit.revision && ` · Revision ${edit.revision}`}</span></div>
        <label>Name<TextField aria-label="Document name" value={edit.name} maxLength={100} onChange={event => setEdit({ ...edit, name: event.target.value })} /></label>
        <label>Part number<TextField aria-label="Part number" value={edit.reference ?? ""} maxLength={40} onChange={event => setEdit({ ...edit, reference: event.target.value })} /></label>
        <label>Material<SelectField aria-label="Material" value={edit.material} options={["Steel","Aluminium","Brass","Polymer","Mixed"].map(value => ({value,label:value}))} onChange={event => setEdit({ ...edit, material:event.target.value })} /></label>
        <label>Notes<textarea aria-label="Document notes" value={edit.notes} maxLength={2000} onChange={event => setEdit({ ...edit, notes:event.target.value })} /></label>
        {problem && <p role="alert">{problem}</p>}
      </div>}
    </Dialog>
    <Dialog open={reset} title="Reset CAD list" onClose={() => setReset(false)} actions={<><Button onClick={() => setReset(false)}>Cancel</Button><Button primary onClick={() => { setItems([...CAD_LIST_EXAMPLE]);setSelected(new Set());setQuery("");setFilter("all");setSort("original");setAscending(true);setReset(false);setNotice("Original document list restored."); }}>Reset</Button></>}><p>Discard local metadata edits and restore the original document list?</p></Dialog>
  </div>;
}

import { useState } from "react";
import { Button, Checkbox, Dialog, SearchField, SelectField, TextField } from "../../src/index";
import { aetherThemes } from "../../src/themes";
import { SHOWCASE_TABS, sectionLabel } from "../showcase";
import type { CollectionKind, ShowcaseCollection } from "./collections";

const headings: Record<CollectionKind, string> = { collection: "Collections", app: "App collections", theme: "Theme collections" };
export function ShowcaseCollections({ kind, collections, selectedId, selectedSection, onNavigate, onCreate }: {
  kind: CollectionKind;
  collections: readonly ShowcaseCollection[];
  selectedId?: string;
  selectedSection: string;
  onNavigate: (collection: ShowcaseCollection, section?: string) => void;
  onCreate: (kind: CollectionKind) => void;
}) {
  const [query, setQuery] = useState("");
  const search = query.trim().toLowerCase();
  const entries = collections.filter(item => item.kind === kind && (!search || `${item.label} ${item.description} ${item.sections.map(sectionLabel).join(" ")}`.toLowerCase().includes(search)));
  const group = (custom: boolean) => entries.filter(item => Boolean(item.custom) === custom).map(item => <div key={item.id} className="showcase-collection" data-selected={selectedId === item.id}>
    <button type="button" className="showcase-collection-title" aria-expanded={selectedId === item.id} onClick={() => onNavigate(item)} title={item.description}>
      {item.themeId && <span className="showcase-theme-dot" style={{ background: aetherThemes.find(theme => theme.id === item.themeId)?.modes.light["color-accent"] }} />}
      <span>{item.label}</span><small>{item.sections.length}</small>
    </button>
    {selectedId === item.id && <ul>{item.sections.map(title => <li key={title}><button type="button" aria-current={selectedSection === title ? "page" : undefined} onClick={() => onNavigate(item, title)}>{sectionLabel(title)}</button></li>)}</ul>}
  </div>);
  return <nav className="showcase-library showcase-collections" aria-label={headings[kind]}>
    <header><strong>{headings[kind]}</strong><p>{kind === "theme" ? "Preview the same controls in a scoped theme." : "Open a focused set of existing specimens."}</p></header>
    <SearchField ariaLabel={`Search ${headings[kind].toLowerCase()}`} placeholder="Find a collection…" value={query} onQueryChange={setQuery} />
    <div className="showcase-library-separator">Aether collections</div>{group(false)}
    {entries.some(item => item.custom) && <><div className="showcase-library-separator">Your collections</div>{group(true)}</>}
    {!entries.length && <p role="status">No matching collections.</p>}
    <Button className="showcase-new-collection" onClick={() => onCreate(kind)}>New collection</Button>
  </nav>;
}

export function ShowcaseCollectionEditor({ initial, existing, onSave, onClose }: {
  initial: ShowcaseCollection;
  existing: readonly ShowcaseCollection[];
  onSave: (collection: ShowcaseCollection) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(initial.label);
  const [description, setDescription] = useState(initial.description);
  const [kind, setKind] = useState(initial.kind);
  const [themeId, setThemeId] = useState(initial.themeId ?? aetherThemes[0].id);
  const [selected, setSelected] = useState(new Set(initial.sections));
  const [query, setQuery] = useState("");
  const duplicate = existing.some(item => item.id !== initial.id && item.label.toLowerCase() === label.trim().toLowerCase());
  const valid = label.trim().length > 0 && selected.size > 0 && !duplicate;
  return <Dialog open title={existing.some(item => item.id === initial.id) ? "Edit collection" : "New collection"} onClose={onClose} actions={<>
    <Button onClick={onClose}>Cancel</Button><Button primary disabled={!valid} onClick={() => onSave({ ...initial, custom: true, label: label.trim(), description: description.trim(), kind, themeId: kind === "theme" ? themeId : undefined, sections: SHOWCASE_TABS.flatMap(tab => tab.sections.filter(title => selected.has(title))) })}>Save collection</Button>
  </>}>
    <div className="showcase-collection-form">
      <label>Name<TextField aria-label="Collection name" autoFocus maxLength={80} value={label} onChange={event => setLabel(event.target.value)} placeholder="e.g. Website references" /></label>
      <label>Description<TextField aria-label="Collection description" maxLength={240} value={description} onChange={event => setDescription(event.target.value)} /></label>
      <label>Place in<SelectField aria-label="Collection group" value={kind} onChange={event => setKind(event.target.value as CollectionKind)} options={[{ value: "collection", label: "Collections" }, { value: "app", label: "App collections" }, { value: "theme", label: "Theme collections" }]} /></label>
      {kind === "theme" && <label>Preview theme<SelectField aria-label="Collection theme" value={themeId} onChange={event => setThemeId(event.target.value)} options={aetherThemes.map(theme => ({ value: theme.id, label: theme.name }))} /></label>}
      <div className="showcase-collection-members-heading"><strong>Sections</strong><span>{selected.size} selected</span></div>
      <SearchField ariaLabel="Find collection sections" placeholder="Find sections…" value={query} onQueryChange={setQuery} />
      <div className="showcase-collection-members">
        {SHOWCASE_TABS.map(tab => {
          const sections = tab.sections.filter(title => `${tab.label} ${sectionLabel(title)}`.toLowerCase().includes(query.trim().toLowerCase()));
          return sections.length ? <fieldset key={tab.id}><legend>{tab.label}</legend>{sections.map(title => <Checkbox key={title} label={sectionLabel(title)} checked={selected.has(title)} onChange={event => setSelected(current => { const next = new Set(current); if (event.target.checked) next.add(title); else next.delete(title); return next; })} />)}</fieldset> : null;
        })}
      </div>
      <p role="status">{duplicate ? "A collection with this name already exists." : !selected.size ? "Choose at least one section." : "Collections save in this browser and reference the original specimens."}</p>
    </div>
  </Dialog>;
}

import { useEffect, useState } from "react";
import { AetherIcon, Button, Dialog, DocumentTabBar, FileManagerPanel, IconButton, MenuButton, SelectField, TextField, type MenuItem } from "../../src";
import { CREATE_TOOLS, type ModelPart } from "./state";

type PartFolder = { id: string; name: string; parts: string[] };

/** Part selection and window-local tab organization share the existing scene bodies. */
export function ModelPartsFooter({ hidden, name, fileItems, parts, selected, onSelect, onAction }: {
  hidden: boolean; name: string; fileItems: readonly MenuItem[];
  parts: ModelPart[]; selected: string; onSelect: (id: string) => void; onAction: (id: string) => void;
}) {
  const [panel, setPanel] = useState<"folders" | "parts" | null>(null);
  const [folders, setFolders] = useState<PartFolder[]>([]);
  const [newFolder, setNewFolder] = useState("");
  useEffect(() => { if (hidden) setPanel(null); }, [hidden]);
  const folderFor = (id: string) => folders.find(folder => folder.parts.includes(id));
  const groups = [
    { id: "ungrouped", label: folders.length ? "Ungrouped parts" : "Parts", parts: parts.filter(part => !folderFor(part.id)) },
    ...folders.map(folder => ({ id: folder.id, label: folder.name || "Untitled folder", parts: parts.filter(part => folder.parts.includes(part.id)) })),
  ];
  const close = () => setPanel(null);
  return <footer className="ps-parts-footer" aria-label="Parts footer" hidden={hidden}>
    <DocumentTabBar variant="studio" ariaLabel="Model parts" addLabel="Add scene part"
      addItems={CREATE_TOOLS.map(item => ({ ...item, icon: <AetherIcon name={item.icon}/> }))} onAdd={onAction}
      tabs={[
        { id: "scene", label: name, detail: "Model study", icon: <AetherIcon name="layers"/>, current: !selected, onSelect: () => onSelect("") },
        ...groups.flatMap(group => group.parts.map(part => ({ id: part.id, label: part.name, detail: folderFor(part.id)?.name || (part.visible ? "Scene part" : "Hidden part"), icon: <AetherIcon name="cube"/>, current: selected === part.id, onSelect: () => onSelect(part.id) }))),
      ]}
      trailing={<>
        <IconButton label="Folder manager" size="medium" aria-haspopup="dialog" aria-expanded={panel === "folders"} onClick={() => setPanel("folders")}><AetherIcon name="folder"/></IconButton>
        <IconButton label="Part manager" size="medium" aria-haspopup="dialog" aria-expanded={panel === "parts"} onClick={() => setPanel("parts")}><AetherIcon name="part-manager"/></IconButton>
        <MenuButton label="File menu" className="aui-icon-button ps-tray-file" data-size="medium" data-appearance="rounded" items={fileItems} placement="top-end" onSelect={onAction}><AetherIcon name="menu"/></MenuButton>
      </>}/>
    <Dialog open={panel === "parts"} title="Part manager" onClose={close} actions={<Button onClick={close}>Done</Button>}>
      <div className="ps-part-manager"><FileManagerPanel ariaLabel="Scene parts" documentName={name} showLibrary={false} activeID={selected}
        documentGroups={groups.map(group => ({ id: group.id, label: group.label, emptyText: "No parts in this folder.", items: group.parts.map(part => ({ id: part.id, name: part.name, kind: "part", detail: part.visible ? "Scene part" : "Hidden part", icon: <AetherIcon name="cube"/> })) }))}
        onOpen={item => { onSelect(item.id); close(); }}/></div>
    </Dialog>
    <Dialog open={panel === "folders"} title="Folder manager" onClose={close} actions={<Button onClick={close}>Done</Button>}>
      <div className="ps-part-folders">
        <p>Organize this window’s part tabs into folders.</p>
        <form onSubmit={event => { event.preventDefault(); if (!newFolder.trim()) return; setFolders(value => [...value, { id: crypto.randomUUID(), name: newFolder.trim(), parts: [] }]); setNewFolder(""); }}>
          <TextField aria-label="New part folder name" placeholder="Folder name" maxLength={80} value={newFolder} onChange={event => setNewFolder(event.target.value)}/>
          <Button type="submit" disabled={!newFolder.trim()}>New folder</Button>
        </form>
        {folders.map(folder => <div className="ps-part-folder-row" key={folder.id}><AetherIcon name="folder"/>
          <TextField aria-label={`Rename folder ${folder.name}`} maxLength={80} value={folder.name} onChange={event => setFolders(value => value.map(item => item.id === folder.id ? { ...item, name: event.target.value } : item))}/>
          <IconButton label={`Ungroup ${folder.name || "Untitled folder"}`} size="small" onClick={() => setFolders(value => value.filter(item => item.id !== folder.id))}><AetherIcon name="close"/></IconButton>
        </div>)}
        <div className="ps-part-folder-assignments">{parts.map(part => <label key={part.id}><span title={part.name}>{part.name}</span>
          <SelectField aria-label={`Folder for ${part.name}`} value={folderFor(part.id)?.id ?? ""} options={[{ value: "", label: "Ungrouped" }, ...folders.map(folder => ({ value: folder.id, label: folder.name || "Untitled folder" }))]}
            onChange={event => setFolders(value => value.map(folder => ({ ...folder, parts: [...folder.parts.filter(id => id !== part.id), ...(folder.id === event.target.value ? [part.id] : [])] })))}/>
        </label>)}</div>
      </div>
    </Dialog>
  </footer>;
}

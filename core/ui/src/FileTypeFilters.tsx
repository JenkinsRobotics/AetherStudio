import { FileIcon } from "./FileIcon";
import { AetherIcon } from "./AetherIcon";
import { Menu } from "./Menu";
import { useRef, useState } from "react";
import { FILE_TYPES, type FileTypeDefinition } from "./file-types";
import "./FileTypeFilters.css";

/** The same file identities used by library rows, presented as quick filters. */
export function FileTypeFilters({ value, onChange, types = FILE_TYPES, quickIDs = ["part", "assembly", "show", "pdf"] }: {
  value: string;
  onChange: (id: string) => void;
  types?: readonly FileTypeDefinition[];
  quickIDs?: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const quick = quickIDs.flatMap(id => types.filter(type => type.id === id));
  const more = types.filter(type => !quickIDs.includes(type.id));
  const selectedMore = more.find(type => type.id === value);
  return <div className="aui-file-type-filters" role="group" aria-label="Filter files by type">
    <button type="button" aria-pressed={value === "all"} onClick={() => onChange("all")}>All</button>
    {quick.map(type => <button type="button" key={type.id} aria-pressed={value === type.id} onClick={() => onChange(type.id)}>
      <FileIcon type={type} size={16} />{type.plural}
    </button>)}
    {more.length > 0 && <>
      <button type="button" ref={trigger} aria-label="More file types" aria-haspopup="menu"
        aria-expanded={open} data-selected={!!selectedMore || undefined} onClick={() => setOpen(!open)}>
        {selectedMore ? <FileIcon type={selectedMore} size={16} /> : <AetherIcon name="filter" />}{selectedMore?.plural ?? "More"}<AetherIcon name="chevron-down" />
      </button>
      <Menu open={open} anchor={trigger.current} ariaLabel="More file types" className="aui-file-type-menu"
        items={more.map(type => ({id: type.id, label: type.plural, icon: <FileIcon type={type} size={16} />, kind: "radio", checked: value === type.id}))}
        onSelect={onChange} onClose={() => setOpen(false)} />
    </>}

  </div>;
}

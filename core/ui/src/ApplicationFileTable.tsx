import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import "./ApplicationFileTable.css";
import {selectListItems} from "./list-selection";

export interface ApplicationFileRow {
  id: string;
  name: string;
  icon: ReactNode;
  location?: ReactNode;
  date: ReactNode;
  owner: ReactNode;
}

export interface ApplicationFileColumn<T> {
  id: string;
  label: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  /** Hide lower-priority metadata on narrow screens. */
  secondary?: boolean;
}

/** App-home file presentation. Storage, permissions and commands belong to the caller. */
export function ApplicationFileTable<T extends ApplicationFileRow>({
  rows, selectedIds, onSelect, onOpen, onContextMenu, renderActions,
  onToggle, onSelectAll, dateLabel = "Opened", label = "Files",
  columns, compact = false, sort, onSort, onSelectedIdsChange,
}: {
  rows: readonly T[];
  selectedIds: ReadonlySet<string>;
  onSelectedIdsChange?: (selected: Set<string>) => void;
  onSelect: (row: T, event: MouseEvent) => void;
  onOpen: (row: T) => void;
  onContextMenu?: (row: T, event: MouseEvent) => void;
  renderActions?: (row: T) => ReactNode;
  onToggle?: (row: T, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  dateLabel?: string;
  label?: string;
  columns?: readonly ApplicationFileColumn<T>[];
  compact?: boolean;
  sort?: { id: string; ascending: boolean };
  onSort?: (id: string) => void;
}) {
  const selectionAnchor = useRef<string | null>(null);
  const toggle = onToggle ?? (onSelectedIdsChange ? (row:T, checked:boolean) => {const next = new Set(selectedIds); if (checked) next.add(row.id); else next.delete(row.id); selectionAnchor.current=row.id; onSelectedIdsChange(next);} : undefined);
  const selectAll = onSelectAll ?? (onSelectedIdsChange ? (checked:boolean)=>onSelectedIdsChange(new Set(checked ? rows.map(row=>row.id) : [])) : undefined);
  const all = rows.length > 0 && rows.every(row => selectedIds.has(row.id));
  const some = rows.some(row => selectedIds.has(row.id));
  const checkbox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (checkbox.current) checkbox.current.indeterminate = some && !all;
  }, [all, some]);
  const metadata = columns ?? [
    {id: "date", label: dateLabel, render: (row: T) => row.date},
    {id: "owner", label: "Owner", render: (row: T) => row.owner, secondary: true},
  ];
  const direction = (id: string) => sort?.id === id ? sort.ascending ? "ascending" as const : "descending" as const : undefined;
  const heading = (id: string, title: string, sortable = true) => onSort && sortable
    ? <button type="button" className="aui-application-file-sort" onClick={() => onSort(id)}>{title}<span aria-hidden="true">{sort?.id === id ? sort.ascending ? " ↑" : " ↓" : " ⌄"}</span></button>
    : title;
  return <table className="aui-application-file-table" data-compact={compact || undefined} data-has-selection={some || undefined} aria-label={label}>
    <thead><tr>
      <th scope="col" aria-label="Name" aria-sort={direction("name")}><span className="aui-application-file-table-heading">
        {selectAll && <input ref={checkbox} type="checkbox" aria-label="Select all files" checked={all} onChange={event => selectAll(event.target.checked)} />}
        {heading("name", "Name")}
      </span></th>
      {metadata.map(col => <th key={col.id} scope="col" aria-sort={direction(col.id)} data-secondary={col.secondary || undefined}>{heading(col.id, col.label, col.sortable ?? false)}</th>)}
    </tr></thead>
    <tbody>{rows.map(row => <tr key={row.id} data-selected={selectedIds.has(row.id) || undefined}
      onMouseDown={event=>{if (onSelectedIdsChange && (event.shiftKey || event.metaKey || event.ctrlKey)) event.preventDefault();}}
      onClick={event => { if (event.detail < 2) { onSelect(row, event); if (onSelectedIdsChange) {onSelectedIdsChange(selectListItems(rows.map(item=>item.id),selectedIds,selectionAnchor.current,row.id,event.shiftKey,event.metaKey || event.ctrlKey)); if (!event.shiftKey) selectionAnchor.current=row.id;} } }} onDoubleClick={() => onOpen(row)}
      onContextMenu={onContextMenu ? event => onContextMenu(row, event) : undefined}>
      <td><div className="aui-application-file-cell">
        {toggle && <input type="checkbox" aria-label={`Select ${row.name}`} checked={selectedIds.has(row.id)}
          onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}
          onChange={event => toggle(row, event.target.checked)} />}
        <button type="button" className="aui-application-file-name" onKeyDown={event => {
          if (event.key === "Enter") { event.preventDefault(); onOpen(row); }
        }}>
          {row.icon}<span><strong>{row.name}</strong>{row.location && <small>{row.location}</small>}</span>
        </button>
        {renderActions && <div className="aui-application-file-actions" onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
          {renderActions(row)}
        </div>}
      </div></td>
      {metadata.map(col => <td key={col.id} data-secondary={col.secondary || undefined}>{col.render(row)}</td>)}
    </tr>)}</tbody>
  </table>;
}

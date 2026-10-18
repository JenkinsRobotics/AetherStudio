import { useRef, type ReactNode } from "react";
import { AetherIcon } from "./AetherIcon";
import { ListBoxRows, type ListBoxProps } from "./ListBox";
import { SearchField } from "./SearchField";
import "./DocumentList.css";

/** Display metadata supplied by the host; this does not define PDM semantics. */
export interface DocumentListItem {
  id: string;
  name: string;
  reference?: string;
  thumbnail?: ReactNode;
  version?: string;
  revision?: string;
  revisionStyle?: "solid" | "outline";
  status?: { label: string; kind: "draft" | "branch" };
  disabled?: boolean;
}
export interface DocumentListProps {
  items: readonly DocumentListItem[];
  selectedIDs: ReadonlySet<string>;
  onSelect: NonNullable<ListBoxProps["onSelect"]>;
  onOpen?: (id: string) => void;
  onContextMenu?: ListBoxProps["onContextMenu"];
  query: string;
  onQueryChange: (query: string) => void;
  ariaLabel?: string;
  selectionMode?: "single" | "multiple";
  height?: number;
  loading?: boolean;
  error?: ReactNode;
  /** Optional controls above the search field, supplied by the host. */
  toolbar?: ReactNode;
}
export function filterDocumentListItems(items: readonly DocumentListItem[], query: string): DocumentListItem[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(item => {
    const text = [item.name, item.reference, item.version, item.revision, item.status?.label].filter(Boolean).join(" ").toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}

/** Thumbnail list using the common list selection, keyboard and windowing behavior. */
export function DocumentList({ items, selectedIDs, onSelect, onOpen, onContextMenu, query, onQueryChange, ariaLabel = "Documents", selectionMode = "multiple", height = 590, loading, error, toolbar }: DocumentListProps) {
  const search = useRef<HTMLInputElement>(null), root = useRef<HTMLDivElement>(null);
  const visible = filterDocumentListItems(items, query);
  const hiddenSelection = selectedIDs.size - visible.filter(item => selectedIDs.has(item.id)).length;
  return <div className="aui-document-list" ref={root} onKeyDown={event => {
    const editable = (event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]');
    if (event.key === "/" && !editable && !event.metaKey && !event.ctrlKey && !event.altKey) { event.preventDefault(); search.current?.focus(); }
    if (event.key === "ArrowDown" && event.target === search.current) { event.preventDefault(); root.current?.querySelector<HTMLElement>('[role="option"][tabindex="0"]')?.focus(); }
  }}>
    {toolbar && <div className="aui-document-list-toolbar">{toolbar}</div>}
    <div className="aui-document-list-search">
      <SearchField value={query} onQueryChange={onQueryChange} inputRef={search} ariaLabel={`Search ${ariaLabel.toLowerCase()}`} placeholder="Search documents" />
      {!query && <button type="button" className="aui-document-list-shortcut" aria-label="Focus document search" title="Search · / while the list is focused" onClick={() => search.current?.focus()}><kbd>/</kbd></button>}
    </div>
    <div className="aui-document-list-scroll" style={{ maxHeight: height }}>
      <ListBoxRows items={visible.map(item => ({ id: item.id, label: item.name, description: item.reference, disabled: item.disabled,
        icon: item.thumbnail ?? <AetherIcon name="document" width={24} height={24} />,
        accessory: <span className="aui-document-list-metadata">
          {item.version && <span className="aui-document-list-version" aria-label={`Version ${item.version}`} title={`Version ${item.version}`}>{item.version}</span>}
          {item.revision && <span className="aui-document-list-revision" data-outline={item.revisionStyle === "outline" || undefined} aria-label={`Revision ${item.revision}`} title={`Revision ${item.revision}`}>{item.revision}</span>}
          {item.status && <span className="aui-document-list-status" data-kind={item.status.kind} title={`${item.status.kind === "branch" ? "Branch" : "Status"}: ${item.status.label}`}>
            {item.status.kind === "branch" && <span className="aui-document-list-branch-dot" aria-hidden />}{item.status.label}
          </span>}
        </span>,
      }))} selectedIDs={selectedIDs} onSelect={onSelect} onActivate={onOpen} onContextMenu={onContextMenu} selectionMode={selectionMode} ariaLabel={ariaLabel}
        rowHeight={58} height={height} loading={loading} error={error} emptyState={query ? "No matching documents." : "No documents yet."} />
    </div>
    <div className="aui-document-list-footer" role="status">{loading ? "Loading documents…" : error ? "Documents unavailable" : `${visible.length} of ${items.length} documents`}{!loading && !error && selectedIDs.size > 0 && <span>{selectedIDs.size} selected{hiddenSelection > 0 && ` · ${hiddenSelection} hidden`} <button type="button" aria-label="Clear document selection" onClick={() => onSelect([], "single")}>Clear</button></span>}</div>
  </div>;
}

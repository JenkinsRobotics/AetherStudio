import { FileIcon } from "./FileIcon";
import { useMemo, useState, type ReactNode } from "react";
import { AetherIcon } from "./AetherIcon";
import { MenuButton } from "./Menu";
import { IconButton } from "./IconButton";
import "./FileManagerPanel.css";

/**
 * The file manager every Aether app shows in its left rail.
 *
 * Jonathan, 2026-10-03, with Onshape and Fusion side by side: Onshape's tab
 * manager lists what the open document is made of, Fusion's tree browses the
 * directory the document sits in, "and I want both these functions". So this
 * is one panel with two registers — what is *inside* this document, and where
 * it *lives* — rather than two panels a person has to choose between.
 *
 * Presentation only. It is given its two lists and reports what was clicked;
 * the product owns the transport, which is what lets Aether CAD, Map and
 * Animation show the same panel over entirely different stores.
 */

export type FileManagerKind = "folder" | "file" | "part" | "assembly" | "drawing" | "scene" | "layer" | "component";

export interface FileManagerItem {
  id: string;
  name: string;
  kind: FileManagerKind;
  /** The second line: "Part Studio", "Assembly", a date — whatever names the row's type. */
  detail?: string;
  /** The version chip at the row's trailing edge. */
  badge?: string;
  /** What the chip means on hover — the named version behind the number. */
  badgeTitle?: string;
  /** Overrides the icon the kind would choose. */
  icon?: ReactNode;
  /** A preview, drawn in place of the icon when present. */
  thumbnail?: ReactNode;
  disabled?: boolean;
}

export interface FileManagerGroup {
  id: string;
  label: string;
  items: readonly FileManagerItem[];
  /** Shown in place of an empty list, so a group never reads as broken. */
  emptyText?: string;
}

export interface FileManagerPanelProps {
  /** The open document. Omitted when the app has none, and the panel then shows only the library. */
  documentName?: string;
  /** What the open document is made of — Onshape's tabs, grouped by kind. */
  documentGroups?: readonly FileManagerGroup[];
  /** Where the document lives — Fusion's tree. Root first, current folder last. */
  path?: readonly { id: string | null; name: string }[];
  libraryItems?: readonly FileManagerItem[];
  libraryLabel?: string;
  /** Hide library browsing when this panel is used for document contents only. */
  showLibrary?: boolean;
  libraryEmptyText?: string;
  /** The row drawn as current, usually the open part or document. */
  activeID?: string | null;
  busy?: boolean;
  error?: string;
  onOpen: (item: FileManagerItem) => void;
  /** A folder row, or a crumb. Null is the library root. */
  onNavigate?: (folderID: string | null) => void;
  onRefresh?: () => void;
  /** Rendered beside the heading — an app's own New or Upload actions. */
  actions?: ReactNode;
  libraryActions?: ReactNode;
  ariaLabel?: string;
}

const KIND_ICON: Record<FileManagerKind, string> = {
  folder: "file-folder",
  file: "file-generic",
  part: "file-part",
  assembly: "file-assembly",
  drawing: "file-drawing",
  scene: "image",
  layer: "layers",
  component: "cube",
};

const itemIcon = (item: FileManagerItem) => item.icon ?? (item.kind === "file" ? <FileIcon file={item} /> : <AetherIcon name={KIND_ICON[item.kind]} />);

const matches = (item: FileManagerItem, needle: string) =>
  !needle || `${item.name} ${item.detail ?? ""}`.toLowerCase().includes(needle);

export function FileManagerPanel({
  documentName, documentGroups = [], path = [], libraryItems = [],
  libraryLabel = "Library", showLibrary = true, libraryEmptyText = "This folder is empty.",
  activeID = null, busy = false, error = "",
  onOpen, onNavigate, onRefresh, actions, libraryActions, ariaLabel = "Files",
}: FileManagerPanelProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("document");
  const [filter, setFilter] = useState("all");
  const [compact, setCompact] = useState(false);
  const needle = query.trim().toLowerCase();
  const allItems = [...documentGroups.flatMap(group => group.items), ...libraryItems];
  const types = [...new Set(allItems.map(item => item.detail || item.kind))];
  const active = allItems.find(item => item.id === activeID);
  const arrange = (items: readonly FileManagerItem[]) => items
    .filter(item => matches(item, needle) && (filter === "all" || (item.detail || item.kind) === filter))
    .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name, undefined, { numeric: true }) : sort === "type" ? (a.detail || a.kind).localeCompare(b.detail || b.kind) || a.name.localeCompare(b.name) : 0);

  const groups = useMemo(
    () => documentGroups.map((group) => ({ ...group, items: arrange(group.items) })),
    [documentGroups, needle, sort, filter],
  );
  const library = useMemo(() => arrange(libraryItems), [libraryItems, needle, sort, filter]);
  // A search that finds nothing anywhere should say so once, not once per group.
  const nothingFound = Boolean(needle || filter !== "all") && !library.length && groups.every((group) => !group.items.length);

  const row = (item: FileManagerItem) => (
    <li key={item.id}>
      <button
        type="button"
        className="aui-file-row"
        data-kind={item.kind}
        data-active={item.id === activeID || undefined}
        aria-current={item.id === activeID ? "true" : undefined}
        disabled={item.disabled}
        title={item.detail ? `${item.name} — ${item.detail}` : item.name}
        onClick={() => (item.kind === "folder" && onNavigate ? onNavigate(item.id) : onOpen(item))}
      >
        <span className="aui-file-row-icon" aria-hidden="true">
          {item.thumbnail ?? itemIcon(item)}
        </span>
        <span className="aui-file-row-text">
          <span className="aui-file-row-name">{item.name}</span>
          {item.detail ? <small>{item.detail}</small> : null}
        </span>
        {item.badge ? <span className="aui-file-row-badge" title={item.badgeTitle}>{item.badge}</span> : null}
        {item.kind === "folder" ? <AetherIcon name="chevron-right" className="aui-file-row-into" aria-hidden="true" /> : null}
      </button>
    </li>
  );

  return (
    <section className="aui-file-manager" data-compact={compact || undefined} aria-label={ariaLabel} aria-busy={busy || undefined}>
      <header className="aui-file-manager-head">
        <h2>{ariaLabel}</h2>
        <MenuButton label="Sort files" items={[
          { id: "document", label: "Document order", icon: <AetherIcon name="part-manager" />, kind: "radio", checked: sort === "document" },
          { id: "name", label: "Name", icon: <AetherIcon name="text" />, kind: "radio", checked: sort === "name" },
          { id: "type", label: "Type", icon: <AetherIcon name="folder" />, kind: "radio", checked: sort === "type" },
        ]} onSelect={setSort}><AetherIcon name="sort-chevron" /></MenuButton>
        <MenuButton label="Filter files by type" items={[
          { id: "all", label: "All types", icon: <AetherIcon name="part-manager" />, kind: "radio", checked: filter === "all" },
          ...types.map(type => ({ id: type, label: type, icon: itemIcon(allItems.find(item => (item.detail || item.kind) === type)!), kind: "radio" as const, checked: filter === type })),
        ]} onSelect={setFilter}><AetherIcon name="filter" /></MenuButton>
        <IconButton label="Compact file list" aria-pressed={compact} onClick={() => setCompact(!compact)}><AetherIcon name="list" /></IconButton>
        {actions}
        {onRefresh ? (
          <IconButton label="Refresh files" disabled={busy} onClick={onRefresh}><AetherIcon name="refresh" /></IconButton>
        ) : null}
      </header>

      <div className="aui-file-manager-search">
        <input
          type="search"
          value={query}
          placeholder="Search files"
          aria-label="Search files"
          onChange={(event) => setQuery(event.target.value)}
        />
        <AetherIcon name="search" aria-hidden="true" />
      </div>

      {error ? <p className="aui-file-manager-error" role="alert">{error}</p> : null}

      {filter !== "all" || needle ? <button className="aui-file-manager-clear" type="button" onClick={() => { setFilter("all"); setQuery(""); }}>Clear filters</button> : null}
      <div className="aui-file-manager-contents">
      {/* What this document is made of. */}
      {documentName ? (
        <div className="aui-file-manager-document">
          <h3 title={documentName}><AetherIcon name="document-text" aria-hidden="true" />{documentName}</h3>
          {groups.map((group) => (
            <div key={group.id} className="aui-file-manager-group">
              <h4>{group.label}</h4>
              {group.items.length ? (
                <ul>{group.items.map(row)}</ul>
              ) : needle ? null : <p className="aui-file-manager-dim">{group.emptyText ?? "None yet."}</p>}
            </div>
          ))}
        </div>
      ) : null}

      {/* Where it lives. */}
      {showLibrary && <div className="aui-file-manager-group aui-file-manager-library">
        <h4>{libraryLabel}</h4>
        {libraryActions}
        {path.length && onNavigate ? (
          <nav className="aui-file-manager-path" aria-label="Folder path">
            {path.map((crumb, index) => (
              <span key={crumb.id ?? "root"}>
                {index ? <AetherIcon name="chevron-right" aria-hidden="true" /> : null}
                <button type="button" disabled={index === path.length - 1} onClick={() => onNavigate(crumb.id)}>{crumb.name}</button>
              </span>
            ))}
          </nav>
        ) : null}
        {library.length ? <ul>{library.map(row)}</ul> : null}
        {!library.length && !needle ? <p className="aui-file-manager-dim">{libraryEmptyText}</p> : null}
      </div>}

      {nothingFound ? <p className="aui-file-manager-dim">{needle ? `Nothing matches “${query.trim()}”.` : "No items match this type."}</p> : null}
      </div>
      {active && <aside className="aui-file-manager-preview" aria-label="Selected item preview">
        <strong>{itemIcon(active)}{active.name}</strong>
        <div className="aui-file-manager-preview-art" aria-hidden="true">{active.thumbnail ?? itemIcon(active)}</div>
        <small>{active.detail || active.kind}{active.badge ? ` · ${active.badge}` : ""}</small>
      </aside>}
    </section>
  );
}

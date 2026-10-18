import { AetherIcon, IconButton } from "@aether/ui";
import {ListToolMenu as LibraryToolMenu} from "@aether/ui";

/** File-list controls shared by Drive's heading and Recent toolbar. */
export function DriveFileTools({ selectedCount, clearSelection, sort, setSort, sortAsc, setSortAsc,
  grid, setGrid, details, setDetails, busy, refresh, fileBrowser, shared = false, recycle = false }: {
  selectedCount: number; clearSelection: () => void;
  sort: string; setSort: (value: string) => void; sortAsc: boolean; setSortAsc: (value: boolean) => void;
  grid: boolean; setGrid: (value: boolean) => void; details: boolean; setDetails: (value: boolean) => void;
  busy: boolean; refresh: () => void; fileBrowser: boolean; shared?: boolean; recycle?: boolean;
}) {
  return (
              <div className="library-list-tools">
                {<button type="button" className="library-tool library-selected-chip"
                  style={{visibility: selectedCount > 0 ? "visible" : "hidden"}}
                  aria-label="Clear selection" onClick={clearSelection}>
                  <AetherIcon name="close" /> {selectedCount} selected
                </button>}
                <LibraryToolMenu label="Sort" icon={<AetherIcon name="sort-chevron" />}
                  onPick={id => id === "asc" || id === "desc" ? setSortAsc(id === "asc") : setSort(id)}
                  items={[
                    ...(recycle ? [["name", "Name", "text"], ["deleted_at", "Deleted", "history"], ["deleted_by", "Deleted by", "person"], ["created_by", "Created by", "person"], ["size", "File size", "document-text"]] : shared ? [["name", "Name", "text"], ["shared_at", "Date shared", "history"], ["shared_by", "Shared by", "person"]] : [["name", "Name", "text"], ["opened", "Opened", "history"], ["modified", "Modified", "history"], [fileBrowser ? "modified_by" : "owner", fileBrowser ? "Modified by" : "Owner", "person"], ["size", "Size", "document-text"]]).map(([id, label, icon]) => ({id, label, icon: <AetherIcon name={icon} />, checked: sort === id})),
                    { id: "asc", label: "Ascending", checked: sortAsc, icon: <AetherIcon name="sort-chevron" /> },
                    { id: "desc", label: "Descending", checked: !sortAsc, icon: <AetherIcon name="sort-chevron" /> },
                  ]} />
                <LibraryToolMenu label="" ariaLabel="File view" icon={<AetherIcon name={grid ? "layout" : "items"} />}
                  onPick={id => setGrid(id === "grid")}
                  items={[
                    { id: "list", label: "List view", checked: !grid, icon: <AetherIcon name="items" /> },
                    { id: "grid", label: "Grid view", checked: grid, icon: <AetherIcon name="layout" /> },
                  ]} />
                <button type="button" className="library-tool" aria-pressed={details} onClick={() => setDetails(!details)}>
                  <AetherIcon name="sidebar" /> Details
                </button>
                <IconButton label="Refresh files" disabled={busy} onClick={refresh}>
                  <AetherIcon name="refresh" />
                </IconButton>
              </div>
  );
}

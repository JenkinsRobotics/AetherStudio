import { useEffect, useRef, useState, type ReactNode } from "react";
import { AetherIcon } from "./AetherIcon";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { IconButton } from "./IconButton";
import { MenuButton } from "./Menu";
import { SearchField } from "./SearchField";
import { SegmentedControl } from "./SegmentedControl";
import { SelectField } from "./SelectField";
import { VersionControlGraph } from "./VersionControlGraph";
import { VersionBranchRow } from "./VersionBranchRow";
import { versionBranchIDs } from "./version-branch-entries";
import "./VersionControl.css";
import "./VersionBranchTimeline.css";

export type VersionControlKind = "workspace" | "branch" | "version" | "merge" | "review" | "release" | "deprecated" | "start" | "change" | "automatic";
export interface VersionControlEntry {
  id: string;
  name: string;
  description: string;
  kind: VersionControlKind;
  branch: string;
  /** Stable graph lane and actual ancestry, supplied by the document host. */
  lane: number;
  parents: readonly string[];
  primaryParents: readonly string[];
  author: string;
  saved: number;
  current?: boolean;
  changes: readonly string[];
  preview?: ReactNode;
  /** Host-supplied version label; storage revision IDs are not version numbers. */
  versionLabel?: string;
  /** Image captured for this entry, independent of the current viewport. */
  snapshot?: string;
}
export interface VersionControlProps {
  entries: readonly VersionControlEntry[];
  /** Follow a checked-out branch; null opens the complete graph. */
  activeBranch?: string | null;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onCreate?: (kind: "version" | "branch" | "release", sourceID?: string) => void;
  onCompare?: (id: string) => void;
  onRestore?: (id: string) => void;
  onMerge?: () => void;
  footer?: ReactNode;
  notice?: ReactNode;
}
const kinds: Record<VersionControlKind, { icon: string; label: string }> = {
  workspace: { icon: "workspace", label: "Workspace" }, branch: { icon: "version-control", label: "Branch" },
  version: { icon: "version", label: "Version" }, merge: { icon: "version-merge", label: "Merge" },
  review: { icon: "triangle", label: "Release candidate" }, release: { icon: "triangle-filled", label: "Release" },
  deprecated: { icon: "obsoletion", label: "Contains obsoletion" }, start: { icon: "workspace", label: "Start" },
  change: { icon: "change", label: "Change" }, automatic: { icon: "auto-version", label: "Automatic version" },
};

/** A content-only version-control variant. Hosts own records and operations;
 * this view only searches, filters and presents them. The original
 * DocumentVersionPanel and graph remain independent reference designs. */
export function VersionControl({ entries, activeBranch, selected, onSelect, onCreate, onCompare, onRestore, onMerge, footer, notice }: VersionControlProps) {
  const [tab, setTab] = useState("all"), [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest"), [filters, setFilters] = useState(false);
  const [branch, setBranch] = useState(activeBranch ?? "all"), [deprecated, setDeprecated] = useState(true);
  const [changes, setChanges] = useState<string | null>(null);
  const previousCount = useRef(entries.length);
  useEffect(() => { setBranch(activeBranch ?? "all"); setTab("all"); setChanges(null); }, [activeBranch]);
  useEffect(() => {
    if (previousCount.current > 0 && entries.length > previousCount.current) {
      setTab("all"); setQuery("");
      if (branch !== "all" && entries[0]?.kind === "branch") setBranch(entries[0].branch);
    }
    previousCount.current = entries.length;
  }, [entries.length]);
  const branches = [...new Set(entries.map(entry => entry.branch))];
  const branchView = branch !== "all";
  const branchIDs = branchView ? versionBranchIDs(entries, branch) : null;
  const chooseBranch = (value: string) => { setBranch(value); setTab("all"); setChanges(null); onSelect(null); };
  const visible = entries.filter(entry => (tab === "all" || (tab === "branches" ? ["workspace", "branch"].includes(entry.kind) : ["release", "review"].includes(entry.kind))) &&
    (!branchIDs || branchIDs.has(entry.id)) && (deprecated || entry.kind !== "deprecated") &&
    `${entry.name} ${entry.description} ${entry.author} ${entry.branch} ${entry.changes.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => sort === "oldest" ? a.saved - b.saved : b.saved - a.saved);
  const requestCreate = (kind: "version" | "branch" | "release") => {
    const source = entries.find(entry => entry.id === selected) ??
      (branchView ? entries.filter(entry => entry.branch === branch).sort((a,b) => b.saved - a.saved)[0] : entries.find(entry => entry.current));
    onCreate?.(kind, source?.id);
  };
  const options = [{ id: "version", label: "Create version", icon: <AetherIcon name="version"/> }, { id: "branch", label: "Create branch", icon: <AetherIcon name="version-control"/> }, { id: "release", label: "Create release", icon: <AetherIcon name="triangle-filled"/> }];
  return <section className="aui-version-control" data-branch-view={branchView} aria-label="Version control">
    <header className="aui-vc-heading">{!branchView && <AetherIcon name="version-control"/>}<h2>{branchView ? "Versions" : "Version control"}</h2>
      <span className="aui-vc-heading-spacer"/>
      <IconButton label="Version filters" size="small" aria-pressed={filters} onClick={() => setFilters(value => !value)}><AetherIcon name="filter"/></IconButton>
      <MenuButton className="aui-vc-more" label="Version control options" items={[{ id:"reset", label:"Clear filters", icon:<AetherIcon name="filter"/> },{ id:"oldest", label:sort === "oldest" ? "Newest first" : "Oldest first", icon:<AetherIcon name="arrow-down"/> }]} onSelect={id => { if (id === "reset") { setTab("all"); setQuery(""); setDeprecated(true); } else setSort(value => value === "oldest" ? "newest" : "oldest"); }}><AetherIcon name="more"/></MenuButton>
    </header>
    <SearchField ariaLabel="Search versions" placeholder="Search versions…" value={query} onQueryChange={setQuery}/>
    <div className="aui-vc-actions" role="toolbar" aria-label="Version actions">
      <div className="aui-vc-create"><Button primary aria-label="Create version" title="Create version" disabled={!onCreate} onClick={() => requestCreate("version")}><AetherIcon name="plus"/><span>Create version</span></Button><MenuButton label="Create version options" disabled={!onCreate} items={options} onSelect={id => requestCreate(id as "version" | "branch" | "release")}><AetherIcon name="chevron-down"/></MenuButton></div>
      <Button className="aui-vc-secondary" aria-label="Create branch" title="Create branch" disabled={!onCreate} onClick={() => requestCreate("branch")}><AetherIcon name="version-control"/><span>Branch</span></Button>
      <Button className="aui-vc-secondary" aria-label="Merge branches" title={onMerge ? "Merge branches" : "Merge requires a connected document"} disabled={!onMerge} onClick={onMerge}><AetherIcon name="version-merge"/><span>Merge</span></Button>
      <MenuButton className="aui-vc-branch-picker" label="Choose version branch" items={[{id:"all",label:"All branches · Full graph"},...branches.map(value => ({id:value,label:value,icon:<AetherIcon name="version-control"/>}))]} onSelect={chooseBranch}><span>{branchView ? branch : "All branches"}</span><AetherIcon name="chevron-down"/></MenuButton>
    </div>
    {filters && <div className="aui-vc-filters">
      <div className="aui-vc-view-controls"><SegmentedControl ariaLabel="Version categories" value={tab} onChange={setTab} options={[{id:"all",label:"All versions"},{id:"branches",label:"Branches"},{id:"releases",label:"Releases"}]}/></div>
      <SelectField aria-label="Version sort" value={sort} onChange={e => setSort(e.target.value)} options={[{ value:"newest", label:"Newest first" },{ value:"oldest", label:"Oldest first" }]}/>
      <Checkbox label="Show deprecated" checked={deprecated} onChange={e => setDeprecated(e.target.checked)}/>
    </div>}
    {notice && <div className="aui-vc-notice" role="status">{notice}</div>}
    <div className="aui-vc-list">
      <VersionControlGraph entries={entries} visible={visible} selected={selected} linear={branchView}>
      {visible.map(entry => {
        const active = entry.id === selected, kind = kinds[entry.kind];
        const entryMenu = <MenuButton className="aui-vc-more" label={`Version actions: ${entry.name}`} items={[{ id: "changes", label: "Show changes", icon: <AetherIcon name="change"/> }, { id: "compare", label: "Compare", icon: <AetherIcon name="compare"/>, disabled: !onCompare }, { id: "restore", label: "Restore", icon: <AetherIcon name="restore"/>, disabled: !onRestore }]} onSelect={id => { onSelect(entry.id); if (id === "changes") setChanges(entry.id); else if (id === "compare") onCompare?.(entry.id); else onRestore?.(entry.id); }}><AetherIcon name="more"/></MenuButton>;
        return <article key={entry.id} role="listitem" className="aui-vc-entry" data-entry-id={entry.id} data-kind={entry.kind} data-selected={active}>
          {branchView ? <VersionBranchRow entry={entry} active={active} icon={kind.icon} label={entry.kind === "deprecated" ? "Obsolete" : kind.label} menu={entryMenu} onSelect={() => { onSelect(active ? null : entry.id); setChanges(null); }}/> : <>
          <div className="aui-vc-entry-head" onClick={event => { if (!(event.target as HTMLElement).closest("button, input, select, a")) { onSelect(active ? null : entry.id); setChanges(null); } }}>
            <button type="button" className="aui-vc-select" aria-label={`Select ${entry.name}`} title={active ? "Click again to collapse and view the graph" : "Select version details"} aria-expanded={active} aria-pressed={active} onClick={() => { onSelect(active ? null : entry.id); setChanges(null); }}>
              <span className="aui-vc-kind"><AetherIcon name={kind.icon}/></span>
              <span className="aui-vc-entry-name"><strong title={entry.name}>{entry.name}</strong><small title={entry.description}>{entry.description}</small></span>
            </button>
            {!active && <span className="aui-vc-entry-person" title={`${entry.author} · ${new Date(entry.saved * 1000).toLocaleString()}`}><Avatar name={entry.author} size="small"/><time dateTime={new Date(entry.saved * 1000).toISOString()}>{new Date(entry.saved * 1000).toLocaleDateString([], { month:"short", day:"numeric" })}</time></span>}
            <span className="aui-vc-badge">{entry.current ? "Current" : kind.label}</span>
            {entryMenu}
          </div>
          </>}
          {active && (!branchView || changes === entry.id) && <div className="aui-vc-details">
            <div className="aui-vc-author"><Avatar name={entry.author} size="small"/><span>{entry.author}</span><time dateTime={new Date(entry.saved * 1000).toISOString()}>{new Date(entry.saved * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></div>
            {changes !== entry.id && <div className="aui-vc-change-preview">{entry.preview && <div className="aui-vc-thumbnail">{entry.preview}</div>}<div><strong>Changes in this version</strong>{entry.changes.length ? <ul>{(changes === entry.id ? entry.changes : entry.changes.slice(0, 3)).map((change, index) => <li key={index}>{change}</li>)}</ul> : <p>Initial document state.</p>}</div></div>}
            <div className="aui-vc-entry-actions">
              <Button primary aria-label={`${changes === entry.id ? "Hide" : "Show"} changes (${entry.changes.length})`} title={`${changes === entry.id ? "Hide" : "Show"} changes (${entry.changes.length})`} aria-expanded={changes === entry.id} onClick={() => setChanges(value => value === entry.id ? null : entry.id)}><AetherIcon name="change"/><span>{changes === entry.id ? "Hide" : "Changes"} ({entry.changes.length})</span></Button>
              <Button aria-label={`Compare ${entry.name}`} title={`Compare ${entry.name}`} disabled={!onCompare} onClick={() => onCompare?.(entry.id)}><AetherIcon name="compare"/><span>Compare</span></Button>
              <Button aria-label={`Restore ${entry.name}`} title={onRestore ? "Restore version" : "Restore requires a saved document snapshot"} disabled={!onRestore} onClick={() => onRestore?.(entry.id)}><AetherIcon name="restore"/><span>Restore</span></Button>
            </div>
            {changes === entry.id && <div className="aui-vc-change-list" aria-label={`Changes for ${entry.name}`}><strong>{entry.changes.length} changes · {entry.branch}</strong><ol>{entry.changes.map((change, index) => <li key={index}><AetherIcon name="check"/>{change}</li>)}</ol></div>}
          </div>}
        </article>;
      })}
      </VersionControlGraph>
      {!visible.length && <p className="aui-vc-empty">No matching versions.</p>}
    </div>
    <div className="aui-vc-legend" role="list" aria-label="Version types">{(["workspace", "version", "change", "review", "release", "deprecated", "automatic", "branch", "merge"] as const).map(id => { const kind = kinds[id]; return <span key={id} role="listitem" data-kind={id} title={kind.label}><AetherIcon name={kind.icon}/><span>{kind.label}</span></span>; })}</div>
    {footer && <footer className="aui-vc-footer">{footer}</footer>}
  </section>;
}

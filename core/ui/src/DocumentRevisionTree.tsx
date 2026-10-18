import { useMemo, type CSSProperties } from "react";
import { AetherIcon } from "./AetherIcon";
import { Button } from "./Button";
import { historyBranchKey, type DocumentHistory } from "./DocumentServices";
import { documentHistoryGraph, type HistoryMilestone } from "./document-history-graph";
import { visibleParents } from "./document-history-view";
import "./DocumentRevisionTree.css";

export type RevisionTreeAction = "save" | "version" | "branch" | "restore" | "release";
export interface RevisionTreeDraft { dirty: boolean; changed: boolean; sinceVersion?: string }
export interface DocumentRevisionTreeProps {
  history: DocumentHistory;
  /** Permanent branch key, never the mutable display label. */
  branch: string;
  selection: string;
  drafts?: Readonly<Record<string, RevisionTreeDraft>>;
  onBranchChange: (key: string) => void;
  onSelect: (row: HistoryMilestone) => void;
  /** Host owns authorization, flushing, concurrency, mutations and errors. */
  actions?: Partial<Record<RevisionTreeAction, { onInvoke: () => void; disabled?: boolean; reason?: string }>>;
  busy?: boolean;
}
const commands: { id: RevisionTreeAction; label: string; icon: string }[] = [
  { id: "save", label: "Save", icon: "save" },
  { id: "version", label: "Create version", icon: "tag" },
  { id: "branch", label: "Branch", icon: "branch-from" },
  { id: "restore", label: "Take over", icon: "restore" },
  { id: "release", label: "Release", icon: "tag" },
];

/** Compact, controlled PDM presentation of the existing history contract. */
export function DocumentRevisionTree({ history, branch, selection, drafts = {}, onBranchChange, onSelect, actions, busy = false }: DocumentRevisionTreeProps) {
  const graph = useMemo(() => documentHistoryGraph(history), [history]);
  const rows = useMemo(() => {
    const versions = new Set(history.versions.map(version => version.revision));
    return [
      ...graph.filter(row => row.kind !== "workspace" && !(row.kind === "start" && versions.has(row.revision))).reverse(),
      ...history.branches.flatMap(item => graph.filter(row => row.id === `workspace:${historyBranchKey(item)}`)),
    ];
  }, [graph, history]);
  const lanes = [...new Set([...history.branches.map(historyBranchKey), ...rows.map(row => row.branchID ?? row.branch)])];
  const gutter = Math.max(100, lanes.length * 30 + 34), height = rows.length * 40 + 40;
  const x = (row: HistoryMilestone) => 22 + lanes.indexOf(row.branchID ?? row.branch) * 30;
  const y = (index: number) => 20 + index * 40;
  const current = drafts[branch];
  return <div className="aui-revision-tree" aria-label="Revision tree" aria-busy={busy}>
    <div className="aui-revision-tree-heading">
      <div className="aui-revision-tree-branches" role="group" aria-label="Branches">
        {history.branches.map(item => <button type="button" key={historyBranchKey(item)} aria-pressed={branch === historyBranchKey(item)} disabled={busy} onClick={() => onBranchChange(historyBranchKey(item))}>
          <AetherIcon name="branch" width={13} height={13} />{item.name}
        </button>)}
      </div>
      <div className="aui-revision-tree-draft"><AetherIcon name="pencil" width={13} height={13} /><span>Draft</span><span className="aui-revision-tree-muted">{current?.dirty ? "unsaved changes" : current?.changed ? "changed" : current ? "up to date" : ""}{current?.sinceVersion && <> since <code>{current.sinceVersion}</code></>}</span></div>
    </div>
    <div className="aui-revision-tree-actions" role="group" aria-label="Revision actions">
      {commands.map(command => {
        const action = actions?.[command.id];
        return <Button key={command.id} className={`aui-revision-tree-action aui-revision-tree-action--${command.id}`} primary={command.id === "version"} disabled={busy || history.writable === false || !action || action.disabled} title={action?.reason} onClick={action?.onInvoke}>
          <AetherIcon name={command.icon} width={14} height={14} />{command.label}
        </Button>;
      })}
    </div>
    {rows.length ? <div className="aui-revision-tree-scroll">
      <div className="aui-revision-tree-graph" style={{ "--revision-gutter": `${gutter}px`, minWidth: gutter + 310, height } as CSSProperties}>
        <svg className="aui-revision-tree-lines" width={gutter} height={height} aria-hidden="true">
          {rows.flatMap((row, index) => visibleParents(row, graph, rows, true).map(id => {
            const parentIndex = rows.findIndex(item => item.id === id), parent = rows[parentIndex];
            if (!parent) return null;
            const middle = (y(index) + y(parentIndex)) / 2;
            return <path key={`${row.id}:${id}`} data-from={row.id} data-to={id} className={row.primaryParents.includes(id) ? "" : "is-merge"} d={`M ${x(parent)} ${y(parentIndex)} C ${x(parent)} ${middle}, ${x(row)} ${middle}, ${x(row)} ${y(index)}`} />;
          }))}
          {rows.map((row, index) => <g key={row.id} className={row.kind === "workspace" && (row.branchID ?? row.branch) === branch ? "is-current" : ""}>
            {row.kind === "workspace" && <path className="aui-revision-tree-continuation" d={`M ${x(row)} ${y(index)} V ${height}`} />}
            <circle cx={x(row)} cy={y(index)} r={6} />
            {row.kind !== "workspace" && <circle className="aui-revision-tree-dot" cx={x(row)} cy={y(index)} r={3} />}
          </g>)}
        </svg>
        <div role="group" aria-label="History milestones">
          {rows.map(row => {
            const key = row.branchID ?? row.branch, draft = drafts[key];
            const here = row.kind === "workspace" && key === branch;
            return <button type="button" key={row.id} className="aui-revision-tree-row" aria-pressed={selection === row.id} onClick={() => onSelect(row)}>
              <code className={row.kind === "workspace" ? "is-branch" : ""}>{row.name}</code>
              <span className={row.kind === "workspace" ? "aui-revision-tree-muted" : "aui-revision-tree-message"}>{row.kind === "workspace" ? `draft · ${draft?.dirty ? "unsaved changes" : draft?.changed ? "changed" : draft ? "as its version" : "saved snapshot"}` : row.message || (row.kind === "start" ? "Document created" : "Version")}</span>
              {row.status && row.status !== "version" && <span className="aui-revision-tree-state">{row.status}</span>}
              {here && <span className="aui-revision-tree-here">you are here</span>}
            </button>;
          })}
        </div>
      </div>
    </div> : <p className="aui-revision-tree-muted">No revision history yet.</p>}
  </div>;
}

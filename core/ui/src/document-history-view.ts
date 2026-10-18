import { historyBranchKey, historyReferenceKey, type DocumentHistory } from "./DocumentServices";
import type { HistoryMilestone } from "./document-history-graph";
export type BranchFilter = "all" | "workspaces" | "current" | "parents";
export type HistoryChange = DocumentHistory["revisions"][number];

/** Follow first-parent history: merged source changes remain on their own branch. */
export function milestoneChanges(row: HistoryMilestone, history: DocumentHistory): HistoryChange[] {
  if (row.kind === "start") return [];
  const byID = new Map(history.revisions.map(save => [save.revision, save]));
  const boundary = new Set(history.versions.filter(v => row.kind === "workspace" || v.revision !== row.revision).map(v => v.revision));
  const result: HistoryChange[] = [], seen = new Set<number>();
  let id: number | null = row.revision;
  while (id != null && !seen.has(id)) {
    seen.add(id);
    if (boundary.has(id)) break;
    const save = byID.get(id);
    if (!save || save.parent_revision == null) break;
    result.push(save);
    id = save.parent_revision;
  }
  return result;
}

export function visibleHistory(rows: HistoryMilestone[], history: DocumentHistory, branch: string, filter: BranchFilter, automatic: boolean, query: string): HistoryMilestone[] {
  const allowed = new Set(filter === "workspaces" ? history.branches.map(historyBranchKey) : [branch]);
  if (filter === "parents") {
    const byID = new Map(history.revisions.map(save => [save.revision, save]));
    let id: number | null | undefined = history.branches.find(b => historyBranchKey(b) === branch)?.head_revision;
    const seen = new Set<number>();
    while (id != null && !seen.has(id)) {
      seen.add(id);
      const save = byID.get(id);
      if (!save) break;
      allowed.add(historyReferenceKey(save)); id = save.parent_revision;
    }
  }
  const needle = query.trim().toLowerCase();
  return rows.filter(row => (automatic || row.origin !== "automatic") &&
    (needle || filter === "all" || row.kind === "start" || allowed.has(row.branchID ?? row.branch)) &&
    (!needle || [row.name, row.author, row.message, ...milestoneChanges(row, history).map(s => `${s.event} ${s.note} ${s.author}`)].join(" ").toLowerCase().includes(needle)));
}

type HistoryLinks = { id: string; parents: readonly string[]; primaryParents: readonly string[] };

/** Reconnect through filtered nodes, never leave dangling lines to hidden rows. */
export function visibleParents(row: HistoryLinks, all: readonly HistoryLinks[], shown: readonly HistoryLinks[], merges: boolean): string[] {
  const byID = new Map(all.map(item => [item.id, item]));
  const visible = new Set(shown.map(item => item.id));
  const found = new Set<string>(), seen = new Set<string>(), queue = [...(merges ? row.parents : row.primaryParents)];
  while(queue.length) {
    const id = queue.pop()!;
    if(seen.has(id)) continue;
    seen.add(id);
    const parent = byID.get(id);
    if(!parent) continue;
    if(visible.has(id)) found.add(id);
    else queue.push(...(merges ? parent.parents : parent.primaryParents));
  }
  return [...found];
}

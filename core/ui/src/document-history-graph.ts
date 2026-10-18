import { historyBranchKey, historyReferenceKey, type DocumentHistory, type DocumentVersionStatus } from "./DocumentServices";

export interface HistoryMilestone {
  id: string;
  kind: "workspace" | "version" | "start";
  name: string;
  revision: number;
  branch: string;
  branchID?: string;
  author: string;
  saved: number;
  message: string;
  lane: number;
  parents: string[];
  primaryParents: string[];
  status?: DocumentVersionStatus;
  origin?: "user" | "automatic";
  statusUpdated?: number;
  statusNote?: string;
}

/** Saved snapshot IDs are transport/concurrency tokens, never version numbers.
 * Project only explicit versions, each workspace head, and document creation.
 * Follow real parents through omitted saves so parallel branches aren't joined
 * by their timestamps. Distinct labels at the same snapshot remain distinct. */
export function documentHistoryGraph(
  history: DocumentHistory,
): HistoryMilestone[] {
  const snapshots = new Map(
    history.revisions.map((save) => [save.revision, save]),
  );
  const lanes = [
    "Main",
    ...new Set(
      [
        ...history.branches.map(historyBranchKey),
        ...history.versions.map(
          (version) => historyReferenceKey(version.branch ? version : snapshots.get(version.revision) ?? {}),
        ),
      ].filter((name) => name !== "Main"),
    ),
  ];
  const rows: HistoryMilestone[] = [];
  const first = Math.min(...snapshots.keys());
  const add = (
    id: string,
    kind: HistoryMilestone["kind"],
    name: string,
    revision: number,
    branch: string,
    message = "",
    created?: number,
    branchID?: string,
  ) => {
    const save = snapshots.get(revision);
    rows.push({
      id,
      kind,
      name,
      revision,
      branch,
      branchID,
      message,
      author: save?.author ?? "",
      saved: created ?? save?.saved ?? 0,
      lane: lanes.indexOf(branchID ?? branch),
      parents: [],
      primaryParents: [],
    });
  };
  for (const branch of history.branches)
    add(
      `workspace:${historyBranchKey(branch)}`,
      "workspace",
      branch.name,
      branch.head_revision,
      branch.name,
      branch.message,
      undefined,
      branch.id,
    );
  for (const version of history.versions) {
    add(
      `version:${version.name}`,
      "version",
      version.name,
      version.revision,
      version.branch ?? snapshots.get(version.revision)?.branch ?? "Main",
      version.message,
      version.created,
      version.branch_id ?? snapshots.get(version.revision)?.branch_id,
    );
    Object.assign(rows[rows.length - 1], {status: version.status ?? "version", origin: version.origin ?? "user", statusUpdated: version.status_updated ?? 0, statusNote: version.status_note ?? ""});
  }
  for (const save of history.revisions) {
    if (
      save.parent_revision == null &&
      (save.event === "create" || save.revision === first)
    )
      add(
        `start:${save.revision}`,
        "start",
        "Start",
        save.revision,
        save.branch,
        "",
        undefined,
        save.branch_id,
      );
  }
  const order = { workspace: 0, version: 1, start: 2 };
  rows.sort(
    (a, b) =>
      b.revision - a.revision ||
      order[a.kind] - order[b.kind] ||
      b.saved - a.saved ||
      a.id.localeCompare(b.id),
  );
  const milestones = new Map<number, HistoryMilestone[]>();
  for (const row of rows)
    if (row.kind !== "workspace")
      milestones.set(row.revision, [
        ...(milestones.get(row.revision) ?? []),
        row,
      ]);
  const nearest = (revision: number | null | undefined, merges = true): string[] => {
    const queue = revision == null ? [] : [revision],
      seen = new Set<number>(),
      found = new Set<string>();
    while (queue.length) {
      const id = queue.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const milestone = milestones.get(id)?.[0];
      if (milestone) {
        found.add(milestone.id);
        continue;
      }
      const save = snapshots.get(id);
      for (const parent of [save?.parent_revision, ...(merges ? [save?.merge_parent_revision] : [])])
        if (parent != null) queue.push(parent);
    }
    return [...found];
  };
  for (const row of rows) {
    if (row.kind === "start") continue;
    const same = milestones.get(row.revision) ?? [];
    const next =
      row.kind === "workspace"
        ? same[0]
        : same[same.findIndex((item) => item.id === row.id) + 1];
    if (next) row.parents = row.primaryParents = [next.id];
    else {
      const save = snapshots.get(row.revision);
      row.primaryParents = nearest(save?.parent_revision, false);
      row.parents = [
        ...new Set([
          ...nearest(save?.parent_revision),
          ...nearest(save?.merge_parent_revision),
        ]),
      ];
    }
  }
  return rows;
}

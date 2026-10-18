import type { VersionControlEntry } from "./VersionControl";

/** Retain the branch's first-parent ancestry across its fork. Merged source
 * work remains on its own branch, just as it does in the full graph. */
export function versionBranchIDs(entries: readonly VersionControlEntry[], branch: string): Set<string> {
  const byID = new Map(entries.map(entry => [entry.id, entry]));
  const found = new Set<string>();
  const queue = entries.filter(entry => entry.branch === branch).map(entry => entry.id);
  while (queue.length) {
    const id = queue.pop()!;
    if (found.has(id)) continue;
    const entry = byID.get(id);
    if (!entry) continue;
    found.add(id);
    queue.push(...entry.primaryParents);
  }
  return found;
}

import { historyBranchKey, type DocumentHistory } from "../src/DocumentServices";
import { documentHistoryGraph } from "../src/document-history-graph";
import type { RevisionTreeDraft } from "../src/DocumentRevisionTree";

/** Disposable showcase state. This is not a PDM service or persistence adapter. */
export interface PDMExample {
  history: DocumentHistory;
  content: Record<number, string>;
  drafts: Record<string, string>;
  branch: string;
  selection: string;
}
const initialNote = "Initial assembly — approved mounting points.";
export function createPDMExample(): PDMExample {
  return {
    history: {
      branch_identity: "stable", writable: true,
      branches: [{ id: "main", name: "main", head_revision: 1 }, { id: "lightweight", name: "lightweight", head_revision: 1 }, { id: "hotfix", name: "hotfix", head_revision: 2 }],
      versions: [{ name: "v1", revision: 1, message: "Initial", branch: "main", branch_id: "main", status: "version", origin: "user" }],
      revisions: [
        { revision: 1, name: "Assembly", saved: 1, author: "Alex", event: "create", note: "Initial", branch: "main", branch_id: "main", parent_revision: null, merge_parent_revision: null },
        { revision: 2, name: "Assembly", saved: 2, author: "Alex", event: "save", note: "Bracket clearance", branch: "hotfix", branch_id: "hotfix", parent_revision: 1, merge_parent_revision: null },
      ],
    },
    content: { 1: initialNote, 2: "Increase bracket clearance by 2 mm." },
    drafts: { main: initialNote, lightweight: initialNote, hotfix: "Increase bracket clearance by 2 mm." },
    branch: "hotfix", selection: "workspace:hotfix",
  };
}
export function exampleSelection(state: PDMExample) { return documentHistoryGraph(state.history).find(row => row.id === state.selection); }
export function exampleDrafts(state: PDMExample): Record<string, RevisionTreeDraft> {
  const snapshots = new Map(state.history.revisions.map(item => [item.revision, item]));
  return Object.fromEntries(state.history.branches.map(branch => {
    let revision: number | null = branch.head_revision;
    const seen = new Set<number>();
    let version: DocumentHistory["versions"][number] | undefined;
    while (revision !== null && !seen.has(revision)) {
      seen.add(revision);
      const matches = state.history.versions.filter(item => item.revision === revision).reverse();
      version = matches.find(item => item.branch_id === historyBranchKey(branch)) ?? matches[0];
      if (version) break;
      revision = snapshots.get(revision)?.parent_revision ?? null;
    }
    const key = historyBranchKey(branch);
    return [key, { dirty: state.drafts[key] !== state.content[branch.head_revision], changed: !version || version.revision !== branch.head_revision, sinceVersion: version?.name }];
  }));
}
export function saveExample(state: PDMExample): PDMExample {
  if (!exampleDrafts(state)[state.branch].dirty) return state;
  const branch = state.history.branches.find(item => historyBranchKey(item) === state.branch)!;
  const revision = Math.max(...state.history.revisions.map(item => item.revision)) + 1;
  return { ...state, content: { ...state.content, [revision]: state.drafts[state.branch] }, history: {
    ...state.history,
    branches: state.history.branches.map(item => item === branch ? { ...item, head_revision: revision } : item),
    revisions: [...state.history.revisions, { revision, name: "Assembly", saved: Date.now() / 1000, author: "You", event: "save", note: "Draft saved", branch: branch.name, branch_id: state.branch, parent_revision: branch.head_revision, merge_parent_revision: null }],
  } };
}
export function nameProblem(state: PDMExample, kind: "version" | "branch", name: string): string {
  if (!name.trim()) return "Enter a name.";
  if (name.trim().length > 48) return "Use 48 characters or fewer.";
  const items = kind === "version" ? state.history.versions : state.history.branches;
  return items.some(item => item.name.toLowerCase() === name.trim().toLowerCase()) ? "That name already exists." : "";
}
export function createExampleVersion(state: PDMExample, name: string, message: string): PDMExample {
  if (nameProblem(state, "version", name)) return state;
  const saved = saveExample(state), branch = saved.history.branches.find(item => historyBranchKey(item) === saved.branch)!;
  return { ...saved, selection: `version:${name.trim()}`, history: { ...saved.history, versions: [...saved.history.versions, {
    name: name.trim(), revision: branch.head_revision, branch: branch.name, branch_id: saved.branch, message: message.trim(), created: Date.now() / 1000, status: "version", origin: "user",
  }] } };
}
export function branchExample(state: PDMExample, name: string): PDMExample {
  const selected = exampleSelection(state);
  if (!selected || nameProblem(state, "branch", name)) return state;
  const key = `demo-branch-${state.history.branches.length + 1}`;
  return { ...state, branch: key, selection: `workspace:${key}`, drafts: { ...state.drafts, [key]: state.content[selected.revision] }, history: {
    ...state.history, branches: [...state.history.branches, { id: key, name: name.trim(), head_revision: selected.revision }],
  } };
}
export function takeOverExample(state: PDMExample): PDMExample {
  const selected = exampleSelection(state);
  return selected ? { ...state, drafts: { ...state.drafts, [state.branch]: state.content[selected.revision] } } : state;
}
export function releaseExample(state: PDMExample): PDMExample {
  const selected = exampleSelection(state);
  if (selected?.kind !== "version" || selected.status === "released" || selected.status === "obsolete") return state;
  return { ...state, history: { ...state.history, versions: state.history.versions.map(item => item.name === selected.name ? { ...item, status: "released", status_updated: Date.now() / 1000 } : item) } };
}

import { expect, test } from "vitest";
import { documentHistoryGraph } from "./document-history-graph";
import type { DocumentHistory } from "./DocumentServices";

export function savedHistory(count = 300): DocumentHistory {
  return {
    branches: [{ name: "Main", head_revision: count }],
    versions: [],
    revisions: Array.from({ length: count }, (_, i) => ({
      revision: i + 1,
      name: "Show",
      author: "Designer",
      saved: 1000 + i,
      event: i ? "save" : "create",
      note: "",
      branch: "Main",
      parent_revision: i || null,
      merge_parent_revision: null,
    })).reverse(),
  };
}
test("hundreds of automatic saves remain one workspace and Start, not hundreds of versions", () => {
  const history = savedHistory();
  expect(
    documentHistoryGraph(history).map((row) => [row.kind, row.name]),
  ).toEqual([
    ["workspace", "Main"],
    ["start", "Start"],
  ]);
  expect(history.versions).toEqual([]);
  const rows = documentHistoryGraph(history);
  expect(rows[0].parents).toEqual([rows[1].id]);
});
test("explicit versions and workspaces at the same saved state are all retained", () => {
  const history = savedHistory(3);
  history.versions = [
    { name: "Review", revision: 3, message: "" },
    { name: "Approved", revision: 3, message: "" },
  ];
  history.branches.push({ name: "Experiment", head_revision: 3 });
  const rows = documentHistoryGraph(history);
  expect(rows.filter((row) => row.kind === "workspace")).toHaveLength(2);
  expect(rows.filter((row) => row.kind === "version")).toHaveLength(2);
  expect(rows).toHaveLength(5);
  for (const row of rows) expect(row.parents).not.toContain(row.id);
});
test("interleaved branch saves connect through their real ancestors, including merges", () => {
  const history = savedHistory(6);
  history.versions = [
    { name: "Base", revision: 2, message: "" },
    { name: "Alternative", revision: 4, message: "" },
  ];
  history.branches.push({ name: "Experiment", head_revision: 4 });
  const alt = history.revisions.find((save) => save.revision === 4)!;
  alt.branch = "Experiment";
  alt.parent_revision = 2;
  history.revisions.find((save) => save.revision === 5)!.parent_revision = 3;
  history.revisions.find((save) => save.revision === 6)!.merge_parent_revision =
    4;
  const rows = documentHistoryGraph(history);
  expect(
    rows.find((row) => row.id === "workspace:Main")!.parents.sort(),
  ).toEqual(["version:Alternative", "version:Base"]);
  expect(
    rows.find((row) => row.id === "workspace:Experiment")!.parents,
  ).toEqual(["version:Alternative"]);
  expect(rows.find((row) => row.id === "version:Alternative")!.parents).toEqual(
    ["version:Base"],
  );
});

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DocumentRevisionTree } from "./DocumentRevisionTree";
import { PDMRevisionTreeDemo } from "../gallery/PDMRevisionTreeDemo";
import { branchExample, createExampleVersion, createPDMExample, exampleDrafts, nameProblem, releaseExample, saveExample, takeOverExample } from "../gallery/pdm-revision-example";
import { SHOWCASE_COLLECTIONS } from "../gallery/showcase/collections";
import { SHOWCASE_TABS } from "../gallery/showcase";

afterEach(cleanup);

test("saving advances only its branch and never mutates a captured version", () => {
  const initial = createPDMExample();
  const saved = saveExample({ ...initial, drafts: { ...initial.drafts, hotfix: "New bracket" } });
  expect(initial.history.branches[2].head_revision).toBe(2);
  expect(initial.content[2]).toBe("Increase bracket clearance by 2 mm.");
  expect(saved.history.branches.map(item => item.head_revision)).toEqual([1, 1, 3]);
  expect(saved.history.versions).toEqual(initial.history.versions);
  expect(saved.history.revisions.at(-1)?.parent_revision).toBe(2);
  expect(saved.content[3]).toBe("New bracket");
  expect(exampleDrafts(saved).hotfix).toEqual({ dirty: false, changed: true, sinceVersion: "v1" });
  expect(saveExample(saved)).toBe(saved);
});

test("version creation captures unsaved content with a name separate from the snapshot token", () => {
  const initial = createPDMExample();
  const state = createExampleVersion({ ...initial, drafts: { ...initial.drafts, hotfix: "Release content" } }, " v2 ", " Clearance ");
  expect(state.history.versions.at(-1)).toMatchObject({ name: "v2", revision: 3, message: "Clearance", branch_id: "hotfix" });
  expect(state.content[3]).toBe("Release content");
  expect(exampleDrafts(state).hotfix).toEqual({ dirty: false, changed: false, sinceVersion: "v2" });
  expect(exampleDrafts(createExampleVersion(state, "review", "Same snapshot")).hotfix.sinceVersion).toBe("review");
  expect(nameProblem(state, "version", "V2")).toBe("That name already exists.");
  expect(createExampleVersion(state, "V2", "")).toBe(state);
});

test("branching uses the selected snapshot with stable identity and preserves other drafts", () => {
  const initial = createPDMExample();
  const state = branchExample({ ...initial, selection: "version:v1", drafts: { ...initial.drafts, hotfix: "Pending" } }, "experimental");
  expect(state.branch).not.toBe("experimental");
  expect(state.history.branches.at(-1)).toEqual({ id: state.branch, name: "experimental", head_revision: 1 });
  expect(state.drafts[state.branch]).toBe(initial.content[1]);
  expect(state.drafts.hotfix).toBe("Pending");
  expect(nameProblem(state, "branch", "MAIN")).toBe("That name already exists.");
  expect(branchExample(state, " ")).toBe(state);
});

test("take over changes only the current draft and releases apply only to explicit versions", () => {
  const initial = createPDMExample();
  expect(releaseExample(initial)).toBe(initial);
  const selected = { ...initial, selection: "version:v1" };
  const restored = takeOverExample(selected);
  expect(restored.drafts.hotfix).toBe(initial.content[1]);
  expect(restored.history).toBe(initial.history);
  expect(exampleDrafts(restored).hotfix.dirty).toBe(true);
  const released = releaseExample(selected);
  expect(released.history.versions[0].status).toBe("released");
  expect(initial.history.versions[0].status).toBe("version");
  expect(released.content).toBe(initial.content);
  expect(releaseExample(released)).toBe(released);
});

test("tree follows real parents through autosaves and renders only explicit milestones", () => {
  const state = createPDMExample(), branch = vi.fn(), select = vi.fn();
  const versioned = createExampleVersion({ ...state, drafts: { ...state.drafts, hotfix: "Revision 3" } }, "v2", "Second");
  const { container } = render(<DocumentRevisionTree history={versioned.history} branch="hotfix" selection="version:v2" drafts={exampleDrafts(versioned)} onBranchChange={branch} onSelect={select} />);
  expect(screen.getByRole("button", { name: "v2 Second" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.queryByRole("button", { name: /Start/ })).toBeNull();
  expect(container.querySelector('[data-from="version:v2"][data-to="version:v1"]')).toBeTruthy();
  expect(container.querySelector('[data-from="workspace:lightweight"][data-to="version:v1"]')).toBeTruthy();
  expect(container.querySelector('[data-from="workspace:lightweight"][data-to="version:v2"]')).toBeNull();
  fireEvent.click(within(screen.getByRole("group", { name: "Branches" })).getByRole("button", { name: "main" }));
  expect(branch).toHaveBeenCalledWith("main");
  fireEvent.click(screen.getByRole("button", { name: "v1 Initial" }));
  expect(select).toHaveBeenCalledWith(expect.objectContaining({ id: "version:v1", revision: 1 }));
});

test("missing handlers, read-only history and busy operations cannot invoke mutations", () => {
  const state = createPDMExample(), save = vi.fn();
  const props = { history: state.history, branch: state.branch, selection: state.selection, onBranchChange: vi.fn(), onSelect: vi.fn(), actions: { save: { onInvoke: save } } };
  const { rerender } = render(<DocumentRevisionTree {...props} />);
  expect((screen.getByRole("button", { name: "Release" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(save).toHaveBeenCalledTimes(1);
  rerender(<DocumentRevisionTree {...props} busy />);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  rerender(<DocumentRevisionTree {...props} history={{ ...state.history, writable: false }} />);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(save).toHaveBeenCalledTimes(1);
});

test("PDM category and collection share their specimens with Studio & Drive", () => {
  const pdm = SHOWCASE_COLLECTIONS.find(item => item.id === "pdm")!;
  expect(pdm.sections).toEqual(["Revision trees + branches", "Document history + collaboration"]);
  expect(SHOWCASE_TABS.find(item => item.id === "widgets")?.groups.find(item => item.id === "pdm")?.sections).toEqual(pdm.sections);
  for (const title of pdm.sections) expect(SHOWCASE_COLLECTIONS.find(item => item.id === "app-studio")?.sections).toContain(title);
});

test("showcase supports edit, switch, capture and release through real controls", () => {
  render(<PDMRevisionTreeDemo />);
  const note = screen.getByRole("textbox", { name: "Draft note" }) as HTMLTextAreaElement;
  fireEvent.change(note, { target: { value: "New clearance" } });
  fireEvent.click(within(screen.getByRole("group", { name: "Branches" })).getByRole("button", { name: "main" }));
  expect(note.value).toBe("Initial assembly — approved mounting points.");
  fireEvent.click(within(screen.getByRole("group", { name: "Branches" })).getByRole("button", { name: "hotfix" }));
  expect(note.value).toBe("New clearance");
  fireEvent.click(screen.getByRole("button", { name: "Create version" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Version name" }), { target: { value: "v2" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Version description" }), { target: { value: "Clearance" } });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  expect(screen.getByRole("button", { name: "v2 Clearance" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Release" }));
  expect(screen.getByRole("button", { name: "v2 Clearance released" })).toBeTruthy();
  fireEvent.change(note, { target: { value: "Later change" } });
  expect(screen.getByText("New clearance", { selector: "p" })).toBeTruthy();
});

test("take-over confirmation cancels safely and reset restores the fixture", () => {
  render(<PDMRevisionTreeDemo />);
  const note = screen.getByRole("textbox", { name: "Draft note" }) as HTMLTextAreaElement;
  fireEvent.change(note, { target: { value: "Pending draft" } });
  fireEvent.click(screen.getByRole("button", { name: "v1 Initial" }));
  fireEvent.click(screen.getByRole("button", { name: "Take over" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(note.value).toBe("Pending draft");
  fireEvent.click(screen.getByRole("button", { name: "Take over" }));
  fireEvent.click(screen.getByRole("button", { name: "Replace draft" }));
  expect(note.value).toBe("Initial assembly — approved mounting points.");
  fireEvent.click(screen.getByRole("button", { name: "Reset example" }));
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  expect(note.value).toBe("Increase bracket clearance by 2 mm.");
});

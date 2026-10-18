import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DemoReviewPanel } from "../gallery/demo-review/DemoReviewPanel";
import { localReview } from "../gallery/demo-review/local-review";
import type { DocumentCollaboration } from "./DocumentServices";

afterEach(cleanup);
async function open() {
  render(<DemoReviewPanel documentName="Scifirobot" selectedName="Cooling tubes" onClose={vi.fn()}/>);
  await act(async () => {});
}
const tab = (name: string) => fireEvent.click(screen.getByRole("radio", { name }));
async function addComment(text: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Comments text" }), { target: { value: text } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Add" })); });
}

test("review tabs retain comment drafts and use the approved content widgets", async () => {
  await open();
  fireEvent.change(screen.getByRole("textbox", { name: "Comments text" }), { target: { value: "Check clearance" } });
  tab("Tasks");
  expect(screen.getByRole("region", { name: "Action items" })).toBeTruthy();
  expect(screen.queryByRole("textbox", { name: "Comments text" })).toBeNull();
  fireEvent.keyDown(screen.getByRole("radio", { name: "Tasks" }), { key: "ArrowLeft" });
  expect(screen.getByRole("textbox", { name: "Comments text" })).toHaveProperty("value", "Check clearance");
  expect(screen.getByRole("radio", { name: "Comments" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByText("Local review · Kept in this window only")).toBeTruthy();
});

test("local comments keep selected-object context, replies and resolved filters", async () => {
  await open(); await addComment("Check the cooling clearance");
  expect(screen.getByText("Cooling tubes")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Reply" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Comments text" }), { target: { value: "Allow another 2 cm" } });
  await act(async () => { fireEvent.click(within(screen.getByRole("form", { name: "Comment composer" })).getByRole("button", { name: "Reply" })); });
  expect(screen.getByText("Allow another 2 cm")).toBeTruthy();
  await act(async () => { fireEvent.click(screen.getByRole("checkbox", { name: "Resolve discussion" })); });
  fireEvent.change(screen.getByRole("combobox", { name: "Comments filter" }), { target: { value: "open" } });
  expect(screen.queryByText("Check the cooling clearance")).toBeNull();
  fireEvent.change(screen.getByRole("combobox", { name: "Comments filter" }), { target: { value: "resolved" } });
  expect(screen.getByText("Check the cooling clearance")).toBeTruthy();
});

test("tasks create, filter and change status without losing comments", async () => {
  await open(); await addComment("Review before release"); tab("Tasks");
  fireEvent.click(screen.getByRole("button", { name: "Create action item" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Action items text" }), { target: { value: "Verify vent spacing" } });
  fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-10-24" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Add task" })); });
  expect(screen.getByText("Verify vent spacing")).toBeTruthy();
  await act(async () => { fireEvent.change(screen.getByRole("combobox", { name: "Status for Verify vent spacing" }), { target: { value: "done" } }); });
  fireEvent.change(screen.getByRole("combobox", { name: "Action item status" }), { target: { value: "open" } });
  expect(screen.queryByText("Verify vent spacing")).toBeNull();
  fireEvent.change(screen.getByRole("combobox", { name: "Action item status" }), { target: { value: "done" } });
  expect(screen.getByText("Verify vent spacing")).toBeTruthy();
  tab("Comments"); expect(screen.getByText("Review before release")).toBeTruthy();
  tab("Tasks"); expect(screen.getByRole("combobox", { name: "Status for Verify vent spacing" })).toHaveProperty("value", "done");
});

test("local review sessions stay separate and reject stale changes", async () => {
  const a = localReview(() => ({ name: "A" })), b = localReview(() => ({ name: "B" }));
  const initial = await a.call<DocumentCollaboration>("collaboration");
  const request = { collection: "tasks", operation: "add", expected_revision: initial.revision, value: { text: "A task" } };
  const next = await a.call<DocumentCollaboration>("collaboration_mutate", request);
  expect(next.tasks[0].assignee).toBe("local");
  await expect(a.call("collaboration_mutate", request)).rejects.toThrow("changed");
  expect((await b.call<DocumentCollaboration>("collaboration")).tasks).toEqual([]);
  next.tasks[0].text = "external mutation";
  expect((await a.call<DocumentCollaboration>("collaboration")).tasks[0].text).toBe("A task");
});

import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DocumentTabBar } from "./DocumentTabBar";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
test("element tabs mark the current one, open others and offer the add menu", async () => {
  const opened: string[] = []; const added: string[] = [];
  render(<DocumentTabBar tabs={[
    { id: "a1", label: "Assembly 1", detail: "Assembly", onSelect: () => opened.push("a1") },
    { id: "p1", label: "Part 1", detail: "Part Studio", current: true, onSelect: () => opened.push("p1") },
  ]} addItems={[{ id: "part", label: "Part Studio" }, { id: "assembly", label: "Assembly" }]} onAdd={(id) => added.push(id)} />);
  expect(screen.getByRole("tab", { name: "Part 1" }).getAttribute("aria-selected")).toBe("true");
  fireEvent.click(screen.getByRole("tab", { name: "Part 1" }));
  fireEvent.click(screen.getByRole("tab", { name: "Assembly 1" }));
  expect(opened).toEqual(["a1"]);
  fireEvent.click(screen.getByRole("button", { name: "Insert new tab" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Assembly" }));
  expect(added).toEqual(["assembly"]);
});

test("add can be disabled with a reason", () => {
  render(<DocumentTabBar tabs={[{ id: "p", label: "Part 1", current: true }]} addItems={[{ id: "part", label: "Part Studio" }]} addDisabledReason="Save first" />);
  expect((screen.getByRole("button", { name: "Save first" }) as HTMLButtonElement).disabled).toBe(true);
});

test("open-file tabs can be closed", () => {
  const closed: string[] = [];
  render(<DocumentTabBar tabs={[{ id: "a", label: "Bracket", onClose: () => closed.push("a") }, { id: "b", label: "Wheel", current: true, onClose: () => closed.push("b") }]} />);
  fireEvent.click(screen.getByRole("button", { name: "Close Wheel" }));
  expect(closed).toEqual(["b"]);
});

test("a plain add button can open an app's own dialog", () => {
  let opened = 0;
  render(<DocumentTabBar tabs={[]} addLabel="Create or open" onAddClick={() => opened++} />);
  fireEvent.click(screen.getByRole("button", { name: "Create or open" }));
  expect(opened).toBe(1);
});

test("header placement marks the bar for the top row", () => {
  const { container } = render(<DocumentTabBar placement="header" tabs={[{ id: "a", label: "Part 1", current: true }]} onAddClick={() => {}} />);
  const bar = container.querySelector('.aui-document-tabbar[data-placement="header"]')!;
  expect(bar).not.toBeNull();
  expect(bar.lastElementChild?.getAttribute("aria-label")).toBe("Insert new tab");
});


test("studio tabs expose document kinds and cycle enabled documents with the next control", () => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 1000, height: 50, top: 0, left: 0, right: 1000, bottom: 50, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
  let overview = 0;
  function Example() {
    const [active, setActive] = useState("wheel");
    return <DocumentTabBar variant="studio" onOverview={() => overview++} tabs={[
      { id: "wheel", label: "Wheel", detail: "Part Studio" },
      { id: "unavailable", label: "Unavailable", disabled: true },
      { id: "assembly", label: "Assembly 1", detail: "Assembly" },
    ].map(tab => ({ ...tab, current: tab.id === active, onSelect: () => setActive(tab.id) }))} />;
  }
  render(<Example />);
  expect(screen.getByRole("tab", { name: "Wheel Part Studio" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.queryAllByRole("status")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Next document" }));
  expect(screen.getByRole("tab", { name: "Assembly 1 Assembly" }).getAttribute("aria-selected")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Next document" }));
  expect(screen.getByRole("tab", { name: "Wheel Part Studio" }).getAttribute("aria-selected")).toBe("true");
  fireEvent.keyDown(screen.getByRole("tab", { name: "Wheel Part Studio" }), { key: "End" });
  expect(screen.getByRole("tab", { name: "Assembly 1 Assembly" }).getAttribute("aria-selected")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Document overview" }));
  expect(overview).toBe(1);
});

test("narrow studio rows keep the active document visible and expose the rest in overflow", () => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 380, height: 50, top: 0, left: 0, right: 380, bottom: 50, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
  function Example() {
    const [active, setActive] = useState("c");
    return <DocumentTabBar variant="studio" onAddClick={() => {}} onOverview={() => {}} tabs={[
      { id: "a", label: "Wheel", detail: "Part Studio" },
      { id: "b", label: "Assembly 1", detail: "Assembly" },
      { id: "c", label: "Reference", detail: "Drawing" },
    ].map(tab => ({ ...tab, current: tab.id === active, onSelect: () => setActive(tab.id) }))} />;
  }
  render(<Example />);
  expect(screen.getAllByRole("tab")).toHaveLength(1);
  expect(screen.getByRole("tab", { name: "Reference Drawing" }).getAttribute("aria-selected")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "More documents" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Wheel" }));
  expect(screen.getByRole("tab", { name: "Wheel Part Studio" }).getAttribute("aria-selected")).toBe("true");
});

test("empty and single-document studio rows disable next but retain creation", () => {
  const add = vi.fn();
  const { rerender } = render(<DocumentTabBar variant="studio" tabs={[]} onAddClick={add} />);
  expect((screen.getByRole("button", { name: "Next document" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Insert new tab" }));
  expect(add).toHaveBeenCalledOnce();
  rerender(<DocumentTabBar variant="studio" tabs={[{ id: "one", label: "One", current: true }]} />);
  expect((screen.getByRole("button", { name: "Next document" }) as HTMLButtonElement).disabled).toBe(true);
});

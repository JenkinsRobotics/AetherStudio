import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DocumentList, filterDocumentListItems, type DocumentListItem } from "./DocumentList";
import { CADDocumentListDemo } from "../gallery/CADDocumentListDemo";
import { CAD_LIST_EXAMPLE, cadListItems, cadMetadataProblem } from "../gallery/cad-document-list-example";
import { SHOWCASE_COLLECTIONS } from "../gallery/showcase/collections";

const sample: DocumentListItem[] = [
  { id: "rod", name: "Connecting rod", reference: "ENG-1002", version: "v8", revision: "E" },
  { id: "pin", name: "Locating pin", reference: "BRK-2004", version: "v4", status: { kind: "draft", label: "draft" } },
  { id: "build", name: "Rod assembly", reference: "ENG-2002", status: { kind: "branch", label: "assembly-build" } },
];
afterEach(cleanup);

function Harness({ items = sample, onOpen = vi.fn() }: { items?: DocumentListItem[]; onOpen?: (id: string) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set()), [query, setQuery] = useState("");
  return <DocumentList items={items} selectedIDs={selected} query={query} onQueryChange={setQuery} onOpen={onOpen} onSelect={(ids, mode) => setSelected(old => {
    if (mode !== "toggle") return new Set(ids);
    const next = new Set(old); for (const id of ids) { if (next.has(id)) next.delete(id); else next.add(id); } return next;
  })} />;
}

test("search matches all terms across names, part numbers, versions and branch labels", () => {
  expect(filterDocumentListItems(sample, " ENG-1002 V8 ").map(item => item.id)).toEqual(["rod"]);
  expect(filterDocumentListItems(sample, "draft pin").map(item => item.id)).toEqual(["pin"]);
  expect(filterDocumentListItems(sample, "assembly-build").map(item => item.id)).toEqual(["build"]);
  expect(filterDocumentListItems(sample, "no match")).toEqual([]);
  expect(filterDocumentListItems(sample, "")).toEqual(sample);
});

test("selection, range, toggling and keyboard activation reuse shared list behavior", () => {
  const open = vi.fn(); render(<Harness onOpen={open} />);
  const rows = screen.getAllByRole("option");
  fireEvent.click(rows[0]); fireEvent.click(rows[2], { shiftKey: true });
  expect(screen.getAllByRole("option", { selected: true })).toHaveLength(3);
  fireEvent.click(rows[1], { ctrlKey: true });
  expect(screen.getAllByRole("option", { selected: true })).toHaveLength(2);
  fireEvent.keyDown(rows[0], { key: "Enter" });
  expect(open).toHaveBeenCalledWith("rod");
  fireEvent.keyDown(rows[0], { key: "ArrowDown" });
  expect(document.activeElement).toBe(rows[1]);
  fireEvent.keyDown(rows[1], { key: " " });
  expect(rows[1].getAttribute("aria-selected")).toBe("true");
  expect(screen.getAllByRole("option", { selected: true })).toHaveLength(1);
});

test("search shortcut preserves text entry and ArrowDown returns to the list", () => {
  render(<Harness />);
  const rows = screen.getAllByRole("option"), search = screen.getByRole("searchbox");
  fireEvent.keyDown(rows[0], { key: "/" }); expect(document.activeElement).toBe(search);
  expect(fireEvent.keyDown(search, { key: "/" })).toBe(true);
  fireEvent.change(search, { target: { value: "BRK" } });
  expect(screen.getAllByRole("option")).toHaveLength(1);
  fireEvent.keyDown(search, { key: "ArrowDown" }); expect(document.activeElement).toBe(screen.getByRole("option"));
  fireEvent.change(search, { target: { value: "not found" } });
  expect(screen.getByText("No matching documents.")).toBeTruthy();
  fireEvent.keyDown(search, { key: "Escape" }); expect(screen.getAllByRole("option")).toHaveLength(3);
});

test("disabled entries cannot select or open; badges have explicit accessible meanings", () => {
  const open = vi.fn(); render(<Harness onOpen={open} items={[{ ...sample[0], disabled: true }, sample[1]]} />);
  const rows = screen.getAllByRole("option");
  fireEvent.click(rows[0]); fireEvent.doubleClick(rows[0]);
  expect(rows[0].getAttribute("aria-selected")).toBe("false"); expect(open).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Version v8").textContent).toBe("v8");
  expect(screen.getByLabelText("Revision E").textContent).toBe("E");
  expect(rows[1].tabIndex).toBe(0);
});

test("loading and errors replace stale rows and announce accurate state", () => {
  const props = { items: sample, selectedIDs: new Set<string>(), onSelect: vi.fn(), query: "", onQueryChange: vi.fn() };
  const { rerender } = render(<DocumentList {...props} loading />);
  expect(screen.queryAllByRole("option")).toHaveLength(0);
  expect(screen.getByRole("listbox").getAttribute("aria-busy")).toBe("true");
  rerender(<DocumentList {...props} error="Could not load documents." />);
  expect(screen.getByRole("alert").textContent).toBe("Could not load documents.");
  expect(screen.getByText("Documents unavailable")).toBeTruthy();
});

test("large document lists window rows while retaining search access", () => {
  const items = Array.from({ length: 500 }, (_,i) => ({ id: `${i}`, name: `Part ${i}`, reference: `CAD-${i}` }));
  render(<Harness items={items} />);
  expect(screen.getAllByRole("option").length).toBeLessThan(25);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "CAD-499" } });
  expect(screen.getByRole("option").textContent).toContain("Part 499");
});

test("CAD filtering and numeric sorting preserve fixture data and collection membership", () => {
  expect(cadListItems(CAD_LIST_EXAMPLE, "assemblies", "original", true)).toHaveLength(2);
  expect(cadListItems(CAD_LIST_EXAMPLE, "drafts", "original", true)).toHaveLength(2);
  const sorted = cadListItems([{ ...CAD_LIST_EXAMPLE[0], version: "v10" }, { ...CAD_LIST_EXAMPLE[1], version: "v2" }], "all", "version", true);
  expect(sorted.map(item => item.version)).toEqual(["v2", "v10"]);
  expect(CAD_LIST_EXAMPLE[0].version).toBe("v8");
  expect(cadMetadataProblem(CAD_LIST_EXAMPLE, { ...CAD_LIST_EXAMPLE[0], reference: " eng-1001 " })).toBe("That part number is already in use.");
  expect(SHOWCASE_COLLECTIONS.find(item => item.id === "app-cad")?.sections).toContain("CAD document list");
});

test("details editing changes only local metadata and remains searchable", () => {
  render(<CADDocumentListDemo />);
  fireEvent.doubleClick(screen.getByRole("option", { name: /Crankshaft ENG-1001/ }));
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.change(dialog.getByRole("textbox", { name: "Document name" }), { target: { value: "Precision crankshaft" } });
  fireEvent.change(dialog.getByRole("textbox", { name: "Part number" }), { target: { value: "ENG-1002" } });
  expect((dialog.getByRole("button", { name: "Save details" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(dialog.getByRole("textbox", { name: "Part number" }), { target: { value: "ENG-1010" } });
  fireEvent.change(dialog.getByRole("textbox", { name: "Document notes" }), { target: { value: "Measure journals before release." } });
  fireEvent.change(dialog.getByRole("combobox", { name: "Material" }), { target: { value: "Brass" } });
  fireEvent.click(dialog.getByRole("button", { name: "Save details" }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Search cad documents" }), { target: { value: "ENG-1010" } });
  expect(within(screen.getByRole("listbox")).getByRole("option").textContent).toContain("Precision crankshaft");
  expect(within(screen.getByRole("listbox")).getByRole("option").textContent).toContain("v8");
  expect(screen.getByText("Measure journals before release.")).toBeTruthy();
  expect(screen.getByText("Brass")).toBeTruthy();
  expect(CAD_LIST_EXAMPLE.find(item => item.id === "crankshaft")?.name).toBe("Crankshaft");
});

test("cancel preserves metadata, filters change visible rows and reset restores the example", () => {
  render(<CADDocumentListDemo />);
  fireEvent.doubleClick(screen.getByRole("option", { name: /Crankshaft ENG-1001/ }));
  fireEvent.change(screen.getByRole("textbox", { name: "Document name" }), { target: { value: "Cancelled name" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByText("Cancelled name")).toBeNull();
  fireEvent.change(screen.getByRole("combobox", { name: "Document filter" }), { target: { value: "drafts" } });
  expect(screen.getAllByRole("option").filter(el => el.getAttribute("aria-selected") !== null)).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Reset example" }));
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(14);
});


test("filtering preserves selection, announces hidden items and offers an explicit clear", () => {
  render(<Harness />);
  fireEvent.click(screen.getAllByRole("option")[0]);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "BRK" } });
  expect(screen.getByRole("status").textContent).toContain("1 selected · 1 hidden");
  fireEvent.click(screen.getByRole("button", { name: "Clear document selection" }));
  expect(screen.getByRole("status").textContent).not.toContain("selected");
});

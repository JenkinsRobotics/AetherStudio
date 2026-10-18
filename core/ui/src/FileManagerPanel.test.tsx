import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { FileManagerPanel, type FileManagerItem } from "./FileManagerPanel";

/**
 * The panel carries two registers at once (Jonathan, 2026-10-03): what the
 * open document is made of, and the folder it lives in. These pin the three
 * things that makes it one panel rather than two — one search across both, a
 * folder opening in place rather than as a document, and the library alone
 * when no document is open.
 */
const DOCUMENT_GROUPS = [
  { id: "parts", label: "Part studios", items: [
    { id: "p1", name: "Wheel hub", kind: "part", detail: "Part Studio" },
    { id: "p2", name: "Spoke", kind: "part", detail: "Part Studio" },
  ] as FileManagerItem[] },
  { id: "assemblies", label: "Assemblies", items: [
    { id: "a1", name: "Assembly 1", kind: "assembly", detail: "Assembly" },
  ] as FileManagerItem[] },
];
const LIBRARY: FileManagerItem[] = [
  { id: "f1", name: "Gen 1 robot", kind: "folder" },
  { id: "d1", name: "Power supply", kind: "file", detail: "Part Studio", badge: "V2", badgeTitle: "Latest version: Design review" },
  { id: "d2", name: "Never versioned", kind: "file", detail: "Part Studio" },
];

const panel = (extra = {}) => render(
  <FileManagerPanel
    ariaLabel="Part manager"
    documentName="Train cart wheel"
    documentGroups={DOCUMENT_GROUPS}
    path={[{ id: null, name: "My files" }, { id: "f1", name: "Gen 1 robot" }]}
    libraryItems={LIBRARY}
    onOpen={() => {}}
    onNavigate={() => {}}
    {...extra}
  />,
);

test("shows what the document is made of above where it lives", () => {
  panel();
  expect(screen.getByRole("heading", { name: "Train cart wheel" })).toBeTruthy();
  expect(screen.getByRole("button", { name: /Wheel hub/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /Assembly 1/ })).toBeTruthy();
  // Type, name, version — the Onshape reference's three. Not the date.
  const row = screen.getByRole("button", { name: /Power supply/ });
  expect(row.textContent).toContain("Part Studio");
  expect(row.textContent).toContain("V2");
});

test("a document nobody has versioned carries no chip at all", () => {
  // The chip counts named versions, so showing one for a file that has none
  // would be the autosave counter leaking back in.
  panel();
  expect(screen.getByRole("button", { name: /Never versioned/ }).querySelector(".aui-file-row-badge")).toBeNull();
  expect(screen.getByRole("button", { name: /Power supply/ }).querySelector(".aui-file-row-badge")?.getAttribute("title"))
    .toBe("Latest version: Design review");
});

test("one search filters both registers at once", () => {
  panel();
  fireEvent.change(screen.getByLabelText("Search files"), { target: { value: "spoke" } });
  expect(screen.getByRole("button", { name: /Spoke/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Power supply/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /Assembly 1/ })).toBeNull();

  fireEvent.change(screen.getByLabelText("Search files"), { target: { value: "power" } });
  expect(screen.getByRole("button", { name: /Power supply/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Wheel hub/ })).toBeNull();

  fireEvent.change(screen.getByLabelText("Search files"), { target: { value: "nothing here" } });
  expect(screen.getByText(/Nothing matches/)).toBeTruthy();
});

test("a folder navigates in place; everything else opens", () => {
  const onOpen = vi.fn(), onNavigate = vi.fn();
  const { container } = panel({ onOpen, onNavigate });
  // The folder's name is also a crumb in the path, so this is the list's row.
  const list = container.querySelector(".aui-file-manager-library ul") as HTMLElement;
  fireEvent.click(within(list).getByRole("button", { name: /Gen 1 robot/ }));
  expect(onNavigate).toHaveBeenCalledWith("f1");
  expect(onOpen).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /Power supply/ }));
  expect(onOpen.mock.calls[0][0].id).toBe("d1");
});

test("the path walks back, and the folder you are in is not a link", () => {
  const onNavigate = vi.fn();
  panel({ onNavigate });
  const path = screen.getByRole("navigation", { name: "Folder path" });
  const here = within(path).getByRole("button", { name: "Gen 1 robot" });
  expect((here as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(within(path).getByRole("button", { name: "My files" }));
  expect(onNavigate).toHaveBeenCalledWith(null);
});

test("with no document open it is the library alone", () => {
  panel({ documentName: undefined, documentGroups: [] });
  expect(screen.queryByRole("heading", { name: "Train cart wheel" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Wheel hub/ })).toBeNull();
  expect(screen.getByRole("button", { name: /Power supply/ })).toBeTruthy();
});

test("the active row is marked for assistive tech, not just painted", () => {
  panel({ activeID: "p1" });
  expect(screen.getByRole("button", { name: /Wheel hub/ }).getAttribute("aria-current")).toBe("true");
  expect(screen.getByRole("button", { name: /Spoke/ }).getAttribute("aria-current")).toBeNull();
});

test("shared controls sort, filter and keep a selected-item preview", () => {
  const { container } = panel({activeID:"p1"});
  expect(screen.getByRole("complementary", {name:"Selected item preview"}).textContent).toContain("Wheel hub");
  fireEvent.click(screen.getByRole("button", {name:"Sort files"}));
  fireEvent.click(screen.getByRole("menuitemradio", {name:"Name"}));
  const rows = container.querySelectorAll(".aui-file-manager-document .aui-file-row");
  expect(rows[0].textContent).toContain("Spoke");
  fireEvent.click(screen.getByRole("button", {name:"Filter files by type"}));
  fireEvent.click(screen.getByRole("menuitemradio", {name:"Assembly"}));
  expect(screen.queryByRole("button", {name:/Wheel hub/})).toBeNull();
  expect(screen.getByRole("button", {name:/Assembly 1/})).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name:"Compact file list"}));
  expect(container.querySelector(".aui-file-manager")?.getAttribute("data-compact")).toBe("true");
  fireEvent.click(screen.getByRole("button", {name:"Clear filters"}));
  expect(screen.getByRole("button", {name:/Wheel hub/})).toBeTruthy();
});

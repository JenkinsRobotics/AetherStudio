import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ShowcaseCollectionEditor, ShowcaseCollections } from "../gallery/showcase/ShowcaseCollections";
import { ALL_SECTIONS, SHOWCASE_COLLECTIONS, parseCollections, readShowcaseLocation, showcaseHash, type ShowcaseCollection } from "../gallery/showcase/collections";
import { aetherThemes } from "./themes";
import { sectionID } from "../gallery/showcase";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const example: ShowcaseCollection = { id: "custom-reference", label: "Website references", description: "Reusable patterns", kind: "collection", sections: ["Flow diagrams", "Buttons"], custom: true };

test("every built-in collection references unique existing specimens and every theme is browsable", () => {
  for (const item of SHOWCASE_COLLECTIONS) {
    expect(item.sections.length).toBeGreaterThan(0);
    expect(new Set(item.sections).size).toBe(item.sections.length);
    for (const title of item.sections) expect(ALL_SECTIONS).toContain(title);
  }
  expect(SHOWCASE_COLLECTIONS.filter(item => item.kind === "theme").map(item => item.themeId)).toEqual(aetherThemes.map(theme => theme.id));
  expect(SHOWCASE_COLLECTIONS.filter(item => item.kind === "app").map(item => item.id)).toEqual(["app-cad", "app-animation", "app-map", "app-io", "app-studio"]);
});

test("collection membership round-trips while unavailable sections, duplicates and invalid themes are handled", () => {
  const encode = (items: unknown[]) => JSON.stringify({ version: 1, collections: items });
  expect(parseCollections(encode([example]))).toEqual([example]);
  expect(parseCollections(encode([{ ...example, sections: ["Flow diagrams", "retired", "Flow diagrams"] }]))[0].sections).toEqual(["Flow diagrams"]);
  expect(() => parseCollections(encode([example, example]))).toThrow();
  expect(() => parseCollections(encode([{ ...example, kind: "theme", themeId: "missing" }]))).toThrow();
  expect(() => parseCollections(encode([{ ...example, sections: [] }]))).toThrow();
  expect(() => parseCollections(encode([null]))).toThrow();
});

test("deep links restore collection and cross-tab selection, mode and existing layout parameters", () => {
  const items = [...SHOWCASE_COLLECTIONS, example];
  const hash = showcaseHash({ tab: "elements", section: "Buttons", collectionId: example.id, mode: "dark" }, "#layout=floating");
  expect(hash).toContain("layout=floating");
  expect(readShowcaseLocation(hash, items)).toEqual({ tab: "elements", section: "Buttons", collectionId: example.id, mode: "dark" });
  expect(readShowcaseLocation(`#tab=widgets&section=${sectionID("Flow diagrams")}`, items).section).toBe("Flow diagrams");
  expect(readShowcaseLocation("#tab=widgets&collection=missing&section=missing", items)).toMatchObject({ tab: "widgets", section: "Menus", collectionId: undefined });
  expect(readShowcaseLocation("#tab=icons&collection=flow-signals&section=missing", items)).toMatchObject({ tab: "widgets", section: "Flow diagrams", collectionId: "flow-signals" });
});

test("old chrome and toolbar links follow relocated sections without escaping a saved collection", () => {
  for (const [tab, title] of [["chrome", "Side tool bars"], ["chrome", "Document tabs"], ["widgets", "Top tool bars"], ["widgets", "Center tray tool bar"]]) {
    const view = readShowcaseLocation(`#tab=${tab}&section=${sectionID(title)}`, SHOWCASE_COLLECTIONS);
    expect(view).toMatchObject({ tab: "windows", section: title });
    expect(showcaseHash(view)).toContain("tab=windows");
  }
  expect(readShowcaseLocation("#tab=chrome", SHOWCASE_COLLECTIONS).tab).toBe("windows");
  expect(readShowcaseLocation(`#tab=chrome&collection=flow-signals&section=${sectionID("Side tool bars")}`, SHOWCASE_COLLECTIONS))
    .toMatchObject({ tab: "widgets", section: "Flow diagrams", collectionId: "flow-signals" });
});

test("collection tray expands only the selected collection and navigates to an actual member", () => {
  const navigate = vi.fn();
  render(<ShowcaseCollections kind="collection" collections={[...SHOWCASE_COLLECTIONS, example]} selectedId={example.id} selectedSection="Flow diagrams" onNavigate={navigate} onCreate={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Flow diagrams" }).getAttribute("aria-current")).toBe("page");
  fireEvent.click(screen.getByRole("button", { name: "Buttons" }));
  expect(navigate).toHaveBeenCalledWith(example, "Buttons");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "website" } });
  expect(screen.queryByRole("button", { name: "Workspace patterns 5" })).toBeNull();
  expect(screen.getByText("Your collections")).toBeTruthy();
});

test("create and edit collections across categories, requiring a name and members, with theme binding", () => {
  const save = vi.fn();
  render(<ShowcaseCollectionEditor initial={{ ...example, label: "", sections: [] }} existing={SHOWCASE_COLLECTIONS} onSave={save} onClose={vi.fn()} />);
  const dialog = within(screen.getByRole("dialog"));
  const submit = dialog.getByRole("button", { name: "Save collection" }) as HTMLButtonElement;
  expect(submit.disabled).toBe(true);
  fireEvent.change(dialog.getByRole("textbox", { name: "Collection name" }), { target: { value: "Operator theme" } });
  fireEvent.change(dialog.getByRole("combobox", { name: "Collection group" }), { target: { value: "theme" } });
  fireEvent.change(dialog.getByRole("combobox", { name: "Collection theme" }), { target: { value: aetherThemes[1].id } });
  fireEvent.click(dialog.getByRole("checkbox", { name: "Buttons" }));
  fireEvent.change(dialog.getByRole("searchbox"), { target: { value: "Flow diagrams" } });
  fireEvent.click(dialog.getByRole("checkbox", { name: "Flow diagrams" }));
  expect(dialog.getByText("2 selected")).toBeTruthy();
  fireEvent.click(submit);
  expect(save).toHaveBeenCalledWith({ ...example, label: "Operator theme", kind: "theme", themeId: aetherThemes[1].id, sections: ["Buttons", "Flow diagrams"] });
});

test("editing preserves hidden members and prevents duplicate collection names", () => {
  const save = vi.fn(), close = vi.fn();
  render(<ShowcaseCollectionEditor initial={example} existing={[...SHOWCASE_COLLECTIONS, example]} onSave={save} onClose={close} />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Flow diagrams" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Flow diagrams" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Collection name" }), { target: { value: "Flow & signals" } });
  expect((screen.getByRole("button", { name: "Save collection" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByRole("textbox", { name: "Collection name" }), { target: { value: "Just buttons" } });
  fireEvent.click(screen.getByRole("button", { name: "Save collection" }));
  expect(save.mock.calls[0][0].sections).toEqual(["Buttons"]);
});

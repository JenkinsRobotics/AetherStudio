import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { StudioSpecimens } from "../gallery/showcase/StudioSpecimens";
import { STUDIO_SPECIMEN_SECTIONS as sections, STUDIO_SPECIMEN_SOURCES } from "../gallery/showcase/studio-specimen-sections";
import { ALL_SECTIONS, parseCollections, readShowcaseLocation } from "../gallery/showcase/collections";
import { sectionID } from "../gallery/showcase";

beforeEach(() => vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("all five studio trees appear together without unrelated controls", () => {
  const { container } = render(<StudioSpecimens section={sections.trees}/>);
  for (const title of ["Scene hierarchy", "Model browser", "Wheel features", "Compact reference features", "Feature browser"])
    expect(screen.getByRole("heading", { name: title })).toBeTruthy();
  expect(container.querySelectorAll("[data-studio-source]")).toHaveLength(5);
  expect(screen.queryByRole("heading", { name: "Reference properties" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Surface finishes" })).toBeNull();
  expect(container.querySelector("details")).toBeNull();
});

test("all thirty controls survive the move and mount only in their functional section", () => {
  const counts = { trees: 5, inspectors: 9, appearance: 10, timelines: 1, collaboration: 1, revisions: 2, viewports: 2, floating: 1 };
  for (const [kind, section] of Object.entries(sections)) {
    const { container, unmount } = render(<StudioSpecimens section={section}/>);
    const specimens = [...container.querySelectorAll("[data-studio-source]")].flatMap(host =>
      [...host.querySelectorAll(":scope > div > article, :scope > div > .ms-specimen-grid > article, :scope > .avatar-widget-grid > div")]);
    expect(specimens.length, section).toBe(counts[kind as keyof typeof counts]);
    expect([...container.querySelectorAll("[data-studio-kind]")].every(host => host.getAttribute("data-studio-kind") === kind)).toBe(true);
    unmount();
  }
  for (const source of STUDIO_SPECIMEN_SOURCES) expect(ALL_SECTIONS).not.toContain(source.oldSection);
});

test("old wheel bookmarks and saved mixed collections retain every relocated control category", () => {
  const old = "Wheel reference controls";
  expect(readShowcaseLocation(`#tab=widgets&section=${sectionID(old)}`, [])).toMatchObject({tab:"widgets", section:sections.trees});
  const saved = parseCollections(JSON.stringify({version:1, collections:[{id:"custom-wheel",label:"Wheel controls",description:"",kind:"collection",sections:[old,"Buttons",sections.trees]}]}));
  expect(saved[0].sections).toEqual([sections.trees,sections.inspectors,"Buttons"]);
  expect(readShowcaseLocation(`#tab=widgets&collection=custom-wheel&section=${sectionID(old)}`, saved)).toMatchObject({collectionId:"custom-wheel",section:sections.trees});
  const restricted = [{...saved[0],sections:[sections.inspectors]}];
  expect(readShowcaseLocation(`#collection=custom-wheel&section=${sectionID(old)}`, restricted).section).toBe(sections.inspectors);
  for (const source of STUDIO_SPECIMEN_SOURCES) {
    const [collection] = parseCollections(JSON.stringify({version:1,collections:[{...saved[0],sections:[source.oldSection]}]}));
    expect(collection.sections).toHaveLength(source.kinds.length);
    expect(collection.sections.every(section => ALL_SECTIONS.includes(section))).toBe(true);
  }
});

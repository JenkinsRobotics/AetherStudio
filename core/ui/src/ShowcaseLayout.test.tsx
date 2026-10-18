import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { ShowcaseSections } from "../gallery/showcase/ShowcaseLayout";
import { SHOWCASE_TABS, sectionID } from "../gallery/showcase";
import { SECTION, kitSpecimenSection, nativeTemplateSections, nativeVariantSections } from "../gallery/showcase/inventory";

const widgets = SHOWCASE_TABS.find(tab => tab.id === "widgets")!;
const windows = SHOWCASE_TABS.find(tab => tab.id === "windows")!;
function SampleSection({ title }: { title: string }) { return <section id={sectionID(title)} data-title={title}>{title}</section>; }

test("elements, widgets and windows have ordered categories with one place for each subsection", () => {
  const elements = SHOWCASE_TABS.find(tab => tab.id === "elements")!;
  expect(elements.groups.map(group => group.label)).toEqual(["Buttons", "Text & input", "Selection", "Navigation", "Feedback"]);
  // Shared widget categories first, then app-specific ones.
  expect(widgets.groups.map(group => group.label)).toEqual(["Menus & commands", "Lists & trees", "Tables", "Forms & inspectors", "Color & appearance", "Editors", "Panels & cards", "PDM & collaboration", "Aether CAD", "Aether IO"]);
  expect(widgets.groups[0].sections).toEqual(["Menus", "Command palettes"]);
  expect(windows.groups.map(group => group.label)).toEqual(["Container standards", "Window layouts", "Header bars", "Navigation bars", "Sidebars", "Toolbars", "Status bars", "Application windows", "Floating windows", "Dialogs & popovers", "Notifications", "Viewports & guidance"]);
  for (const tab of SHOWCASE_TABS) {
    expect(tab.sections).toEqual(tab.groups.flatMap(group => [...group.sections]));
    expect(new Set(tab.sections).size).toBe(tab.sections.length);
    expect(new Set(tab.sections.map(sectionID)).size).toBe(tab.sections.length);
  }
});

test("only the selected section mounts, including cross-tab collection navigation", () => {
  const children = SHOWCASE_TABS.flatMap(tab => tab.sections).reverse().map(title => <SampleSection key={title} title={title} />);
  const { container, rerender } = render(<ShowcaseSections tab="widgets" selected="Flow diagrams">{children}</ShowcaseSections>);
  expect([...container.querySelectorAll("[data-title]")].map(el => el.getAttribute("data-title"))).toEqual(["Flow diagrams"]);
  rerender(<ShowcaseSections tab="windows" selected="Popovers" individual>{children}</ShowcaseSections>);
  expect([...container.querySelectorAll("[data-title]")].map(el => el.getAttribute("data-title"))).toEqual(["Popovers"]);
  expect(screen.queryByText("Flow diagrams")).toBeNull();
});

test.each(windows.groups.filter(group => group.reviewTogether))("$label mounts each design once in category order and collection views remain focused", (group) => {
  const children = SHOWCASE_TABS.flatMap(tab => tab.sections).reverse().map(title => <SampleSection key={title} title={title} />);
  const { container, rerender } = render(<ShowcaseSections tab="windows" selected={group.sections[1]}>{children}</ShowcaseSections>);
  expect([...container.querySelectorAll("[data-title]")].map(node => node.getAttribute("data-title"))).toEqual(group.sections);
  rerender(<ShowcaseSections tab="windows" selected={group.sections[1]} individual>{children}</ShowcaseSections>);
  expect([...container.querySelectorAll("[data-title]")].map(node => node.getAttribute("data-title"))).toEqual([group.sections[1]]);
});


test("relocated imports follow their function without introducing duplicate specimens", () => {
  expect(kitSpecimenSection("kit", "Panels & Lists", "List rows · states")).toBe(SECTION.lists);
  expect(kitSpecimenSection("kit", "Timeline & Graph", "Servo track")).toBe(SECTION.timelines);
  expect(nativeTemplateSections.popover).toBe(SECTION.popovers);
  expect(nativeVariantSections.graphicsPopover).toBe(SECTION.popovers);
  expect(nativeTemplateSections["notification-popup"]).toBe(SECTION.toasts);
  expect(windows.sections).toContain(SECTION.dialogs);
  expect(widgets.sections).toContain(SECTION.tabular);
});


test("Apps mounts applications and workspace windows together from either section", () => {
  const apps = SHOWCASE_TABS.find(tab => tab.id === "apps")!;
  const children = apps.sections.map(title => <SampleSection key={title} title={title} />);
  const { container, rerender } = render(<ShowcaseSections tab="apps" selected={apps.sections[0]}>{children}</ShowcaseSections>);
  expect([...container.querySelectorAll("[data-title]")].map(node => node.getAttribute("data-title"))).toEqual(apps.sections);
  rerender(<ShowcaseSections tab="apps" selected={apps.sections[1]}>{children}</ShowcaseSections>);
  expect([...container.querySelectorAll("[data-title]")].map(node => node.getAttribute("data-title"))).toEqual(apps.sections);
});

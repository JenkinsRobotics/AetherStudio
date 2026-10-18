import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { EditingContainerSpecimen, FloatingContainerSpecimen, OverlayContainerOverview, OverlayWindowSpecimens } from "../gallery/OverlayContainers";
import { CAD_FEATURE_EDITORS } from "../gallery/CADFeatureEditors";
import { SHOWCASE_TABS, sectionID } from "../gallery/showcase";

test("the Overlays container directory points to independently reviewable shared families", () => {
  render(<OverlayContainerOverview />);
  expect(SHOWCASE_TABS.find(tab => tab.id === "windows")?.label).toBe("Overlays");
  const sections = SHOWCASE_TABS.find(tab => tab.id === "windows")!.sections;
  const links = screen.getAllByRole("link");
  expect(links).toHaveLength(9);
  for (const link of links) {
    const params = new URLSearchParams(link.getAttribute("href")!.slice(1));
    expect(params.get("tab")).toBe("windows");
    expect(sections.map(sectionID)).toContain(params.get("section"));
  }
});

test("changing a floating panel's content preserves its shared frame, position and form state", () => {
  const { container } = render(<FloatingContainerSpecimen />);
  const frame = container.querySelector(".aui-float-panel");
  const header = screen.getByRole("group", { name: "Move Floating panel" });
  fireEvent.keyDown(header, { key: "ArrowRight" });
  fireEvent.change(screen.getByRole("textbox", { name: "Sample name" }), { target: { value: "Bracket" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Show edges" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Example content" }), { target: { value: "info" } });
  expect(screen.getByText("About this sample")).toBeTruthy();
  expect(container.querySelector(".aui-float-panel")).toBe(frame);
  expect((frame as HTMLElement).style.left).toBe("10px");
  expect(container.querySelector(".aui-float-panel-header")).toBe(header);
  fireEvent.change(screen.getByRole("combobox", { name: "Example content" }), { target: { value: "form" } });
  expect((screen.getByRole("textbox", { name: "Sample name" }) as HTMLInputElement).value).toBe("Bracket");
  expect((screen.getByRole("checkbox", { name: "Show edges" }) as HTMLInputElement).checked).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Close Floating panel" }));
  expect(container.querySelector(".aui-float-panel")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reopen floating panel" }));
  expect(container.querySelector(".aui-float-panel")).toBeTruthy();
});

test.each(["standard", "compact"] as const)("the %s editing container keeps its actions and Help when hosting non-CAD content", variant => {
  const { container } = render(<EditingContainerSpecimen variant={variant} />);
  const frame = container.querySelector(".aui-feature-window");
  const actions = screen.getByRole("group", { name: "Feature accessories" });
  fireEvent.change(screen.getByRole("combobox", { name: "Example content" }), { target: { value: "info" } });
  expect(container.querySelector(".aui-feature-window")).toBe(frame);
  expect(screen.getByText("About this sample")).toBeTruthy();
  fireEvent.click(within(actions).getByRole("button", { name: "Help" }));
  expect(within(actions).getByRole("button", { name: "Help" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.queryByRole("region", { name: "Editing popup help" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: variant === "compact" ? "Apply" : "Apply sample" }));
  expect(container.querySelector(".aui-feature-window")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("Sample applied");
  fireEvent.click(screen.getByRole("button", { name: "Reopen editing popup" }));
  expect(container.querySelectorAll(".aui-feature-window")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: variant === "compact" ? "Cancel" : "Discard sample" }));
  expect(screen.getByRole("status").textContent).toBe("Sample discarded");
});

test("the standard floating window showcase includes both feature variants with the reference content and action placement", () => {
  render(<OverlayWindowSpecimens />);
  const standard = screen.getByRole("group", { name: "Standard editing window" });
  const compact = screen.getByRole("group", { name: "Compact editing window" });
  expect(within(standard).getByText("Revolute 1")).toBeTruthy();
  expect(within(standard).getByRole("button", { name: "Accept mate" }).closest(".aui-float-panel-header")).toBeTruthy();
  expect(compact.querySelector(".aui-float-panel-title")?.textContent).toBe("Sketch");
  expect(within(compact).getByRole("button", { name: "Apply" }).closest(".aui-feature-commit-actions")).toBeTruthy();
  expect(standard.querySelector(".aui-feature-header-icon svg")).toBeTruthy();
  expect(compact.querySelector(".aui-feature-header-icon svg")).toBeTruthy();
  fireEvent.click(within(compact).getByRole("button", { name: "Remove Top Plane" }));
  expect(within(compact).getByRole("button", { name: "Apply" }).hasAttribute("disabled")).toBe(true);
  expect(within(compact).getByText("Select a sketch plane.")).toBeTruthy();
  // Choosing another body clears the previous feature's validation error.
  fireEvent.change(within(compact).getByRole("combobox", { name: "Example content" }), { target: { value: "mate" } });
  expect(within(compact).getByRole("button", { name: "Apply" }).hasAttribute("disabled")).toBe(false);
  expect(within(compact).queryByText("Select a sketch plane.")).toBeNull();
  expect(within(standard).getByRole("button", { name: "Accept mate" }).hasAttribute("disabled")).toBe(false);
});

test("every feature body is available in both shared editing window variants", () => {
  render(<OverlayWindowSpecimens />);
  for (const variant of ["Standard", "Compact"]) {
    const specimen = screen.getByRole("group", { name: `${variant} editing window` });
    for (const editor of CAD_FEATURE_EDITORS) {
      fireEvent.change(within(specimen).getByRole("combobox", { name: "Example content" }), { target: { value: editor.id } });
      expect(specimen.querySelectorAll(".aui-feature-window")).toHaveLength(1);
      expect(specimen.querySelector(".aui-float-panel-title")?.textContent).toBe(variant === "Standard" ? editor.title : editor.title.replace(/\s+\d+$/, ""));
      expect(specimen.querySelector(".aui-feature-entities")).toBeTruthy();
      expect(within(specimen).getByRole("button", { name: variant === "Standard" ? editor.accept : "Apply" }).hasAttribute("disabled")).toBe(false);
    }
  }
});

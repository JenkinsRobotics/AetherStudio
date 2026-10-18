import { NativeLibrary } from "../gallery/showcase/DemoShowcase";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import { AnimationStudioDemo } from "../gallery/AnimationStudioDemo";

beforeEach(() => window.localStorage.clear());

test("the launchable Aether concept keeps the native Assets workflow interactive", () => {
  const { container } = render(<AnimationStudioDemo />);

  expect(container.querySelector(".aui-shell-fltoolbar .animation-ribbon-surface")).toBeTruthy();
  expect(screen.getByRole("grid", { name: "Character parts" })).toBeTruthy();
  const collection=within(screen.getByRole("region", {name:"Active character parts"}));
  expect(collection.getByText("arcada001_-_arcad004")).toBeTruthy();
  expect(screen.getByRole("button", { name: "3D Character" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Character" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Relink" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Units" })).toBeTruthy();

  fireEvent.change(screen.getByRole("searchbox", { name: "Filter parts" }), {
    target: { value: "lcd" },
  });
  expect(collection.getByText("arcada001_-_lcd_screen")).toBeTruthy();
  expect(collection.queryByText("arcada001_-_arcad004")).toBeNull();

  fireEvent.click(screen.getByRole("radio", { name: "Gallery" }));
  expect(collection.getByText("ARCADA001 - lcd screen .step")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: /^Import$/ }));
  const dialog = screen.getByRole("dialog", { name: "Import 3D model" });
  expect(dialog).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Source file"), {
    target: { value: "jaw_panel.step" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Import" }));
  expect(collection.getByText("jaw_panel")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Studio mode: Floating" }));
  expect(container.querySelector(".animation-studio")?.getAttribute("data-layout")).toBe("docked");
  expect(container.querySelector(".aui-shell-toolbar .animation-ribbon-surface")).toBeTruthy();
});

test("the Aether concept switches complete workspaces and exposes their real shared controls", () => {
  const { container } = render(<AnimationStudioDemo />);

  expect((screen.getByRole("combobox", { name: "Character type" }) as HTMLSelectElement).value).toBe("3d");
  for (const workspace of ["Assets", "3D Modeling", "Animate", "Show", "Hardware"]) {
    expect(screen.getByRole("tab", { name: workspace })).toBeTruthy();
  }

  fireEvent.click(screen.getByRole("tab", { name: "3D Modeling" }));
  expect(screen.getByText("3D MODELING VIEW")).toBeTruthy();
  for (const category of ["Build", "Mates", "Relations", "Inspect"]) {
    expect(screen.getByRole("tab", { name: category })).toBeTruthy();
  }
  expect(screen.getByRole("tab", { name: "Build" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("button", { name: "Box" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Empty Point" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "More" }).getAttribute("data-icon-only")).toBe("true");
  const ribbon = container.querySelector<HTMLElement>(".animation-ribbon-surface")!;
  expect(ribbon.classList.contains("animation-ribbon-surface--tabs")).toBe(true);
  expect(within(ribbon).getByText("Create")).toBeTruthy();
  expect(within(ribbon).getByText("Structure")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Mates" }));
  expect(screen.getByRole("button", { name: "Revolute" })).toBeTruthy();

  fireEvent.click(screen.getByRole("tab", { name: "Animate" }));
  expect(screen.getByText("TRACKS")).toBeTruthy();
  expect(screen.getByText("Main")).toBeTruthy();
  expect(screen.getByText("OUTPUT OFFLINE")).toBeTruthy();
  expect((screen.getByRole("radio", { name: "Dope Sheet" }) as HTMLButtonElement).getAttribute("aria-checked")).toBe("true");
  for (const section of ["Transport", "Keyframes", "Curves", "Tracks", "Reference", "Keys", "Playback", "Edit"]) {
    expect(screen.getByRole("tab", { name: section })).toBeTruthy();
  }
  expect(screen.getAllByRole("button", { name: "Play" }).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("radio", { name: "3D" }));
  expect(screen.getByText("ANIMATION PREVIEW")).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "Curves" }));
  expect(screen.getByLabelText("Animation curves")).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "Dope Sheet" }));
  fireEvent.click(screen.getByRole("button", { name: "Next frame" }));
  expect(screen.getByLabelText("Timeline position").textContent).toContain("00:00:01");
  fireEvent.click(screen.getByRole("button", { name: "Stop" }));
  expect(screen.getByLabelText("Timeline position").textContent).toContain("00:00:00");
  fireEvent.click(screen.getByRole("tab", { name: "Keyframes" }));
  expect(screen.getByRole("button", { name: "Add Key" })).toBeTruthy();
  expect(screen.getByText("Head · pan")).toBeTruthy();

  fireEvent.click(screen.getByRole("tab", { name: "Show" }));
  expect(screen.getByLabelText("Scene node graph")).toBeTruthy();
  expect(screen.getByLabelText("Node Library")).toBeTruthy();
  expect(screen.getByLabelText("Node Inspector")).toBeTruthy();
  expect((screen.getByRole("radio", { name: "Node Graph" }) as HTMLButtonElement).getAttribute("aria-checked")).toBe("true");
  for (const section of ["Sequence", "Clips", "Events", "Sync", "Nodes", "Output", "Edit"]) {
    expect(screen.getByRole("tab", { name: section })).toBeTruthy();
  }
  fireEvent.click(screen.getByRole("button", { name: "Greeting Motion node" }));
  expect((screen.getByRole("textbox", { name: "Node name" }) as HTMLInputElement).value).toBe("Greeting Motion");
  fireEvent.change(screen.getByRole("textbox", { name: "Find a node" }), { target: { value: "Single-Line IF" } });
  fireEvent.click(within(screen.getByLabelText("Node Library")).getByRole("button", { name: /Single-Line IF/ }));
  expect((screen.getByRole("textbox", { name: "Node name" }) as HTMLInputElement).value).toBe("Single-Line IF");
  fireEvent.click(screen.getByRole("tab", { name: "Nodes" }));
  expect(screen.getByRole("button", { name: "Branch" })).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "Table" }));
  expect(screen.getByRole("table", { name: "Show scene actions" })).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "3D" }));
  expect(screen.getByText("SHOW PREVIEW")).toBeTruthy();
  expect(screen.getByText("Character entrance")).toBeTruthy();

  fireEvent.click(screen.getByRole("tab", { name: "Hardware" }));
  expect(screen.getByRole("grid", { name: "Output mappings" })).toBeTruthy();
  for (const section of ["Connection", "Outputs", "Mapping", "Calibration", "Safety", "Monitor"]) {
    expect(screen.getByRole("tab", { name: section })).toBeTruthy();
  }
  expect(screen.getByText("Driver Connection")).toBeTruthy();
  expect(screen.getByText("No Driver Session")).toBeTruthy();

  expect(screen.queryByRole("tab", { name: "UI Dev" })).toBeNull();
});

test("the central native showcase preserves the complete UI Dev browser and its interactions", () => {
  const migrated = render(<NativeLibrary/>);
  expect(screen.getByText("LIVING UI STANDARD")).toBeTruthy();
  expect(screen.getByText("Every current surface, together")).toBeTruthy();
  expect(screen.getByText("37 TEMPLATES")).toBeTruthy();
  expect(screen.getByText("7 SECTIONS")).toBeTruthy();
  expect(migrated.container.querySelectorAll(".aui-specimen-card")).toHaveLength(37);
  const compactCard = screen.getByText("Compact Action Panel").closest(".aui-specimen-card") as HTMLElement;
  fireEvent.click(within(compactCard).getByRole("button", { name: /New Query/ }));
  expect(within(compactCard).getByText("Created query 1")).toBeTruthy();
  fireEvent.click(within(compactCard).getByRole("button", { name: /Dark/ }));
  expect(within(compactCard).getByText("Created query 1").closest(".aui-compact-action-panel")?.classList.contains("is-dark")).toBe(true);
  expect(screen.getByText("Concept Template Cards").closest(".aui-specimen-card")?.classList.contains("aui-specimen-card--wide")).toBe(false);
  for (const section of ["App Surfaces", "Interaction Labs", "Patterns", "Controls", "Foundations"]) {
    expect(screen.getByRole("tab", { name: section })).toBeTruthy();
  }
  expect(screen.getByRole("button", { name: "All Templates" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Mate Editor" })).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "Interaction Labs" }));
  expect(screen.getByRole("button", { name: "Mate Editor" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Triad" })).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Controls" }));
  expect(screen.getByRole("button", { name: "Buttons" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Inputs" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Menus" })).toBeTruthy();
  for (const specimen of ["Recent Projects", "Project Navigator", "3D Workspace", "Aether Agent", "Animation Timeline", "Material Editor", "Rig Creation Palette", "Layered Icon List", "Hardware Monitor", "Character Part Import", "Action Buttons", "Compact Action Panel", "Concept Template Cards", "Icon Selector & Theme Lab"]) {
    expect(screen.getAllByText(specimen).length).toBeGreaterThan(0);
  }
  fireEvent.click(screen.getByRole("tab", { name: "App Surfaces" }));
  fireEvent.click(screen.getByRole("button", { name: "Agent" }));
  expect(screen.getByText("AGENT")).toBeTruthy();
  expect(screen.getByRole("region", { name: "Aether Agent" })).toBeTruthy();
  expect(screen.queryByText("Material Editor")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Review this workspace layout" }));
  expect((screen.getByRole("textbox", { name: "Ask Aether Agent" }) as HTMLInputElement).value).toBe("Review this workspace layout");
  fireEvent.click(screen.getByRole("button", { name: "All Templates" }));
  expect(screen.getByText("Every current surface, together")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Foundations" }));
  fireEvent.click(screen.getByRole("button", { name: "Tokens" }));
  expect(screen.getByText("TOKENS")).toBeTruthy();
  expect(screen.getAllByText("Appearance").length).toBeGreaterThan(0);
  expect(screen.getByText("Layout & Style Controls")).toBeTruthy();
});

test("the kit toolbar scrolls and preserves its archived density and shape choices", () => {
  const { container } = render(<AnimationStudioDemo />);
  const surface = container.querySelector<HTMLElement>(".animation-ribbon-surface");
  expect(surface?.dataset.density).toBe("expanded");
  expect(surface?.dataset.shape).toBe("soft");
  expect(screen.getByRole("button", { name: "Scroll tools left" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Scroll tools right" })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Tool bar density and shape" }));
  const settings = screen.getByRole("dialog", { name: "Tool bar density and shape" });
  fireEvent.click(within(settings).getByRole("button", { name: /Compact/ }));
  expect(surface?.dataset.density).toBe("compact");
  expect(window.localStorage.getItem("aether.animation-studio.toolbar-density")).toBe("compact");
  fireEvent.click(screen.getByRole("button", { name: "Tool bar density and shape" }));

  expect(screen.queryByRole("button", { name: "3D Character" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Create tools" }));
  const createTools = screen.getByRole("dialog", { name: "Create tools" });
  expect(within(createTools).getByRole("button", { name: "3D Character" })).toBeTruthy();
  fireEvent.click(within(createTools).getByRole("button", { name: "3D Character" }));

  fireEvent.click(screen.getByRole("button", { name: "Tool bar density and shape" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Tool bar density and shape" })).getByRole("button", { name: /Square/ }));
  expect(surface?.dataset.shape).toBe("square");
  expect(window.localStorage.getItem("aether.animation-studio.toolbar-shape")).toBe("square");
});

test("the migration keeps all nine archived product workspaces individually reachable", () => {
  render(<AnimationStudioDemo />);
  const selector = screen.getByRole("combobox", { name: "All Aether workspaces" }) as HTMLSelectElement;
  const productGroup = Array.from(selector.querySelectorAll("optgroup")).find((group) => group.label === "Product workspaces");
  expect(productGroup?.querySelectorAll("option")).toHaveLength(9);
  for (const [id, visible] of [["canvas2d", "2D Preview"], ["vr", "VR Avatar"], ["nodes", "NODE LIBRARY"], ["design", "DESIGN SANDBOX · PLACEHOLDER GEOMETRY"]] as const) {
    fireEvent.change(selector, { target: { value: id } });
    expect(screen.getByText(visible)).toBeTruthy();
  }
});

test("Aether settings control the saved overlay and push panel relationship", () => {
  const { container } = render(<AnimationStudioDemo />);
  expect(container.querySelector(".aui-shell")?.getAttribute("data-panel-relationship")).toBe("overlay");
  fireEvent.click(screen.getByRole("button", { name: "Aether Animation Studio settings" }));
  const dialog = screen.getByRole("dialog", { name: "Aether Animation Studio Settings" });
  expect(dialog.getAttribute("aria-modal")).toBeNull();
  fireEvent.click(within(dialog).getByRole("radio", { name: "Docked" }));
  expect(container.querySelector(".animation-studio")?.getAttribute("data-layout")).toBe("docked");
  expect(container.querySelector(".aui-shell")?.getAttribute("data-panel-relationship")).toBe("push");
  expect(window.localStorage.getItem("aether.animation-studio.default-layout")).toBe("docked");
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "Push panels to the outer edge" }));
  expect(window.localStorage.getItem("aether.animation-studio.panels-on-outer-edge")).toBe("true");
});

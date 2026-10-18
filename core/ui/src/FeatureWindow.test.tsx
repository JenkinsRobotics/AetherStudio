import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { openFeatureWindow } from "./FeatureWindow";
import { CADFeatureEditors, CAD_FEATURE_EDITORS } from "../gallery/CADFeatureEditors";
import { CompactFeaturePopupDemo } from "../gallery/CompactFeaturePopupDemo";
import { FeatureEditorVariants } from "../gallery/FeatureEditorVariants";

afterEach(() => { cleanup(); document.body.replaceChildren(); });

function mount(help?: { summary: string; steps: string[] }) {
  const onAccept = vi.fn(), onDiscard = vi.fn(), onHelpToggle = vi.fn();
  const win = openFeatureWindow({ viewport: document.body, className: "test-feature", title: "Loft 1",
    acceptLabel: "Apply loft", discardLabel: "Cancel loft", onAccept, onDiscard, help, onHelpToggle });
  return { win, onAccept, onDiscard, onHelpToggle };
}

test("the final icon row toggles Help without inserting content, moving focus or changing the editor structure", () => {
  const { win, onAccept, onDiscard, onHelpToggle } = mount();
  win.row("Depth", document.createElement("input"));
  const footer = screen.getByRole("group", { name: "Feature accessories" });
  expect(win.panel.lastElementChild?.contains(footer)).toBe(true);
  const button = within(footer).getByRole("button", { name: "Help" });
  const elements = [...win.panel.querySelectorAll("*")];
  button.focus();
  expect(button.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(button);
  expect(button.getAttribute("aria-pressed")).toBe("true");
  expect(button.hasAttribute("aria-expanded")).toBe(false);
  expect(button.hasAttribute("aria-controls")).toBe(false);
  expect(screen.queryByRole("region")).toBeNull();
  expect([...win.panel.querySelectorAll("*")]).toEqual(elements);
  expect(document.activeElement).toBe(button);
  fireEvent.click(button);
  expect(button.getAttribute("aria-pressed")).toBe("false");
  expect(onHelpToggle.mock.calls).toEqual([[true], [false]]);
  expect(onAccept).not.toHaveBeenCalled();
  expect(onDiscard).not.toHaveBeenCalled();
});

test("accessory icons have independent toggle state and never commit or discard a feature", () => {
  const { win, onAccept, onDiscard } = mount();
  const guides = vi.fn(), normal = vi.fn();
  const first = win.actionIcon("<svg/>", "Show guides", guides);
  const second = win.actionIcon("<svg/>", "View normal", normal, true);
  const footer = screen.getByRole("group", { name: "Feature accessories" });
  expect(within(footer).getAllByRole("button").map(b => b.getAttribute("aria-label")))
    .toEqual(["Show guides", "View normal", "Help"]);
  fireEvent.keyDown(first, { key: "Enter" });
  fireEvent.click(first);
  expect(first.getAttribute("aria-pressed")).toBe("true");
  expect(second.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(first);
  fireEvent.click(second);
  expect(first.getAttribute("aria-pressed")).toBe("false");
  expect(second.getAttribute("aria-pressed")).toBe("false");
  expect(guides.mock.calls).toEqual([[true], [false]]);
  expect(normal).toHaveBeenCalledWith(false);
  expect(onAccept).not.toHaveBeenCalled();
  expect(onDiscard).not.toHaveBeenCalled();
});

test("field Enter still accepts valid edits while accessory keys never reach editor shortcuts", () => {
  const { win, onAccept, onDiscard } = mount();
  const field = document.createElement("input");
  win.row("Depth", field);
  fireEvent.keyDown(field, { key: "Enter" });
  expect(onAccept).toHaveBeenCalledOnce();
  win.setError("Choose two profiles");
  fireEvent.keyDown(field, { key: "Enter" });
  const help = screen.getByRole("button", { name: "Help" });
  fireEvent.keyDown(help, { key: "Enter" });
  fireEvent.click(help);
  fireEvent.keyDown(help, { key: " " });
  fireEvent.keyDown(help, { key: "Escape" });
  expect(help.getAttribute("aria-pressed")).toBe("false");
  expect(onAccept).toHaveBeenCalledOnce();
  expect(onDiscard).not.toHaveBeenCalled();
  win.setError(null);
  const tabs = win.tabs(["Solid", "Surface"]);
  fireEvent.keyDown(tabs.firstElementChild!, { key: "Enter" });
  expect(onAccept).toHaveBeenCalledOnce();
  fireEvent.keyDown(field, { key: "Enter" });
  expect(onAccept).toHaveBeenCalledTimes(2);
});

test("legacy help copy never appears and app state can synchronize the icon without a callback loop", () => {
  const { win, onHelpToggle } = mount({ summary: "<b>Choose profiles</b>", steps: ["Select two sections"] });
  const button = screen.getByRole("button", { name: "Help" });
  win.setHelpActive(true);
  expect(button.getAttribute("aria-pressed")).toBe("true");
  expect(onHelpToggle).not.toHaveBeenCalled();
  fireEvent.click(button);
  expect(onHelpToggle).toHaveBeenCalledWith(false);
  expect(win.panel.textContent).not.toContain("Choose profiles");
  expect(win.panel.querySelector(".aui-feature-help")).toBeNull();
});

test("all nine standard gallery editors inherit the icon-only row", () => {
  const { container } = render(<CADFeatureEditors />);
  expect(container.querySelectorAll(".aui-feature-window")).toHaveLength(9);
  expect(screen.getAllByRole("button", { name: "Help" })).toHaveLength(9);
  const loft = within(screen.getByRole("group", { name: "Loft 1 editor" }));
  const button = loft.getByRole("button", { name: "Help" });
  fireEvent.click(button);
  expect(button.getAttribute("aria-pressed")).toBe("true");
  expect(loft.queryByRole("region")).toBeNull();
  expect(loft.getByRole("button", { name: "Apply loft" })).toBeTruthy();
});

test("the compact row toggles Help and Escape turns it off without losing draft values", () => {
  render(<CompactFeaturePopupDemo />);
  const depth = screen.getByRole("textbox", { name: "Depth" });
  fireEvent.change(depth, { target: { value: "33" } });
  fireEvent.blur(depth);
  const button = screen.getByRole("button", { name: "Help" });
  fireEvent.click(button);
  expect(button.getAttribute("aria-pressed")).toBe("true");
  fireEvent.keyDown(button, { key: "Escape" });
  expect(button.getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("region", { name: "Extrude reference parameters" })).toBeTruthy();
  expect((depth as HTMLInputElement).value).toBe("33");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("region", { name: "Extrude reference parameters" })).toBeTruthy();
  expect((screen.getByRole("textbox", { name: "Depth" }) as HTMLInputElement).value).toBe("25");
  expect(screen.queryByRole("button", { name: "Reopen popup" })).toBeNull();
  expect(screen.getByRole("button", { name: "Help" }).getAttribute("aria-pressed")).toBe("false");
});

test("compact standard Extrude body keeps dependent fields, validation and bottom actions", () => {
  const { container } = render(<CompactFeaturePopupDemo />);
  expect(container.querySelector("header button")).toBeNull();
  expect(screen.getAllByRole("button", { name: "Apply" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Surface" }));
  expect(screen.getByRole("button", { name: "Surface" }).classList.contains("active")).toBe(true);
  fireEvent.change(screen.getByRole("textbox", { name: "Depth" }), { target: { value: "42" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(screen.getByRole("status").textContent).toContain("Sample applied · Extrude");
  expect((screen.getByRole("textbox", { name: "Depth" }) as HTMLInputElement).value).toBe("42");
  fireEvent.click(screen.getByRole("button", { name: "End type" }));
  fireEvent.click(screen.getByRole("option", { name: "Up to face" }));
  expect(screen.queryByRole("textbox", { name: "Depth" })).toBeNull();
  expect(screen.getByLabelText("Up to entity")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Remove Sketch 6" }));
  expect(screen.getByRole("alert").textContent).toContain("Extrude needs a profile region");
  expect((screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("button", { name: "Solid" }).classList.contains("active")).toBe(true);
  expect((screen.getByRole("textbox", { name: "Depth" }) as HTMLInputElement).value).toBe("25");
  expect((screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole("checkbox", { name: "Draft" }));
  expect(screen.getByRole("textbox", { name: "Draft angle" })).toBeTruthy();
});

test.each(CAD_FEATURE_EDITORS)("compact $id reuses the complete standard body", (editor) => {
  const { container } = render(<FeatureEditorVariants />);
  const standard = within(screen.getByRole("group", { name: `${editor.title} editor` }));
  const title = editor.title.replace(/\s+\d+$/, "");
  const compact = screen.getByRole("region", { name: `${title} reference parameters` });
  const standardBody = standard.getByRole("status").parentElement!;
  expect(compact.querySelector(".aui-float-panel-body")!.innerHTML).toBe(standardBody.innerHTML);
  expect(within(compact).getByRole("button", { name: "Cancel" })).toBeTruthy();
  expect(within(compact).getByRole("button", { name: "Apply" })).toBeTruthy();
  expect(compact.querySelector("header button")).toBeNull();
  expect(container.querySelectorAll(".aui-feature-window--compact")).toHaveLength(9);
});

test("retained Loft preserves picker changes, validation and reset while accessories only toggle", () => {
  render(<FeatureEditorVariants />);
  expect(screen.getAllByRole("button", { name: "Help" })).toHaveLength(18);
  expect(screen.queryByRole("heading", { name: "Spacious" })).toBeNull();
  const loft = within(screen.getByRole("group", { name: "Loft 1 editor" }));
  const compact = within(screen.getByRole("region", { name: "Loft reference parameters" }));
  fireEvent.click(loft.getByRole("button", { name: "Start profile condition" }));
  fireEvent.click(loft.getByRole("option", { name: "Normal" }));
  expect(loft.getByRole("button", { name: "Start profile condition" }).textContent).toContain("Normal");
  fireEvent.click(loft.getByRole("button", { name: "Remove Sketch 6" }));
  expect(loft.getByRole("alert").textContent).toContain("at least two profiles");
  expect((loft.getByRole("button", { name: "Apply loft" }) as HTMLButtonElement).disabled).toBe(true);
  expect((compact.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(false);
  const help = loft.getByRole("button", { name: "Help" });
  fireEvent.click(help);
  expect(help.getAttribute("aria-pressed")).toBe("true");
  expect(loft.queryByRole("region")).toBeNull();
  fireEvent.click(loft.getByRole("button", { name: "Discard" }));
  expect(loft.getByRole("button", { name: "Remove Sketch 6" })).toBeTruthy();
  expect(loft.getByRole("button", { name: "Help" }).getAttribute("aria-pressed")).toBe("false");
});

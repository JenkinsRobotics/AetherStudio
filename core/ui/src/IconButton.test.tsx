import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { AetherIcon } from "./AetherIcon";
import { IconButton } from "./IconButton";
import { IconButtonSpecimen } from "../gallery/IconButtonSpecimen";
import { FloatingToolbarDemo } from "../gallery/FloatingToolbarDemo";

test("sizing remains optional and independent of appearance, accessible name and disabled state", () => {
  const select = vi.fn();
  const { rerender } = render(<IconButton label="Save" onClick={select}><AetherIcon name="save" /></IconButton>);
  const button = screen.getByRole("button", { name: "Save" });
  expect(button.getAttribute("data-size")).toBeNull();
  expect(button.getAttribute("data-appearance")).toBe("rounded");
  expect(button.getAttribute("title")).toBe("Save");
  fireEvent.click(button);
  expect(select).toHaveBeenCalledOnce();
  rerender(<IconButton label="Save" size="large" appearance="glyph" disabled onClick={select}><AetherIcon name="save" /></IconButton>);
  expect(button.getAttribute("data-size")).toBe("large");
  expect(button.getAttribute("size")).toBeNull();
  expect(button.getAttribute("data-appearance")).toBe("glyph");
  fireEvent.click(button);
  expect(select).toHaveBeenCalledOnce();
});

test("each size supports all three active treatments and independent toggles", () => {
  render(<IconButtonSpecimen />);
  for (const size of ["Small", "Medium", "Large"]) {
    const group = within(screen.getByRole("group", { name: `${size} active treatments` }));
    for (const [shape, appearance] of [["Glyph", "glyph"], ["Rounded", "rounded"], ["Full cell", "cell"]]) {
      const model = group.getByRole("button", { name: `${size} ${shape} Model` });
      expect(model.getAttribute("data-appearance")).toBe(appearance);
      expect(model.getAttribute("aria-pressed")).toBe("true");
      fireEvent.click(model);
      expect(model.getAttribute("aria-pressed")).toBe("false");
      fireEvent.click(model);
      expect(model.getAttribute("aria-pressed")).toBe("true");
    }
  }
  expect((screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement).disabled).toBe(true);
});

test("existing command and document toolbars use the matching size standards", () => {
  render(<FloatingToolbarDemo />);
  expect(screen.getByRole("button", { name: "Line" }).getAttribute("data-size")).toBe("large");
  expect(screen.getByRole("button", { name: "Object selection" }).getAttribute("data-size")).toBe("small");
  expect(screen.getByRole("button", { name: "Automatic evaluation" }).getAttribute("data-size")).toBe("small");
});


test("rounded is the primary standard and its selection remains toggleable", () => {
  const { container } = render(<IconButtonSpecimen />);
  const standard = within(screen.getByRole("group", { name: "Standard icon buttons" }));
  const model = standard.getByRole("button", { name: "Standard Model" });
  expect(model.getAttribute("data-appearance")).toBe("rounded");
  expect(model.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(model);
  expect(model.getAttribute("aria-pressed")).toBe("false");
  for (const state of container.querySelectorAll("[data-element-state] .aui-icon-button")) {
    expect(state.getAttribute("data-appearance")).toBe("rounded");
  }
  expect(screen.queryByText("Plain", { selector: "dt" })).toBeNull();
  expect(container.querySelector('[data-appearance="default"], [data-appearance="plain"]')).toBeNull();
});

test("retired default and plain inputs resolve to Rounded while approved treatments remain explicit", () => {
  const { rerender } = render(<IconButton label="Legacy" appearance="default"><AetherIcon name="save" /></IconButton>);
  expect(screen.getByRole("button", { name: "Legacy" }).getAttribute("data-appearance")).toBe("rounded");
  rerender(<IconButton label="Legacy" appearance="plain" aria-pressed><AetherIcon name="save" /></IconButton>);
  expect(screen.getByRole("button", { name: "Legacy" }).getAttribute("data-appearance")).toBe("rounded");
  rerender(<IconButton label="Glyph" appearance="glyph"><AetherIcon name="save" /></IconButton>);
  expect(screen.getByRole("button", { name: "Glyph" }).getAttribute("data-appearance")).toBe("glyph");
});

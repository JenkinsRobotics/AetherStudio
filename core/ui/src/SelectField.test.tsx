import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { SelectField } from "./SelectField";

test("renders native options and reports selection changes", () => {
  const onChange = vi.fn();
  render(
    <SelectField
      aria-label="Units"
      defaultValue="mm"
      options={[
        { value: "mm", label: "Millimeters" },
        { value: "in", label: "Inches" },
      ]}
      onChange={onChange}
    />,
  );
  const select = screen.getByRole("combobox", { name: "Units" }) as HTMLSelectElement;
  fireEvent.change(select, { target: { value: "in" } });
  expect(select.value).toBe("in");
  expect(onChange).toHaveBeenCalledTimes(1);
});

test("exposes placeholder, disabled options, and invalid state", () => {
  render(
    <SelectField
      aria-label="Format"
      placeholder="Choose format"
      invalid
      options={[{ value: "legacy", label: "Legacy", disabled: true }]}
    />,
  );
  const select = screen.getByRole("combobox", { name: "Format" });
  expect(select.getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByRole("option", { name: "Legacy" })).toHaveProperty("disabled", true);
});

/**
 * Jonathan, 2026-10-04, on the Comments filters: "the icon is behind the text."
 * Measured, the left glyph actually cleared the value by 4px; the defect was
 * 3px of right padding against the platform's own dropdown arrow, which needs
 * about twenty — so the value collided with the arrow. The field owns both the
 * glyph and the padding now, which is why no panel should position either.
 */
test("a select with an icon reserves the room for it in the field itself", () => {
  const { container } = render(
    <SelectField aria-label="Comments filter" icon={<span data-testid="glyph" />}
      options={[{ value: "all", label: "All" }]} />,
  );
  const wrap = container.querySelector(".aui-select-field-wrap")!;
  // The marker the stylesheet keys its padding off. Without it the field looks
  // identical and the value sits under the glyph.
  expect(wrap.getAttribute("data-icon")).toBe("");
  expect(wrap.querySelector(".aui-select-field-icon [data-testid='glyph']")).toBeTruthy();
  // The glyph is decoration; the select keeps the accessible name.
  expect(wrap.querySelector(".aui-select-field-icon")!.getAttribute("aria-hidden")).toBe("true");
  expect(screen.getByLabelText("Comments filter").tagName).toBe("SELECT");
});

test("without an icon the field is unchanged", () => {
  const { container } = render(<SelectField aria-label="Plain" options={[{ value: "a", label: "A" }]} />);
  expect(container.querySelector(".aui-select-field-wrap")!.hasAttribute("data-icon")).toBe(false);
  expect(container.querySelector(".aui-select-field-icon")).toBeNull();
});

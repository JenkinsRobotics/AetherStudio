import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { DialogWindowSpecimens, PopoverWindowSpecimen, ProgressWindowSpecimen } from "../gallery/DialogPopoverSpecimens";
import { comparisonGroup, sectionID } from "../gallery/showcase";
import { readShowcaseLocation } from "../gallery/showcase/collections";

test("every existing dialog, popover and progress link opens the same comparison family", () => {
  for (const title of ["Dialogs + alerts", "Popovers", "Progress overlay"]) {
    const view = readShowcaseLocation(`#tab=windows&section=${sectionID(title)}`, []);
    expect(view.section).toBe(title);
    expect(comparisonGroup(view.tab, view.section, false)?.sections).toEqual(["Dialogs + alerts", "Popovers", "Progress overlay"]);
  }
});

test("all shared windows are visible immediately and remain available after sample actions", () => {
  render(<><DialogWindowSpecimens /><PopoverWindowSpecimen /><ProgressWindowSpecimen /></>);
  const dialog = within(screen.getByRole("dialog", { name: "New assembly" }));
  const alert = within(screen.getByRole("dialog", { name: "Discard changes?" }));
  const popover = within(screen.getByRole("dialog", { name: "Quick properties" }));
  expect(screen.getByRole("progressbar", { name: "Importing assembly" }).getAttribute("aria-valuenow")).toBe("48");
  for (const surface of screen.getAllByRole("dialog")) expect(surface.getAttribute("aria-modal")).toBe("false");
  fireEvent.change(dialog.getByRole("textbox", { name: "Assembly name" }), { target: { value: "Rover" } });
  fireEvent.click(dialog.getByRole("button", { name: "Create" }));
  expect(screen.getByText("Created Rover · preview")).toBeTruthy();
  fireEvent.click(alert.getByRole("button", { name: "Discard" }));
  fireEvent.click(popover.getByRole("button", { name: "Apply" }));
  expect(screen.getByText("Applied 12.5 mm · preview")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Run in background" }));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.getAllByRole("dialog")).toHaveLength(3);
  expect(screen.getByRole("progressbar")).toBeTruthy();
});

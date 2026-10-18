import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { HorizontalNavigationHeader } from "../gallery/HorizontalNavigationHeader";

afterEach(cleanup);

test("the header starts open, collapses to its A button, and restores the selected destination", () => {
  render(<HorizontalNavigationHeader/>);
  const toggle = screen.getByRole("button", { name: "Collapse navigation header" });
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  const content = document.getElementById(toggle.getAttribute("aria-controls")!)!;
  expect(content.hidden).toBe(false);
  expect(screen.getAllByRole("navigation").map(node => node.getAttribute("aria-label"))).toEqual(["Dashboard", "Editor", "Reports"]);
  expect(within(content).getAllByRole("button")).toHaveLength(11);
  fireEvent.click(screen.getByRole("button", { name: "Magic build" }));
  toggle.focus();
  fireEvent.click(toggle);
  expect(content.hidden).toBe(true);
  expect(screen.getAllByRole("button")).toHaveLength(1);
  expect(screen.queryByRole("navigation")).toBeNull();
  expect(document.activeElement).toBe(toggle);
  fireEvent.click(screen.getByRole("button", { name: "Expand navigation header" }));
  expect(screen.getByRole("button", { name: "Magic build" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("button", { name: "Settings" }).getAttribute("aria-current")).toBeNull();
});

test("collapsing also closes the profile and reopening does not reveal a stale overlay", () => {
  render(<HorizontalNavigationHeader/>);
  fireEvent.click(screen.getByRole("button", { name: "Your profile" }));
  expect(screen.getByRole("dialog", { name: "Header profile" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Collapse navigation header" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Expand navigation header" }));
  expect(screen.getByRole("button", { name: "Your profile" }).getAttribute("aria-expanded")).toBe("false");
});

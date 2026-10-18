import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ConceptHeaderBar } from "../gallery/ConceptHeaderBar";

afterEach(cleanup);

test("concept dropdown destinations and page search update the active parent without navigating away", () => {
  render(<ConceptHeaderBar/>);
  fireEvent.click(screen.getByRole("button", { name: "Futures" }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: "Positions" }));
  expect(screen.getByRole("button", { name: "Futures" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("status").textContent).toBe("Futures / Positions selected");
  fireEvent.click(screen.getByRole("button", { name: "Search pages" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Find a page" }), { target: { value: "market" } });
  const results = screen.getByRole("dialog", { name: "Search pages" });
  fireEvent.click(results.querySelector("button")!);
  expect(screen.getByRole("button", { name: "Markets" }).getAttribute("aria-current")).toBe("page");
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("concept utilities retain their settings and never change the gallery theme", () => {
  const before = document.documentElement.className;
  const { container } = render(<ConceptHeaderBar/>);
  fireEvent.click(screen.getByRole("button", { name: "Use light appearance" }));
  expect(container.querySelector(".concept-header-theme--light")).not.toBeNull();
  expect(document.documentElement.className).toBe(before);
  fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
  fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
  expect(screen.getByText("You’re all caught up.")).toBeTruthy();
  expect(container.querySelector(".concept-header-unread")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Header settings" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Compact header" }));
  expect(container.querySelector(".concept-header-frame")?.getAttribute("data-compact")).toBe("false");
});

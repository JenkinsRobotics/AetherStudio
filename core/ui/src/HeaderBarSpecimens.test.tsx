import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { DocumentBar } from "./DocumentBar";
import { HeaderBarSpecimens } from "../gallery/HeaderBarSpecimens";
import { LEGACY_HEADER_PINS_KEY, readHeaderPins } from "./header-controls";

afterEach(() => { cleanup(); localStorage.clear(); });

test("app headers retain the host account mount unless the caller supplies account presentation", () => {
  const { container, rerender } = render(<DocumentBar windowChrome={false} application={{ id: "cad", name: "Aether CAD" }}/>);
  expect(container.querySelector('[data-aether-account]')).not.toBeNull();
  rerender(<DocumentBar windowChrome={false} application={{ id: "cad", name: "Aether CAD" }} account={<button>Sample account</button>}/>);
  expect(container.querySelector('[data-aether-account]')).toBeNull();
  expect(screen.getByRole("button", { name: "Sample account" })).toBeTruthy();
});

test("CAD has document controls and compact utilities with the official account-card hierarchy", () => {
  render(<HeaderBarSpecimens/>);
  const cad = within(screen.getByRole("article", { name: "Aether CAD header specimen" }));
  expect(cad.queryByRole("button", { name: /Workspace:/ })).toBeNull();
  fireEvent.click(cad.getByRole("button", { name: "Document version: Main" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Versions and history…" }));
  expect(screen.getByRole("dialog", { name: "Versions and history" })).toBeTruthy();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.getByRole("button", { name: "Workspace: Animate" })).toBeTruthy();
  fireEvent.click(cad.getByRole("button", { name: "Share" }));
  expect(screen.getByRole("textbox", { name: "Document link" })).toBeTruthy();
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.click(cad.getByRole("button", { name: "Aether Studio applications" }));
  expect(screen.getByRole("menuitem", { name: /Aether Map/ })).toBeTruthy();
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.click(cad.getByRole("button", { name: "Account: Alex Morgan" }));
  const account = within(screen.getByRole("dialog", { name: "Alex Morgan account" }));
  expect(account.getByText("Aether Studio")).toBeTruthy();
  expect(account.getByText("alex.morgan@example.com")).toBeTruthy();
  expect(account.getByRole("button", { name: "Sign out" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(account.getByRole("button", { name: "View account" }));
  expect(screen.getByRole("dialog", { name: "Sample account" })).toBeTruthy();
});


test("transparent header previews keep workspace and background controls local and expose search/link actions", () => {
  render(<HeaderBarSpecimens />);
  const preview = within(screen.getByRole("article", { name: "Transparent header specimen" }));
  fireEvent.click(preview.getByRole("button", { name: "Header workspace: Main" }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: "Review" }));
  expect(preview.getByRole("button", { name: "Header workspace: Review" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Document version: Main" })).toBeTruthy();
  fireEvent.click(preview.getByRole("radio", { name: "Light workspace" }));
  expect(preview.getByRole("radio", { name: "Light workspace" }).getAttribute("aria-checked")).toBe("true");
  fireEvent.click(preview.getByRole("button", { name: "Search header commands" }));
  fireEvent.click(screen.getByRole("option", { name: /Switch to Main workspace/ }));
  expect(preview.getByRole("button", { name: "Header workspace: Main" })).toBeTruthy();
  fireEvent.click(preview.getByRole("button", { name: "Share preview link" }));
  expect(screen.getByRole("textbox", { name: "Header review link" })).toBeTruthy();
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.click(preview.getByRole("button", { name: "Aether Studio applications" }));
  expect(screen.getByRole("menuitem", { name: /Aether Map/ })).toBeTruthy();
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.click(preview.getByRole("button", { name: "Account: Alex Morgan" }));
  const account = within(screen.getByRole("dialog", { name: "Alex Morgan account" }));
  expect(account.getByText("alex.morgan@example.com")).toBeTruthy();
  fireEvent.click(account.getByRole("button", { name: "View account" }));
  expect(screen.getByRole("dialog", { name: "Sample account" })).toBeTruthy();
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.click(preview.getByRole("button", { name: "Settings" }));
  const settings = within(screen.getByRole("dialog", { name: "Aether CAD settings" }));
  fireEvent.click(settings.getByRole("button", { name: "Header" }));
  fireEvent.click(settings.getByRole("checkbox", { name: "Show App tray in header" }));
  fireEvent.click(settings.getByRole("button", { name: "Close Aether CAD settings" }));
  expect(preview.queryByRole("button", { name: "Aether Studio applications" })).toBeNull();
  expect(within(screen.getByRole("article", { name: "Aether CAD header specimen" })).queryByRole("button", { name: "Aether Studio applications" })).toBeNull();
});

test("framed app headers expose document context and search with independent saved header pins", () => {
  const { unmount } = render(<HeaderBarSpecimens/>);
  const cad = within(screen.getByRole("article", { name: "Aether CAD header specimen" }));
  const animation = within(screen.getByRole("article", { name: "Aether Animation header specimen" }));
  expect(cad.getByText("Train Cart Wheel", { exact: true })).toBeTruthy();
  expect(animation.getByText("Character Study", { exact: true })).toBeTruthy();
  fireEvent.click(cad.getByRole("button", { name: "Search Aether CAD commands" }));
  fireEvent.click(screen.getByRole("option", { name: /Open comments/ }));
  expect(screen.getByRole("dialog", { name: "Comments" })).toBeTruthy();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(animation.getByRole("button", { name: "Workspace: Animate" })).toBeTruthy();
  fireEvent.click(cad.getByRole("button", { name: "Settings" }));
  const settings = within(screen.getByRole("dialog", { name: "Aether CAD settings" }));
  fireEvent.click(settings.getByRole("button", { name: "Header" }));
  fireEvent.click(settings.getByRole("checkbox", { name: "Show Notifications in header" }));
  fireEvent.click(settings.getByRole("button", { name: "Move Share earlier" }));
  fireEvent.click(settings.getByRole("button", { name: "Close Aether CAD settings" }));
  expect(cad.queryByRole("button", { name: "Notifications" })).toBeNull();
  expect(animation.getByRole("button", { name: "Notifications" })).toBeTruthy();
  expect(cad.queryByRole("button", { name: "Customize user bar" })).toBeNull();
  unmount(); render(<HeaderBarSpecimens/>);
  const restored = within(screen.getByRole("article", { name: "Aether CAD header specimen" }));
  expect(within(restored.getByRole("group", { name: "User bar" })).getAllByRole("button").map(button => button.getAttribute("aria-label"))).toEqual(["Appearance System", "Comments", "Share", "Aether Studio applications"]);
});

test("CAD introduces launcher and share once, preserving saved order and subsequent user choices", () => {
  localStorage.setItem(LEGACY_HEADER_PINS_KEY, JSON.stringify(["theme", "comments"]));
  const { unmount } = render(<HeaderBarSpecimens/>);
  expect(readHeaderPins("cad")).toEqual(["theme", "comments", "apps", "share"]);
  expect(readHeaderPins("map")).toEqual(["theme", "comments"]);
  const cad = within(screen.getByRole("article", { name: "Aether CAD header specimen" }));
  const buttons = cad.getAllByRole("button").map(button => button.getAttribute("aria-label"));
  expect(buttons.indexOf("Settings")).toBeLessThan(buttons.indexOf("Appearance System"));
  fireEvent.click(cad.getByRole("button", { name: "Settings" }));
  const settings = within(screen.getByRole("dialog", { name: "Aether CAD settings" }));
  fireEvent.click(settings.getByRole("button", { name: "Header" }));
  fireEvent.click(settings.getByRole("checkbox", { name: "Show App tray in header" }));
  unmount(); render(<HeaderBarSpecimens/>);
  expect(within(screen.getByRole("article", { name: "Aether CAD header specimen" })).queryByRole("button", { name: "Aether Studio applications" })).toBeNull();
});

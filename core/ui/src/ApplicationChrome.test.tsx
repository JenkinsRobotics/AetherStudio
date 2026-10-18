import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ApplicationIdentity } from "./ApplicationChrome";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("the shared header makes no host request without an injected catalog", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  render(<ApplicationIdentity id="custom" name="Independent application" />);
  fireEvent.click(screen.getByRole("button", { name: "Aether Studio applications" }));
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  expect(screen.getByRole("link", { name: "Aether Studio" }).getAttribute("href")).toBe("/");
});

test("catalog updates and explicit empty catalogs are owned by the caller", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const { rerender } = render(<ApplicationIdentity id="cad" name="Aether CAD" apps={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Aether Studio applications" }));
  rerender(<ApplicationIdentity id="cad" name="Aether CAD" apps={[{ id: "map", name: "Aether Map", url: "/map/" }]} />);
  expect(screen.getByRole("menuitem", { name: "Aether Map" }).getAttribute("href")).toBe("/map/");
  rerender(<ApplicationIdentity id="cad" name="Aether CAD" apps={[]} />);
  expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  expect(fetch).not.toHaveBeenCalled();
});

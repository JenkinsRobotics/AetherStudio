import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { AppLauncher, type LaunchableApp } from "./AppLauncher";

const apps: LaunchableApp[] = [
  { id: "cad", name: "Aether CAD", description: "Design parts", url: "/cad/" },
  { id: "map", name: "Aether Map", description: "Projection mapping", url: "/map/" },
  { id: "sketch", name: "Aether Sketch", url: "/sketch/", comingSoon: true },
];

test("the launcher opens a menu of the apps it is given, marking the current one", () => {
  render(<AppLauncher apps={apps} currentID="map" />);
  const button = screen.getByRole("button", { name: "Aether Studio applications" });
  expect(button.getAttribute("aria-expanded")).toBe("false");

  fireEvent.click(button);
  expect(button.getAttribute("aria-expanded")).toBe("true");

  const cad = screen.getByRole("menuitem", { name: /Aether CAD/ });
  expect(cad.getAttribute("href")).toBe("/cad/");
  expect(cad.getAttribute("aria-current")).toBeNull();
  expect(screen.getByRole("menuitem", { name: /Aether Map/ }).getAttribute("aria-current")).toBe("page");
});

test("an app that is not built yet is listed and described, but not openable", () => {
  render(<AppLauncher apps={apps} />);
  fireEvent.click(screen.getByRole("button", { name: /applications/ }));

  const sketch = screen.getByRole("menuitem", { name: /Aether Sketch/ });
  expect(sketch.tagName).toBe("SPAN");
  expect(sketch.getAttribute("aria-disabled")).toBe("true");
  expect(screen.getByText("Coming soon")).toBeTruthy();
});

test("it offers the suite home above the applications", () => {
  render(<AppLauncher apps={apps} homeName="Aether Studio" homeUrl="/" />);
  fireEvent.click(screen.getByRole("button", { name: /applications/ }));
  const home = screen.getByText("Aether Studio").closest("a")!;
  expect(home.getAttribute("href")).toBe("/");
});

test("it renders nothing to choose when no app is available, rather than failing", () => {
  render(<AppLauncher apps={[]} />);
  fireEvent.click(screen.getByRole("button", { name: /applications/ }));
  expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  // The suite home is still a way out.
  expect(screen.getByText("Aether Studio")).toBeTruthy();
});

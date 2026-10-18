import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { MouseControlDiagram, Range } from "./widgets";

afterEach(cleanup);

test("mouse legend marks the right button as Orbit when the profile orbits with it", () => {
  render(<MouseControlDiagram profile="Onshape" orbit="Right-drag" pan="Middle-drag" zoom="Scroll" special="Shift-drag" />);
  const legend = screen.getByRole("img", { name: "Mouse mapping for Onshape" });
  expect(legend.querySelector('[data-button="R"]')?.getAttribute("data-orbit")).toBe("true");
  expect(legend.querySelector('[data-button="L"]')?.getAttribute("data-orbit")).toBe("false");
  expect(legend.textContent).not.toContain("Menu");
});

test("mouse legend falls back to Menu on the right button otherwise", () => {
  render(<MouseControlDiagram profile="Trackpad" orbit="Left-drag" pan="Two-finger drag" zoom="Pinch" special="Option-drag" />);
  expect(screen.getByRole("img", { name: "Mouse mapping for Trackpad" }).textContent).toContain("Menu");
});

test("gradient range paints the whole track with the stops", () => {
  render(<Range ariaLabel="Hue" value={0.5} onChange={() => {}} gradient={["#f00", "#0f0", "#00f"]} />);
  const slider = screen.getByRole("slider", { name: "Hue" });
  expect(slider.className).toContain("aui-kit-range-gradient");
  expect(slider.style.getPropertyValue("--gradient")).toBe("linear-gradient(to right, #f00, #0f0, #00f)");
});

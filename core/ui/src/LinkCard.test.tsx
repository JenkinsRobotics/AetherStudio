import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { LinkCard, LinkCardGrid } from "./LinkCard";

afterEach(cleanup);
test("a link card is a link with title, description and action; external opens a new tab", () => {
  render(<LinkCardGrid ariaLabel="Demos"><LinkCard title="Aether CAD" description="Ribbon workspace" action="Open demo in new tab" href="?demo=cad" external icon={<span />} /></LinkCardGrid>);
  const link = screen.getByRole("link", { name: /Aether CAD/ });
  expect(link.getAttribute("href")).toBe("?demo=cad");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.textContent).toContain("Ribbon workspace");
  expect(link.textContent).toContain("Open demo in new tab");
});
test("without href it is a button", () => {
  let opened = 0;
  render(<LinkCard title="Aether Map" action="Open showcase" onSelect={() => opened++} />);
  fireEvent.click(screen.getByRole("button", { name: /Aether Map/ }));
  expect(opened).toBe(1);
});

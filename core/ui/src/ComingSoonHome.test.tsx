import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ComingSoonHome } from "./ComingSoonHome";

afterEach(() => { cleanup(); localStorage.clear(); });

const home = (id: string) => <ComingSoonHome id={id} name={id} description="New workspace" icon={<span />} artwork={<span />} homeUrl={`/${id}/`} suiteUrl="/" suiteName="Suite" />;

test("product and suite navigation use the caller's routes, with a host account slot", () => {
  const { container } = render(home("drawing"));
  expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/drawing/");
  expect(screen.getByRole("link", { name: "Suite" }).getAttribute("href")).toBe("/");
  expect(container.querySelector("[data-aether-account]")).not.toBeNull();
});

test("collapsing one product's home does not collapse another product", () => {
  const first = render(home("drawing"));
  fireEvent.click(screen.getByLabelText("Collapse drawing sidebar"));
  first.unmount();
  const second = render(home("paths"));
  expect(screen.getByLabelText("Collapse paths sidebar")).not.toBeNull();
  second.unmount();
  render(home("drawing"));
  expect(screen.getByLabelText("Expand drawing sidebar")).not.toBeNull();
});

test("sidebar navigation owns the identity and bottom account without a header", () => {
  const { container } = render(<ComingSoonHome navigation="sidebar" id="vector" name="Aether Vector" description="Paths" icon={<span />} artwork={<span />} homeUrl="/vector/" suiteUrl="/" suiteName="Aether Studio" />);
  expect(container.querySelector(".aui-coming-top")).toBeNull();
  const sidebar = screen.getByRole("complementary", { name: "Aether Vector sidebar" });
  expect(sidebar.contains(screen.getByRole("link", { name: "Aether Vector home" }))).toBe(true);
  expect(sidebar.querySelector('.aui-sidebar-footer [data-aether-account-layout="sidebar"]')).not.toBeNull();
  fireEvent.click(screen.getByLabelText("Collapse Aether Vector sidebar"));
  expect(sidebar.classList.contains("aui-sidebar--collapsed")).toBe(true);
  expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/vector/");
  fireEvent.click(screen.getByLabelText("Expand Aether Vector sidebar"));
  expect(sidebar.classList.contains("aui-sidebar--collapsed")).toBe(false);
});

import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { DocumentBar } from "./DocumentBar";

test("provides shared window-centered chrome and a native drag region", () => {
  const { container } = render(
    <DocumentBar
      className="product-header"
      leading={<button type="button">Home</button>}
      center={<span>Stages</span>}
      trailing={<button type="button">Help</button>}
    />,
  );

  const bar = container.querySelector("header");
  expect(bar?.classList.contains("product-header")).toBe(true);
  expect(bar?.getAttribute("data-aether-window-drag-region")).toBe("true");
  expect(screen.getByText("Stages").parentElement?.classList.contains("aui-document-bar-center")).toBe(true);
});

test("the app name leads the header and the app launcher sits with the right-hand controls", () => {
  const { container } = render(<DocumentBar application={{ id: "cad", name: "Aether CAD", apps: [] }} leading={<span>Part 1</span>} center={<span>Design</span>} />);
  const [left, right] = [container.querySelector(".aui-document-bar-cluster")!, container.querySelector(".aui-document-bar-cluster--trailing")!];
  expect(left.querySelector('a[aria-label="Aether CAD home"] .aui-app-wordmark')?.getAttribute("data-app")).toBe("cad");
  expect(left.querySelector(".aui-app-launcher-button")).toBeNull();
  expect(right.querySelector(".aui-app-launcher-button")).not.toBeNull();
  expect(container.querySelector(".aui-document-bar-center")?.textContent).toBe("Design");
});

test("the identity can be the icon alone, a home button", () => {
  const { container } = render(<DocumentBar application={{ id: "cad", name: "Aether CAD", apps: [], showName: false }} />);
  expect(container.querySelector(".aui-application-identity strong")).toBeNull();
  expect(container.querySelector('.aui-application-identity a[aria-label="Aether CAD home"]')).not.toBeNull();
});

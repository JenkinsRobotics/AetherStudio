import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { FilePreview, canPreview, previewKind } from "./FilePreview";

/**
 * Preview before opening (Jonathan, 2026-10-04). The browser already renders
 * these formats; the job here is handing each to the element that knows how,
 * and saying so plainly when there isn't one.
 */

test("knows what the browser can show, and what it cannot", () => {
  expect(previewKind("hero.PNG")).toBe("image");
  expect(previewKind("spec.pdf")).toBe("pdf");
  expect(previewKind("clip.mp4")).toBe("video");
  expect(previewKind("notes.md")).toBe("text");
  expect(previewKind("bracket.acpart")).toBe("none");
  expect(canPreview("bracket.acpart")).toBe(false);
  expect(canPreview("photo.jpeg")).toBe(true);
});

test("an image renders as an image, named for assistive tech", () => {
  render(<FilePreview name="wall.png" url="/api/drive/download?id=7" onClose={() => {}} />);
  const image = screen.getByAltText("wall.png") as HTMLImageElement;
  expect(image.getAttribute("src")).toBe("/api/drive/download?id=7");
});

test("a PDF renders in a frame rather than being downloaded", () => {
  render(<FilePreview name="spec.pdf" url="/d/8" onClose={() => {}} />);
  expect(screen.getByTitle("Preview of spec.pdf").tagName).toBe("IFRAME");
});

test("a format with no preview says so instead of showing an empty box", () => {
  render(<FilePreview name="bracket.acpart" url="/d/9" onClose={() => {}} />);
  expect(screen.getByText(/No preview for this kind of file/)).toBeTruthy();
});

test("Escape closes, and the arrows step only when there is somewhere to step", () => {
  const onClose = vi.fn(), onNext = vi.fn();
  const { rerender } = render(<FilePreview name="a.png" url="/d/1" onClose={onClose} />);
  // No neighbours supplied, so the arrows must not be offered at all.
  expect(screen.queryByLabelText("Next file")).toBeNull();
  fireEvent.keyDown(document, { key: "ArrowRight" });
  expect(onNext).not.toHaveBeenCalled();

  rerender(<FilePreview name="a.png" url="/d/1" onClose={onClose} onNext={onNext} />);
  fireEvent.keyDown(document, { key: "ArrowRight" });
  expect(onNext).toHaveBeenCalled();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalled();
});

test("clicking the backdrop closes; clicking the preview itself does not", () => {
  const onClose = vi.fn();
  const { container } = render(<FilePreview name="a.png" url="/d/1" onClose={onClose} />);
  fireEvent.click(container.querySelector(".aui-file-preview")!);
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(container.querySelector(".aui-file-preview-scrim")!);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("Open is offered only when the caller can open the file", () => {
  const { rerender } = render(<FilePreview name="a.png" url="/d/1" onClose={() => {}} />);
  expect(screen.queryByRole("button", { name: "Open" })).toBeNull();
  rerender(<FilePreview name="a.png" url="/d/1" onClose={() => {}} onOpen={() => {}} />);
  expect(screen.getByRole("button", { name: "Open" })).toBeTruthy();
});

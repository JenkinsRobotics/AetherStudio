import { fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { expect, test, vi } from "vitest";
import { Popover } from "./Popover";

function PopoverHarness({ onClose = () => {} }: { onClose?: () => void }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button ref={anchorRef} onClick={() => setOpen(true)}>Open</button>
      <Popover
        open={open}
        anchor={anchorRef.current}
        ariaLabel="Properties"
        focus="first"
        onClose={() => {
          onClose();
          setOpen(false);
        }}
      >
        <button>Apply</button>
      </Popover>
    </>
  );
}

test("inline popovers render without an anchor or portal and leave page focus and dismissal alone", () => {
  const close = vi.fn();
  const { rerender, container } = render(<button>Outside</button>);
  const outside = screen.getByText("Outside");
  outside.focus();
  rerender(<><button>Outside</button><Popover inline open anchor={null} focus="first" ariaLabel="Preview" onClose={close}><input aria-label="Value" /></Popover></>);
  const surface = screen.getByRole("dialog", { name: "Preview" });
  expect(container.contains(surface)).toBe(true);
  expect(surface.classList.contains("aui-popover--inline")).toBe(true);
  expect(surface.getAttribute("style")).toBeNull();
  expect(document.activeElement).toBe(outside);
  fireEvent.pointerDown(outside);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(close).not.toHaveBeenCalled();
});

test("renders only while open and focuses the first control", () => {
  render(<PopoverHarness />);
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByText("Open"));
  expect(screen.getByRole("dialog", { name: "Properties" })).not.toBeNull();
  expect(document.activeElement).toBe(screen.getByText("Apply"));
});

test("inside presses stay open; outside press and Escape close", () => {
  const onClose = vi.fn();
  render(<PopoverHarness onClose={onClose} />);
  fireEvent.click(screen.getByText("Open"));
  fireEvent.pointerDown(screen.getByText("Apply"));
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.pointerDown(document.body);
  expect(onClose).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByText("Open"));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(2);
});

test("returns focus to the opener on close", () => {
  render(<PopoverHarness />);
  const opener = screen.getByText("Open");
  opener.focus();
  fireEvent.click(opener);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(document.activeElement).toBe(opener);
});

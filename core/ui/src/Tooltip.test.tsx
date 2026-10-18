import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Tooltip } from "./Tooltip";

afterEach(() => vi.useRealTimers());

test("pointer help respects its delay and leaves cleanly", () => {
  vi.useFakeTimers();
  render(<Tooltip content="Measure distance" delayMilliseconds={400}><button>Measure</button></Tooltip>);
  const button = screen.getByRole("button", { name: "Measure" });
  fireEvent.pointerEnter(button.parentElement!);
  act(() => vi.advanceTimersByTime(399));
  expect(screen.queryByRole("tooltip")).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("tooltip").textContent).toContain("Measure distance");
  fireEvent.pointerLeave(button.parentElement!);
  expect(screen.queryByRole("tooltip")).toBeNull();
});

test("focus reveals immediately with shortcut and disabled explanation", () => {
  render(
    <Tooltip content="Delete selection" shortcut="⌫" disabledReason="The object is locked.">
      <button>Delete</button>
    </Tooltip>,
  );
  const button = screen.getByRole("button", { name: "Delete" });
  fireEvent.focus(button);
  const tooltip = screen.getByRole("tooltip");
  expect(tooltip.textContent).toContain("⌫");
  expect(tooltip.textContent).toContain("The object is locked.");
  expect(button.getAttribute("aria-describedby")).toBe(tooltip.id);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("tooltip")).toBeNull();
});

test("new pointer help replaces another focused tooltip",()=>{
 vi.useFakeTimers();
 render(<><Tooltip content="First help"><button>First</button></Tooltip><Tooltip content="Second help"><button>Second</button></Tooltip></>);
 fireEvent.focus(screen.getByRole('button',{name:'First'}));
 fireEvent.pointerEnter(screen.getByRole('button',{name:'Second'}).parentElement!);
 act(()=>vi.advanceTimersByTime(500));
 expect(screen.getAllByRole('tooltip')).toHaveLength(1);
 expect(screen.getByRole('tooltip').textContent).toBe('Second help');
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { TreePanelSplit } from "./TreePanelSplit";
import { TreePanel } from "./TreePanel";

test("resize retains collection state, bounds both panes, persists and resets", () => {
  localStorage.setItem("split-test", "0.6");
  const { container, unmount } = render(<TreePanelSplit storageKey="split-test" primaryLabel="Features" secondaryLabel="Parts"
    primary={<input aria-label="Filter features" defaultValue="sketch" />} secondary={<div>Part 1</div>} />);
  const split = container.firstElementChild as HTMLElement;
  const handle = screen.getByRole("separator", { name: "Resize Features and Parts" });
  expect(split.style.gridTemplateRows).toContain("0.6fr");
  fireEvent.keyDown(handle, { key: "ArrowDown", shiftKey: true });
  expect(Number(localStorage.getItem("split-test"))).toBeGreaterThan(0.6);
  expect((screen.getByLabelText("Filter features") as HTMLInputElement).value).toBe("sketch");
  for (let i = 0; i < 20; i++) fireEvent.keyDown(handle, { key: "ArrowDown", shiftKey: true });
  expect(localStorage.getItem("split-test")).toBe("0.8");
  fireEvent.doubleClick(handle);
  expect(localStorage.getItem("split-test")).toBe("0.65");
  unmount();
});

test("separate trees keep header commands and body context actions connected", () => {
  const folder = vi.fn(), command = vi.fn();
  render(<TreePanelSplit primaryLabel="Features" secondaryLabel="Bodies" primary={<TreePanel title="Features" ariaLabel="Feature tree"
    nodes={[{id:"f",label:"Sketch 1"}]} selectedIDs={new Set()} onSelect={() => {}}
    headerControls={[{id:"folder",label:"New feature folder",icon:"+",onClick:folder}]} />}
    secondary={<TreePanel ariaLabel="Bodies tree" title="Bodies (1)" showFilter={false} showFooter={false}
      nodes={[{id:"b",label:"Body 1"}]} selectedIDs={new Set(["b"])} onSelect={() => {}}
      menuItems={() => [{id:"hide",label:"Hide body"}]} onCommand={command} />} />);
  expect(within(screen.getByRole("region", { name:"Features" })).queryByText("Body 1")).toBeNull();
  fireEvent.click(screen.getByRole("button", {name:"New feature folder"}));
  expect(folder).toHaveBeenCalledOnce();
  fireEvent.contextMenu(screen.getByText("Body 1"));
  fireEvent.click(screen.getByRole("menuitem", {name:"Hide body"}));
  expect(command).toHaveBeenCalledWith("b","hide");
});

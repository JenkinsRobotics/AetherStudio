import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { RibbonWorkspaceShell } from "./RibbonWorkspaceShell";
import { ViewportCanvas } from "./ViewportCanvas";
import type { LayoutPreset } from "./WorkspaceShell";

test("header, ribbon, and bottom regions preserve one viewport across workspace and layout changes", () => {
  const teardown = vi.fn(); const onMount = vi.fn(() => teardown);
  const example = (preset: LayoutPreset, workspaceID: string) => (
    <RibbonWorkspaceShell preset={preset} documentBar={{ leading: <strong>Document name</strong>, trailing: "Account" }}
      ribbon={{ workspaceID, workspaces: [{ id: "design", label: "Design" }, { id: "show", label: "Show" }],
        onWorkspaceSelect: () => {}, tabs: [{ id: "home", label: "Home", groups: [] }], activeTabID: "home", onTabSelect: () => {}, onCommand: () => {} }}
      bottom={<div>Timeline</div>} statusBar={<div>Ready</div>}>
      <ViewportCanvas onMount={onMount} />
    </RibbonWorkspaceShell>
  );
  const { container, rerender, unmount } = render(example("docked", "design"));
  const canvas = container.querySelector("canvas");
  expect(screen.getByText("Document name")).toBeTruthy();
  expect(screen.getByText("Timeline")).toBeTruthy();
  expect(screen.getByText("Ready")).toBeTruthy();
  for (const preset of ["floating", "canvas", "docked"] as const) {
    rerender(example(preset, "show"));
    expect(container.querySelector("canvas")).toBe(canvas);
  }
  expect(onMount).toHaveBeenCalledTimes(1);
  expect(teardown).not.toHaveBeenCalled();
  unmount(); expect(teardown).toHaveBeenCalledTimes(1);
});

test("panel drafts survive collapse and reopen in the unified card in the ribbon shell", () => {
  render(<RibbonWorkspaceShell preset="docked" documentBar={{ leading: "Document" }}
    ribbon={{ workspaceID: "design", workspaces: [{ id: "design", label: "Design" }], onWorkspaceSelect: () => {},
      tabs: [], activeTabID: "", onTabSelect: () => {}, onCommand: () => {} }}
    leftPanels={[{ id: "features", title: "Features", icon: <span />, content: <input aria-label="Feature draft" defaultValue="" /> }]}
    defaultOpenLeft={["features"]}>Viewport</RibbonWorkspaceShell>);
  const draft = screen.getByLabelText("Feature draft") as HTMLInputElement;
  fireEvent.change(draft, { target: { value: "Unsaved feature" } });
  expect(screen.queryByLabelText("Float Features")).toBeNull();
  fireEvent.click(screen.getByLabelText("Features"));
  fireEvent.click(screen.getByLabelText("Features"));
  expect(screen.getByLabelText("Feature draft")).toBe(draft);
  expect(draft.value).toBe("Unsaved feature");
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

afterEach(cleanup);

const rooms = [
  { id: "mapping", label: "Mapping" },
  { id: "sequence", label: "Sequence" },
];

describe("WorkspaceSwitcher", () => {
  it("names the room you are in, so the button says what it is showing", () => {
    render(<WorkspaceSwitcher workspaces={rooms} workspaceID="mapping" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "Workspace: Mapping" })).toBeTruthy();
    expect(screen.getByText("Mapping")).toBeTruthy();
  });

  it("names the control and its value, because an app may also have a workspace window menu", () => {
    // Two controls called "Workspace" are ambiguous to anyone reading by label.
    render(<WorkspaceSwitcher workspaces={rooms} workspaceID="sequence" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "Workspace: Sequence" })).toBeTruthy();
  });

  it("marks the current room in the menu rather than only in the button", () => {
    render(<WorkspaceSwitcher workspaces={rooms} workspaceID="mapping" onSelect={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /^Workspace:/ }));
    expect(screen.getByRole("menuitemradio", { name: "Mapping" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("menuitemradio", { name: "Sequence" }).getAttribute("aria-checked")).toBe("false");
  });

  it("reports the room that was chosen", () => {
    const onSelect = vi.fn();
    render(<WorkspaceSwitcher workspaces={rooms} workspaceID="mapping" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /^Workspace:/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Sequence" }));
    expect(onSelect).toHaveBeenCalledWith("sequence");
  });

  it("accepts an explicit label when an application wants its own wording", () => {
    render(<WorkspaceSwitcher workspaces={rooms} workspaceID="mapping" onSelect={() => {}} label="Room" />);
    expect(screen.getByRole("button", { name: "Room" })).toBeTruthy();
  });

  it("carries its own class, so an application never needs override CSS", () => {
    render(<WorkspaceSwitcher workspaces={rooms} workspaceID="mapping" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /^Workspace:/ }).className).toContain("aui-workspace-switcher");
  });
});

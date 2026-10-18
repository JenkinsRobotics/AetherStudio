import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { WorkspaceQuickControls } from "./WorkspaceQuickControls";
import { StudioModeButton, WorkspaceWindowMenu } from "./StudioChrome";
import { HEADER_PINS_KEY, LEGACY_HEADER_PINS_KEY, readHeaderPins, setHeaderPins } from "./header-controls";

afterEach(() => { cleanup(); localStorage.clear(); });
function setup(onSettings?: () => void) {
  const change = vi.fn();
  const view = render(<WorkspaceQuickControls appID="map" appName="Aether Map" apps={[]} onSettings={onSettings} viewControls={<><StudioModeButton preset="floating" onChange={change}/><WorkspaceWindowMenu/></>}/>);
  return { change, ...view };
}
function headerSettings() {
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  const dialog = screen.getByRole("dialog", { name: "Aether Map settings" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Header" }));
  return within(dialog);
}

test("header customization lives in Settings and selecting icons never executes them", () => {
  const { change } = setup();
  expect(screen.queryByRole("button", { name: "Customize user bar" })).toBeNull();
  const settings = headerSettings();
  fireEvent.click(settings.getByRole("checkbox", { name: "Show Workspace mode in header" }));
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(settings.getByRole("button", { name: "Close Aether Map settings" }));
  fireEvent.click(within(screen.getByRole("group", { name: "User bar" })).getByRole("button", { name: "Studio mode: Floating" }));
  expect(change).toHaveBeenCalledWith("docked");
});

test("Settings saves selection and ordering while Settings stays reachable with an empty bar", () => {
  const { unmount } = setup();
  const settings = headerSettings();
  fireEvent.click(settings.getByRole("checkbox", { name: "Show App tray in header" }));
  fireEvent.click(settings.getByRole("button", { name: "Move Share earlier" }));
  expect(readHeaderPins("map")).toEqual(["share", "theme"]);
  fireEvent.click(settings.getByRole("checkbox", { name: "Show Share in header" }));
  fireEvent.click(settings.getByRole("checkbox", { name: "Show Light / dark mode in header" }));
  expect(JSON.parse(localStorage.getItem(HEADER_PINS_KEY)!).apps.map).toEqual([]);
  unmount(); setup();
  expect(within(screen.getByRole("group", { name: "User bar" })).queryAllByRole("button")).toHaveLength(0);
  expect(headerSettings().getByRole("checkbox", { name: "Show Share in header" }).getAttribute("aria-checked")).toBe("false");
});

test("legacy pins survive and edits affect only the chosen app", () => {
  localStorage.setItem(LEGACY_HEADER_PINS_KEY, JSON.stringify(["share", "settings", "theme", "cad-control-4"]));
  setup();
  expect(readHeaderPins("map")).toEqual(["share", "theme", "comments"]);
  const settings = headerSettings();
  fireEvent.click(settings.getByRole("checkbox", { name: "Show Share in header" }));
  expect(readHeaderPins("map")).toEqual(["theme", "comments"]);
  expect(readHeaderPins("cad")).toEqual(["share", "theme", "comments"]);
  expect(JSON.parse(localStorage.getItem(LEGACY_HEADER_PINS_KEY)!)).toContain("settings");
});

test("the permanent Settings action uses the application's callback", () => {
  const onSettings = vi.fn(); setup(onSettings);
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  expect(onSettings).toHaveBeenCalledOnce();
  expect(screen.queryByRole("dialog")).toBeNull();
});


test("header choices stay usable if device storage rejects a write", () => {
  setHeaderPins("storage-test", ["share"]);
  const reject = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
  try {
    setHeaderPins("storage-test", ["theme"]);
    expect(readHeaderPins("storage-test")).toEqual(["theme"]);
  } finally { reject.mockRestore(); }
  setHeaderPins("storage-test", ["apps"]);
  expect(readHeaderPins("storage-test")).toEqual(["apps"]);
});

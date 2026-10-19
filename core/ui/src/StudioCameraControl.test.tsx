import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { StudioCameraControl } from "./StudioCameraControl";
import { ViewportNavigationCube } from "./ViewportNavigationCube";

afterEach(cleanup);
const props = { orientation:[0,0,0,1] as const, onSelectView:vi.fn(), onFit:vi.fn(), onNudge:vi.fn(), onRoll:vi.fn() };

test("camera icon toggles a persistent cube and Escape collapses it", () => {
  render(<StudioCameraControl><ViewportNavigationCube {...props} appearance="studio"/></StudioCameraControl>);
  const toggle=screen.getByRole("button",{name:"Camera view"});
  expect(screen.queryByRole("img",{name:"Camera ViewCube"})).toBeNull();
  const surface=toggle.parentElement;
  fireEvent.click(toggle);
  const cube=screen.getByRole("img",{name:"Camera ViewCube"});
  expect(surface?.contains(cube)).toBe(true);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("img",{name:"Camera ViewCube"})).toBeTruthy();
  expect(screen.queryByRole("button",{name:/Nudge|Roll view/})).toBeNull();
  fireEvent.pointerDown(document.body);
  expect(screen.getByRole("group",{name:"Camera navigation"})).toBeTruthy();
  fireEvent.click(toggle);
  expect(screen.queryByRole("group",{name:"Camera navigation"})).toBeNull();
  expect(surface?.querySelector("[inert]")).toBeTruthy();
  fireEvent.click(toggle);
  expect(screen.getByRole("img",{name:"Camera ViewCube"})).toBe(cube);
  expect(toggle.parentElement).toBe(surface);
  fireEvent.keyDown(document,{key:"Escape"});
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
});

test("studio cube exposes camera settings and keeps Home and face navigation live", () => {
  const onSelectView=vi.fn(),onFit=vi.fn(),onMenu=vi.fn();
  render(<StudioCameraControl projection="Orthographic"><ViewportNavigationCube {...props} appearance="studio" onSelectView={onSelectView} onFit={onFit} homeMenuItems={[{id:"perspective",label:"Perspective",kind:"radio",checked:false},{id:"orthographic",label:"Orthographic",kind:"radio",checked:true}]} onHomeMenuSelect={onMenu}/></StudioCameraControl>);
  fireEvent.click(screen.getByRole("button",{name:"Camera view"}));
  fireEvent.click(screen.getByRole("button",{name:"Home view"}));
  expect(onFit).toHaveBeenCalledOnce();
  fireEvent.keyDown(screen.getByRole("button",{name:"Front view"}),{key:"Enter"});
  expect(onSelectView).toHaveBeenCalledWith("front");
  fireEvent.click(screen.getByRole("button",{name:"Camera settings"}));
  expect(screen.getByRole("menuitemradio",{name:"Orthographic"}).getAttribute("aria-checked")).toBe("true");
  const perspective=screen.getByRole("menuitemradio",{name:"Perspective"});
  fireEvent.pointerDown(perspective); fireEvent.click(perspective);
  expect(onMenu).toHaveBeenCalledWith("perspective");
  expect(screen.getByRole("group",{name:"Camera navigation"})).toBeTruthy();
});

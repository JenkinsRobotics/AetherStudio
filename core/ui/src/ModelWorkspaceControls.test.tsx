import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ModelWorkspaceControls, DEFAULT_RENDER_SETTINGS } from "../gallery/plasticity-studio/ModelWorkspaceControls";

afterEach(cleanup);

test("workspace controls cycle display and planes directly and reflect external plane changes", () => {
  function Harness() {
    const [settings, setSettings] = useState({ grid:true, wireframe:false, edges:false });
    const [plane, setPlane] = useState({ kind:"", revision:0 });
    return <><ModelWorkspaceControls workspace="design" onWorkspace={() => {}} settings={settings} onSettings={setSettings}
      plane={plane} onPlane={kind => setPlane(value => ({kind,revision:value.revision + 1}))} render={DEFAULT_RENDER_SETTINGS} onRender={() => {}} onMaterials={() => {}}/>
      <button onClick={() => setPlane({kind:"camera",revision:10})}>External camera plane</button>
      <output>{JSON.stringify({settings,plane})}</output></>;
  }
  render(<Harness/>);
  const tray = within(screen.getByRole("toolbar", { name:"Workspace controls" }));
  expect(tray.getAllByRole("button").filter(button => button.getAttribute("aria-haspopup") === "menu")).toHaveLength(1);
  for (const [label, icon] of [["Solid","cube-filled"],["Shaded with edges","cube"],["Wireframe","cube-transparent"],["Solid","cube-filled"]]) {
    const button = tray.getByRole("button", {name:`Display style: ${label}`});
    expect(button.querySelector("svg")?.getAttribute("data-icon")).toBe(icon);
    expect(button.getAttribute("data-appearance")).toBe("glyph");
    expect(button.hasAttribute("aria-haspopup")).toBe(false);
    fireEvent.click(button);
    expect(screen.queryByRole("menu")).toBeNull();
  }
  for (const label of ["Hidden","XY","YZ","XZ"]) fireEvent.click(tray.getByRole("button", {name:`Construction plane: ${label}`}));
  expect(tray.getByRole("button", {name:"Construction plane: Hidden"}).getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(screen.getByRole("button", {name:"External camera plane"}));
  const camera = tray.getByRole("button", {name:"Construction plane: Camera"});
  expect(camera.querySelector("svg")?.getAttribute("data-icon")).toBe("camera");
  expect(camera.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(camera);
  expect(JSON.parse(screen.getByRole("status").textContent ?? "{}").plane).toEqual({kind:"",revision:11});
});

test("render commands are icon actions and only the workspace selector has a menu", () => {
  const materials = vi.fn();
  render(<ModelWorkspaceControls workspace="render" onWorkspace={() => {}} settings={{grid:true,wireframe:false,edges:false}} onSettings={() => {}}
    plane={{kind:"",revision:0}} onPlane={() => {}} render={DEFAULT_RENDER_SETTINGS} onRender={() => {}} onMaterials={materials}/>);
  const tray = within(screen.getByRole("toolbar", {name:"Workspace controls"}));
  fireEvent.click(tray.getByRole("button", {name:"Materials"}));
  expect(materials).toHaveBeenCalledOnce();
  const environment = tray.getByRole("button", {name:"Environment"});
  expect(environment.textContent).toBe("");
  fireEvent.click(environment);
  expect(environment.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("dialog", {name:"Render environment"})).toBeTruthy();
  fireEvent.keyDown(document, {key:"Escape"});
  expect(environment.getAttribute("aria-pressed")).toBe("false");
});

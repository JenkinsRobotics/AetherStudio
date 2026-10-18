import { NativeLibrary } from "../gallery/showcase/DemoShowcase";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AnimationStudioDemo } from "../gallery/AnimationStudioDemo";
import { StudioMateInspector, MateEditorLabSpecimen } from "../gallery/StudioMateInspector";
import { AppearanceInspector, ConfigurationInspector, SequenceEditor } from "./ConceptWidgets";

beforeEach(() => localStorage.clear());
afterEach(() => {vi.useRealTimers();vi.restoreAllMocks();});

test("mate lab controls and the live editor share state in both directions",()=>{
  render(<MateEditorLabSpecimen/>);
  fireEvent.click(screen.getByRole("checkbox",{name:"Show Offset controls"}));
  expect(screen.queryByRole("textbox",{name:"Offset X"})).toBeNull();
  fireEvent.click(screen.getByRole("checkbox",{name:"Offset"}));
  expect((screen.getByRole("checkbox",{name:"Show Offset controls"}) as HTMLInputElement).checked).toBe(true);
  fireEvent.change(screen.getByRole("combobox",{name:"Mate Type"}),{target:{value:"ball"}});
  expect((screen.getByRole("combobox",{name:"Type"}) as HTMLSelectElement).value).toBe("ball");
  expect(screen.getByRole("textbox",{name:"Offset rotation"})).toBeTruthy();
});

test("Variants opens the distinct native board and supports family/search/zoom controls", () => {
  const {container}=render(<NativeLibrary/>);
  fireEvent.click(screen.getByRole("button",{name:"Variants"}));
  expect(container.querySelectorAll(".aui-specimen-card")).toHaveLength(26);
  fireEvent.change(screen.getByRole("combobox",{name:"Variant family"}),{target:{value:"inspectors"}});
  expect(container.querySelectorAll(".aui-specimen-card")).toHaveLength(4);
  fireEvent.change(screen.getByRole("searchbox",{name:"Search windows and states"}),{target:{value:"connectors"}});
  expect(container.querySelectorAll(".aui-specimen-card")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button",{name:"Increase specimen size"}));
  expect(screen.getByText("80%")).toBeTruthy();
});

test("the mate inspector retains all ten native kinds and exposes their distinct controls", () => {
  render(<StudioMateInspector/>);
  const type=screen.getByRole("combobox",{name:"Type"});
  expect(within(type).getAllByRole("option").map((option)=>option.textContent)).toEqual(["Fastened","Parallel","Slider","Revolute","Cylindrical","Pin Slot","Planar","Ball","Width","Tangent"]);
  fireEvent.change(type,{target:{value:"revolute"}});
  expect(screen.getByRole("textbox",{name:"Offset rotation"})).toBeTruthy();
  fireEvent.change(type,{target:{value:"width"}});
  expect(screen.queryByRole("textbox",{name:"Offset rotation"})).toBeNull();
  expect((screen.getByRole("checkbox",{name:"Limits"}) as HTMLInputElement).disabled).toBe(true);
});

test("configuration cancel restores its accepted checkpoint rather than zeroing transforms", () => {
  const change=vi.fn();
  render(<ConfigurationInspector kinds={[{id:"position",label:"Position",offset:true}]} value={{name:"Fixture",kind:"position",offset:true,limits:false,simulation:false,x:12,y:8,z:1,angle:0,min:0,max:10}} onChange={change}/>);
  fireEvent.click(screen.getByRole("button",{name:"Cancel configuration"}));
  expect(change).toHaveBeenLastCalledWith(expect.objectContaining({x:12,y:8,z:1}));
});

test("ribbon Loop changes the timeline state and Next Key seeks an actual key", () => {
  const {container}=render(<AnimationStudioDemo/>);
  fireEvent.click(screen.getByRole("tab",{name:"Animate"}));
  fireEvent.click(screen.getByRole("tab",{name:"Transport"}));
  const ribbon=within(container.querySelector<HTMLElement>(".animation-ribbon-surface")!);
  const timeline=within(container.querySelector<HTMLElement>(".aui-timeline")!);
  const loop=timeline.getByRole("button",{name:/Loop/});
  expect(loop.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(ribbon.getByRole("button",{name:"Loop"}));
  expect(loop.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(ribbon.getByRole("button",{name:"Next Key"}));
  expect(screen.getByLabelText("Timeline position").textContent).toContain("00:00:13");
});

test("Nodes playback advances and pause stops the shared performance playhead", () => {
  vi.useFakeTimers();
  const {container}=render(<AnimationStudioDemo/>);
  fireEvent.change(screen.getByRole("combobox",{name:"All Aether workspaces"}),{target:{value:"nodes"}});
  const head=container.querySelector<HTMLElement>(".animation-performance-playhead")!;
  const before=head.style.left;
  fireEvent.click(screen.getByRole("button",{name:"Play show"}));
  act(()=>vi.advanceTimersByTime(1000));
  expect(head.style.left).not.toBe(before);
  fireEvent.click(screen.getByRole("button",{name:"Pause show"}));
  const paused=head.style.left;
  act(()=>vi.advanceTimersByTime(1000));
  expect(head.style.left).toBe(paused);
});

test("settings and the toolbar share persisted density and shape preferences", () => {
  const {container}=render(<AnimationStudioDemo/>);
  fireEvent.click(screen.getByRole("button",{name:"Aether Animation Studio settings"}));
  const settings=screen.getByRole("dialog",{name:"Aether Animation Studio Settings"});
  fireEvent.click(within(settings).getByRole("button",{name:"UI"}));
  fireEvent.change(within(settings).getByRole("combobox",{name:"Tool density"}),{target:{value:"compact"}});
  fireEvent.change(within(settings).getByRole("combobox",{name:"Floating chrome"}),{target:{value:"rounded"}});
  expect(container.querySelector<HTMLElement>(".animation-ribbon-surface")?.dataset.density).toBe("compact");
  expect(container.querySelector<HTMLElement>(".animation-ribbon-surface")?.dataset.shape).toBe("rounded");
  expect(localStorage.getItem("aether.animation-studio.toolbar-density")).toBe("compact");
});

test("parts edits undo, redo, autosave, and restore after reopening the concept", () => {
  const app=render(<AnimationStudioDemo/>);
  fireEvent.click(screen.getByRole("button",{name:/^Import$/}));
  const dialog=screen.getByRole("dialog",{name:"Import 3D model"});
  fireEvent.change(within(dialog).getByRole("textbox",{name:"Source file"}),{target:{value:"fidelity-check.step"}});
  fireEvent.click(within(dialog).getByRole("button",{name:"Import"}));
  expect(within(screen.getByRole("grid",{name:"Character parts"})).getByText("fidelity-check")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Undo"}));
  expect(within(screen.getByRole("grid",{name:"Character parts"})).queryByText("fidelity-check")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Redo"}));
  app.unmount();
  render(<AnimationStudioDemo/>);
  expect(within(screen.getByRole("grid",{name:"Character parts"})).getByText("fidelity-check")).toBeTruthy();
});

test("appearance hex edits calculate RGB and tessellation is an actionable choice", () => {
  const changed=vi.fn();render(<AppearanceInspector onChange={changed}/>);
  fireEvent.change(screen.getByRole("textbox",{name:"Hex"}),{target:{value:"#ff8000"}});
  expect(screen.getByText("255 · 128 · 0")).toBeTruthy();
  fireEvent.click(screen.getByRole("radio",{name:"High"}));
  expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({color:"#ff8000",tessellation:"high"}));
});

test("Timeline Design B supports row/key editing and a real waypoint mode", () => {
  render(<SequenceEditor initialTracks={[]}/>);
  fireEvent.click(screen.getByRole("button",{name:"Add first track"}));
  fireEvent.click(screen.getByRole("button",{name:"Add Key"}));
  fireEvent.click(screen.getByRole("radio",{name:"Waypoint Lanes"}));
  const lanes=screen.getByLabelText("Waypoint lanes");
  fireEvent.click(within(lanes).getByRole("button",{name:"0.00s · 0.00"}));
  fireEvent.click(screen.getByRole("button",{name:"Delete Key"}));
  expect(within(lanes).queryByRole("button",{name:"0.00s · 0.00"})).toBeNull();
});

test("planned native asset tools remain disabled instead of pretending to run", () => {
  render(<AnimationStudioDemo/>);
  expect((screen.getByRole("button",{name:"Relink"}) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button",{name:"LED Layout"}) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button",{name:"3D Character"}) as HTMLButtonElement).disabled).toBe(false);
});

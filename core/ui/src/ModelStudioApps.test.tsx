import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ModelStudioAppDemo } from "../gallery/model-studio-apps/ModelStudioAppDemo";
import { conceptApps } from "../gallery/ConceptAppDirectory";
import { studies, type StudyApp } from "../gallery/model-studio-apps/studies";
beforeEach(()=>vi.stubGlobal("ResizeObserver",class { observe(){} disconnect(){} }));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
for(const app of ["sketch","map","io"] as StudyApp[])test(`${app} has an independent launch route and shared selection, editing and visibility`,()=>{
  const {container}=render(<ModelStudioAppDemo app={app}/>),study=studies[app];
  expect(conceptApps.find(value=>value.id===`${app}-studio`)?.url).toBe(`?demo=${app}-studio`);
  expect(screen.getByRole("main",{name:`${study.title} workspace`})).toBeTruthy();
  const tree=within(screen.getByRole("tree",{name:study.collection}));
  fireEvent.click(tree.getByRole("treeitem",{name:study.items[0].name}));
  const x=screen.getByRole("textbox",{name:"Position X"});fireEvent.input(x,{target:{value:"38"}});fireEvent.keyDown(x,{key:"Enter"});
  expect(container.querySelector(`[data-item="${study.items[0].id}"]`)?.getAttribute("transform")).toBe("translate(38 0)");
  fireEvent.click(screen.getByRole("checkbox",{name:"Visible"}));
  expect(container.querySelector(`[data-item="${study.items[0].id}"]`)).toBeNull();
  fireEvent.click(tree.getByRole("button",{name:`Show ${study.items[0].name}`}));
  expect(container.querySelector(`[data-item="${study.items[0].id}"]`)).not.toBeNull();
  expect(container.querySelector('[data-icon-missing]')).toBeNull();
});
test("Sketch adds an editable object and resets the sample",()=>{
  const {container}=render(<ModelStudioAppDemo app="sketch"/>);
  fireEvent.click(screen.getByRole("button",{name:"Add circle"}));
  expect(screen.getByRole("textbox",{name:"Object name"})).toHaveProperty("value","Circle 1");
  const width=screen.getByRole("textbox",{name:"Stroke width"});fireEvent.input(width,{target:{value:"4"}});fireEvent.keyDown(width,{key:"Enter"});
  expect(container.querySelector('[data-item="shape-1"] g')?.getAttribute("stroke-width")).toBe("4");
  fireEvent.click(screen.getByRole("button",{name:"Reset"}));expect(container.querySelector('[data-item="shape-1"]')).toBeNull();
});
test("Map playback and IO copper controls affect only their own previews",()=>{
  const view=render(<ModelStudioAppDemo app="map"/>);
  fireEvent.click(screen.getByRole("button",{name:"Play preview"}));expect(view.container.querySelector('.study-canvas')?.getAttribute('data-playing')).toBe('true');
  fireEvent.click(screen.getByRole("button",{name:"Pause preview"}));expect(view.container.querySelector('.study-canvas')?.getAttribute('data-playing')).toBe('false');
  cleanup();render(<ModelStudioAppDemo app="io"/>);
  fireEvent.click(screen.getByRole("button",{name:"Copper traces"}));expect(screen.getByTestId("copper-traces").getAttribute('opacity')).toBe('0');
});
test("document panels keep approved history and clearly identify the disconnected assistant",async()=>{
  render(<ModelStudioAppDemo app="sketch"/>);
  fireEvent.click(screen.getByRole("button",{name:"AI chat"}));
  expect(screen.getByText("No AI provider connected")).toBeTruthy();expect(screen.getByRole("button",{name:"Send"})).toHaveProperty("disabled",true);
  fireEvent.click(screen.getByRole("button",{name:"Revisions"}));expect(screen.getByText("Read-only example history")).toBeTruthy();expect(screen.queryByRole("button",{name:"Restore state"})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Comments"}));fireEvent.change(screen.getByRole("textbox",{name:"Comments text"}),{target:{value:"Use the lighter outline"}});await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Add"}));});expect(await screen.findByText("Use the lighter outline")).toBeTruthy();
});

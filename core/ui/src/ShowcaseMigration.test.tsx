import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ImportedSpecimens } from "../gallery/showcase/DemoShowcase";
import { SHOWCASE_TABS, legacyShowcaseLocation, sectionTab } from "../gallery/showcase";
import { MODE_DUPLICATES, SECTION, importedKitInventory, nativeTemplateSections, nativeVariantSections } from "../gallery/showcase/inventory";
import { nativeVariants } from "../gallery/showcase/NativeVariantCatalog";
import { AnimationMockupApp } from "../gallery/animation-mockup/AnimationMockupApp";
import { AtlasDemoApp } from "../gallery/atlas-demo/AtlasDemoApp";
import { AnimationStudioDemo } from "../gallery/AnimationStudioDemo";
import { KitToolbarVariants, TintedToolbarVariants } from "../gallery/Variants";
import { SuiteLauncher } from "../gallery/suite-apps";

const SECTIONS = SHOWCASE_TABS.flatMap((tab) => tab.sections);

test("toolbar review exposes the floating ribbon and all command states together", () => {
  const { container } = render(<><ImportedSpecimens section={SECTION.ribbons} /><ImportedSpecimens section={SECTION.toolRails} /></>);
  expect(container.querySelector('[data-native-template="floating-ribbon"]')).toBeTruthy();
  for (const id of ["commandToolbar", "selectionToolbar", "disabledToolbar", "verticalToolRail"]) {
    expect(container.querySelectorAll(`[data-state-variant="${id}"]`)).toHaveLength(1);
    expect(MODE_DUPLICATES[`variant:${id}`]).toBeUndefined();
  }
  const selected = container.querySelector<HTMLElement>('[data-state-variant="selectionToolbar"]')!;
  const rotate = within(selected).getByRole("button", { name: "Rotate" });
  fireEvent.click(rotate);
  expect(rotate.classList.contains("aui-ribbon-tool--active")).toBe(true);
  const disabled = container.querySelector<HTMLElement>('[data-state-variant="disabledToolbar"]')!;
  expect(within(disabled).getAllByRole("button").every(button => (button as HTMLButtonElement).disabled)).toBe(true);
});

test("floating and docked tinted ribbons are independently usable on the same review page", () => {
  const { container } = render(<TintedToolbarVariants />);
  expect(screen.getAllByRole("toolbar", { name: "Tools" })).toHaveLength(2);
  const docked = container.querySelector<HTMLElement>(".aui-kit-tool-ribbon-docked")!;
  const sketch = within(docked).getByRole("button", { name: "Sketch" });
  fireEvent.click(sketch);
  expect(sketch.getAttribute("data-active")).toBe("true");
  fireEvent.click(within(container.querySelector<HTMLElement>(".aui-kit-tool-ribbon")!).getByRole("button", { name: "Create" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Extrude" }));
  expect(sketch.getAttribute("data-active")).toBe("true");
  expect(screen.queryByRole("menuitem", { name: "Extrude" })).toBeNull();
});

beforeEach(()=>{
  localStorage.clear();
  vi.stubGlobal("ResizeObserver",class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

test("every native template, state variant and demo-kit specimen renders exactly once, flat, under a filed section",()=>{
  const specimens=new Map<string,string>(), templates=new Map<string,string>(), variants=new Map<string,string>();
  for(const section of SECTIONS){
    const {container,unmount}=render(<ImportedSpecimens section={section}/>);
    for(const node of container.querySelectorAll<HTMLElement>("[data-imported-specimen]")){
      const key=`${node.dataset.importedSource}:${node.dataset.importedSpecimen}`;
      expect(specimens.has(key),`${key} rendered twice (${specimens.get(key)} and ${section})`).toBe(false);
      specimens.set(key,section);
      // Flat: the specimen is the captioned variant itself, not a card inside a board.
      expect(node.classList.contains("gallery-variant")).toBe(true);
      expect(node.firstElementChild?.tagName).toBe("SMALL");
    }
    for(const node of container.querySelectorAll<HTMLElement>("[data-native-template]")){
      expect(templates.has(node.dataset.nativeTemplate!)).toBe(false); templates.set(node.dataset.nativeTemplate!,section);
    }
    for(const node of container.querySelectorAll<HTMLElement>("[data-state-variant]")){
      expect(variants.has(node.dataset.stateVariant!)).toBe(false); variants.set(node.dataset.stateVariant!,section);
    }
    // No nested libraries, boards, framed cards or per-box theme pickers anywhere
    // (the one SpecimenBoard shown *as a widget* is the exception, and is marked).
    expect(container.querySelector(".kit-specimen, .kit-grid, .imported-kit-library, .native-showcase-library, .animation-variant-board, .imported-theme-picker")).toBeNull();
    for(const card of container.querySelectorAll(".aui-specimen-card")) expect(card.closest("[data-widget-specimen]"),`${section}: a specimen card outside the board widget`).toBeTruthy();
    unmount();
  }
  // Codex's retained inventory (108 kit rows, four state rows merged into one each since): every row renders
  // once, or is a mode/data duplicate hidden in MODE_DUPLICATES with the instance that stays named.
  let expected=0, hidden=0;
  for(const entry of importedKitInventory){
    for(const label of entry.specimens){
      const key=`${entry.source}:${label}`;
      const hit=[...specimens.keys()].some((rendered)=>rendered===key || rendered.startsWith(`${key} ·`));
      if(MODE_DUPLICATES[key]){ expect(specimens.has(key),`${key} is hidden as a duplicate of ${MODE_DUPLICATES[key]} but still renders`).toBe(false); hidden++; }
      else expect(hit,`${entry.source}: ${entry.section} › ${label}`).toBe(true);
    }
    expected+=entry.specimens.length;
  }
  expect(specimens.size).toBe(expected-hidden);
  expect(expected).toBeGreaterThan(80);
  const hiddenTemplates=Object.keys(MODE_DUPLICATES).filter((key)=>key.startsWith("template:")).map((key)=>key.slice(9));
  const hiddenVariants=Object.keys(MODE_DUPLICATES).filter((key)=>key.startsWith("variant:")).map((key)=>key.slice(8));
  for(const id of hiddenTemplates) expect(nativeTemplateSections[id],`hidden template ${id} must still have a section`).toBeDefined();
  for(const id of hiddenVariants) expect(nativeVariantSections[id],`hidden variant ${id} must still have a section`).toBeDefined();
  expect(new Set(templates.keys())).toEqual(new Set(Object.keys(nativeTemplateSections).filter((id)=>!hiddenTemplates.includes(id))));
  expect(templates.size+hiddenTemplates.length).toBe(Object.keys(nativeTemplateSections).length);
  expect(new Set(variants.keys())).toEqual(new Set(nativeVariants.map((entry)=>entry.id).filter((id)=>!hiddenVariants.includes(id))));
  expect(variants.size+hiddenVariants.length).toBe(26);
  for(const key of Object.keys(MODE_DUPLICATES)) expect(/^(kit|atlas|template|variant):/.test(key),key).toBe(true);
  for(const section of [...Object.values(nativeTemplateSections),...Object.values(nativeVariantSections),...Object.values(SECTION)]) expect(sectionTab(section),section).toBeDefined();
},30000);

test("apps and icons hold no widgets; appearance lives in one widgets section",()=>{
  const apps=SHOWCASE_TABS.find((tab)=>tab.id==="apps")!;
  for(const section of apps.sections){
    const {container,unmount}=render(<ImportedSpecimens section={section}/>);
    expect(container.querySelector("[data-imported-specimen], [data-native-template], [data-state-variant]")).toBeNull();
    unmount();
  }
  const {container}=render(<ImportedSpecimens section={SECTION.appearance}/>);
  const labels=Array.from(container.querySelectorAll<HTMLElement>("[data-imported-specimen], [data-native-template], [data-state-variant]")).map((node)=>node.dataset.importedSpecimen ?? node.dataset.nativeTemplate ?? node.dataset.stateVariant);
  expect(labels).toEqual(expect.arrayContaining(["appearance-inspector","material-editor","visualization-panel","Material spheres","Visualization panel","Environment","Theme tiles","Material controls"]));
  expect(sectionTab(SECTION.appearance)).toBe("widgets");
});

test("imported controls stay interactive and the demo scope carries no palette of its own — the page theme is the only theme",()=>{
  const {container}=render(<ImportedSpecimens section={SECTION.toggles}/>);
  const atlasInputs=within(container.querySelector<HTMLElement>('[data-imported-specimen="Interactive input controls"]')!);
  fireEvent.change(atlasInputs.getByRole("slider",{name:"Roughness"}),{target:{value:"0.8"}});
  expect(atlasInputs.getByText("0.80")).toBeTruthy();
  expect(screen.queryByRole("combobox",{name:/specimen theme/i})).toBeNull();
  const scope=container.querySelector<HTMLElement>('[data-imported-source="atlas"]')!.closest<HTMLElement>("[data-aether-kit]")!;
  expect(scope.dataset.appearance).toBeUndefined();
  expect(scope.dataset.accent).toBeUndefined();
  expect(scope.getAttribute("style")).toBeNull();
});

test("demo application navigation no longer embeds a UI Dev or UI Kit workspace",()=>{
  for(const App of [AnimationMockupApp,AtlasDemoApp,AnimationStudioDemo]){
    const {unmount}=render(<App/>);
    expect(screen.queryByRole("tab",{name:/^UI (Dev|Kit)$/})).toBeNull();
    expect(screen.queryByRole("button",{name:/^UI (Dev|Kit)$/})).toBeNull();
    expect(screen.queryByRole("option",{name:/^UI (Dev|Kit)$/})).toBeNull();
    unmount();
  }
});

test("saved demo showcase links redirect to the shared library; authoring links stay in their app",()=>{
  for(const demo of ["animation-studio","animation-mockup","atlas-demo"]){
    expect(legacyShowcaseLocation(`?demo=${demo}&ws=uiKit`,"/ui/")).toBe("/ui/#tab=widgets");
    expect(legacyShowcaseLocation(`?demo=${demo}&ws=rig`,"/ui/")).toBeNull();
  }
});

test("the migrated Atlas settings menu stays inside its source theme scope",()=>{
  const {container}=render(<ImportedSpecimens section={SECTION.settings}/>);
  const scope=container.querySelector<HTMLElement>('[data-imported-source="atlas"]')!.closest<HTMLElement>("[data-aether-kit]")!;
  fireEvent.click(within(scope).getByRole("button",{name:"Theme"}));
  const menu=screen.getByRole("menu",{name:"Theme"});
  expect(menu.closest("[data-aether-overlay-host]")).toBeTruthy();
  expect(scope.contains(menu)).toBe(true);
  fireEvent.keyDown(menu,{key:"Escape"});
  expect(screen.queryByRole("menu",{name:"Theme"})).toBeNull();
});

test("the flat toolbar variants' density menu opens inside the demo theme scope, as in the app",()=>{
  const {container}=render(<KitToolbarVariants/>);
  fireEvent.click(screen.getAllByRole("button",{name:/toolbar settings/i})[0]);
  const menu=screen.getAllByRole("menu")[0];
  expect(menu.closest("[data-aether-kit]")).toBeTruthy();
  expect(container.contains(menu)).toBe(true);
});

test("the header waffle is the suite-wide Aether Studio launcher, not a demo switch",()=>{
  render(<SuiteLauncher currentID="ui"/>);
  fireEvent.click(screen.getByRole("button",{name:"Aether Studio applications"}));
  const names=screen.getAllByRole("menuitem").map((item)=>item.textContent ?? "");
  expect(names.some((name)=>name.includes("Aether CAD"))).toBe(true);
  expect(names.some((name)=>name.includes("Aether Map"))).toBe(true);
  expect(names.some((name)=>/Demo|UI Dev/.test(name))).toBe(false);
  expect(screen.getByRole("menuitem",{name:/Aether UI/}).getAttribute("aria-current")).toBe("page");
});

import { useState } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MaterialBrowser } from "./MaterialBrowser";
import { LayoutStyleControls } from "./LayoutStyleControls";
import { RelationEditor, type RelationEditorValue } from "./RelationEditor";
import { AnimationStudioDemo } from "../gallery/AnimationStudioDemo";
import { FieldsSpecimen } from "../gallery/showcase/UIDevSpecimens";
import { StudioDesignWorkspace, StudioDesignInspector, type StudioDesignState } from "../gallery/StudioAdditionalWorkspaces";
beforeEach(()=>localStorage.clear());

test("material and environment tabs expose distinct libraries and callbacks",()=>{
 const select=vi.fn(),environment=vi.fn();
 render(<MaterialBrowser materials={[{id:"abs",name:"ABS",category:"Plastic",color:"#d52c35",finish:"Glossy"}]} usedIDs={["abs"]} onSelect={select} environments={[{id:"transparent",name:"Transparent",color:"#fff",transparent:true}]} onEnvironmentSelect={environment}/>);
 expect(screen.getByText("Used Materials (1)")).toBeTruthy();
 fireEvent.change(screen.getByLabelText("Search materials"),{target:{value:"glossy"}});
 fireEvent.click(screen.getByRole("button",{name:"Glossy ABS"}));expect(select).toHaveBeenCalledWith("abs");
 fireEvent.click(screen.getByRole("radio",{name:"Environment"}));
 expect(screen.queryByLabelText("Search materials")).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Transparent"}));expect(environment).toHaveBeenCalledWith("transparent");
});

test("layout lab updates its live preview and field units convert values",()=>{
 const first=render(<LayoutStyleControls/>);
 fireEvent.click(screen.getByRole("radio",{name:"Column"}));expect(screen.getByLabelText("Layout preview").style.flexDirection).toBe("column");
 const gap=screen.getByLabelText("Gap");fireEvent.change(gap,{target:{value:"24"}});fireEvent.blur(gap);expect(screen.getByLabelText("Layout preview").style.gap).toBe("24px");
 fireEvent.click(screen.getByRole("checkbox",{name:"Clip content"}));expect(screen.getByLabelText("Layout preview").style.overflow).toBe("visible");first.unmount();
 render(<FieldsSpecimen/>);fireEvent.click(screen.getByRole("radio",{name:"Radians"}));expect(Number((screen.getByLabelText("Specimen angle") as HTMLInputElement).value)).toBeCloseTo(42*Math.PI/180);
});

test("relation editor keeps invalid numbers from being submitted",()=>{
 const apply=vi.fn();function Fixture(){const [value,setValue]=useState<RelationEditorValue>({kind:"gear",driver:"a",driven:"b",magnitude:2,reversed:false,offset:0});return <RelationEditor value={value} onChange={setValue} kinds={[{value:"gear",label:"Gear"}]} drivers={[{value:"a",label:"a"}]} driven={[{value:"b",label:"b"}]} ratioLabel="Ratio" offsetUnit="deg" onApply={apply} onCancel={()=>{}}/>;}
 render(<Fixture/>);fireEvent.click(screen.getByRole("button",{name:"Create relation"}));expect(apply).toHaveBeenCalledOnce();
 const ratio=screen.getByLabelText("Ratio");fireEvent.change(ratio,{target:{value:"0"}});fireEvent.blur(ratio);
 expect((screen.getByRole("button",{name:"Create relation"}) as HTMLButtonElement).disabled).toBe(true);
});

test("native hardware page adds, reverses, edits and removes local mappings",()=>{
 render(<AnimationStudioDemo/>);fireEvent.click(screen.getByRole("tab",{name:"Hardware"}));
 fireEvent.click(screen.getByRole("button",{name:"Add Mapping"}));
 fireEvent.click(screen.getByRole("button",{name:"Reverse Endpoints"}));fireEvent.click(screen.getByRole("button",{name:"Save Mapping"}));
 const grid=within(screen.getByRole("grid",{name:"Output mappings"}));expect(grid.getByText("90 → -90 deg")).toBeTruthy();
 fireEvent.click(grid.getByRole("button",{name:"Edit channel 0"}));fireEvent.click(screen.getByRole("button",{name:"Reverse Endpoints"}));fireEvent.click(screen.getByRole("button",{name:"Save Mapping"}));expect(grid.getByText("-90 → 90 deg")).toBeTruthy();
 fireEvent.click(grid.getByRole("button",{name:"Remove channel 0"}));fireEvent.click(screen.getByRole("button",{name:"Remove Mapping"}));expect(grid.queryByText("pan.rotation")).toBeNull();
});

test("view and environment panels retain control values when closed",()=>{
 render(<AnimationStudioDemo/>);fireEvent.click(screen.getByRole("button",{name:"View"}));
 fireEvent.change(screen.getByLabelText("Projection"),{target:{value:"Orthographic"}});
 expect((screen.getByLabelText("Field of view") as HTMLSelectElement).closest('fieldset')?.disabled).toBe(true);
 expect(localStorage.getItem("aether.animation-studio.projection")).toBe("Orthographic");
 fireEvent.click(screen.getByRole("button",{name:"Environment"}));
 fireEvent.click(screen.getByRole("button",{name:"Gradient Mood"}));expect(localStorage.getItem("aether.animation-studio.background-mode")).toBe("Gradient");
});

test("design sandbox card and its inspector share selection and properties",()=>{
 function Fixture(){const [value,setValue]=useState<StudioDesignState>({shapes:[{id:"one",tool:"box",name:"Box 1",x:100,y:100,material:"Not set",appearance:"Default",opacity:1,visible:true,rotation:0}],selected:"one"});return <><StudioDesignWorkspace value={value} onChange={setValue} activeTool={null}/><StudioDesignInspector value={value} onChange={setValue}/></>;}
 render(<Fixture/>);fireEvent.change(screen.getByLabelText("Feature name"),{target:{value:"Housing"}});expect(screen.getByRole("button",{name:/Housing Sandbox/})).toBeTruthy();
 const rotation=screen.getByLabelText("Feature rotation");fireEvent.change(rotation,{target:{value:"45"}});fireEvent.blur(rotation);expect(screen.getByRole("button",{name:/Housing Sandbox/}).style.transform).toContain("45deg");
 fireEvent.click(screen.getByRole("button",{name:"Delete"}));expect(screen.queryByLabelText("Feature name")).toBeNull();
});

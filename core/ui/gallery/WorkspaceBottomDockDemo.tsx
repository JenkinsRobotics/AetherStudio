import { useState } from "react";
import "./WorkspaceDemos.css";
import { AetherIcon, Checkbox, NumberField, SelectField, WorkspaceBottomDock, WorkspaceShell, type LayoutPreset } from "../src/index";

function useDemoDock(standalone = false) {
  const [active, setActive] = useState<string | null>("timeline");
  const [last, setLast] = useState("timeline");
  const [height, setHeight] = useState(180);
  const [duration, setDuration] = useState(15);
  return { active, height, dock: (
      <WorkspaceBottomDock widthFraction={1} activeTab={active} onTabChange={id => {setActive(id);if(id)setLast(id);}} height={height} minHeight={standalone ? 180 : 72} onHeightChange={standalone ? undefined : setHeight}
        tabs={[{id:"timeline",label:"Timeline",icon:<AetherIcon name="animate" />},{id:"surfaces",label:"Surfaces",icon:<AetherIcon name="surface" />}] }>
        <div style={{padding:16,display:"grid",gap:12}}>
          <strong>{last === "timeline" ? "Timeline" : "Surfaces"}</strong>
          {last === "timeline" ? <><NumberField aria-label="Demo duration" unit="s" value={duration} onValueChange={v=>setDuration(v ?? 15)} /><div style={{height:44,border:"1px solid var(--aether-color-border)",borderRadius:6,background:"linear-gradient(90deg, var(--aether-color-accent) 30%, transparent 30%)"}} /></> : <Checkbox label="Surface 01" defaultChecked />}
        </div>
      </WorkspaceBottomDock>
  ) };
}

export function BottomDockSpecimen() {
  const { active, height, dock } = useDemoDock(true);
  return <div className="bottom-dock-specimen" style={{ height: active ? height + 52 : 46 }}>{dock}</div>;
}

export function WorkspaceBottomDockDemo({ fullScreen = false }: { fullScreen?: boolean } = {}) {
  const [layout, setLayout] = useState<LayoutPreset>("floating");
  const { dock } = useDemoDock();
  return <section aria-label="Bottom dock showcase" style={{ display: "flex", flexDirection: "column", height: fullScreen ? "100%" : undefined }}>
    <div style={{ padding: 10 }}>
      <SelectField aria-label="Bottom dock layout" value={layout} onChange={e => setLayout(e.target.value as LayoutPreset)} options={[{value:"floating",label:"Floating"},{value:"docked",label:"Docked"},{value:"canvas",label:"Canvas"}]} />
    </div>
    <WorkspaceShell preset={layout} inheritChromePreferences={false} style={{ flex: fullScreen ? 1 : undefined, minHeight: 0, height: fullScreen ? undefined : 440 }}
      leftPanels={[{id:"layers",title:"Layers",icon:<AetherIcon name="layers" />,content:<Checkbox label="Scene" defaultChecked />}]} rightPanels={[]} centerBottom={dock}>
      <div style={{position:"absolute",inset:0,background:"var(--aether-color-bg-app)",display:"grid",placeItems:"center"}}>Workspace canvas</div>
    </WorkspaceShell>
  </section>;
}

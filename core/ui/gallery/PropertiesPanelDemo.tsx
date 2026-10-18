import { useState, type CSSProperties } from "react";
import { AetherIcon } from "../src/AetherIcon";
import { Button } from "../src/Button";
import { IconButton } from "../src/IconButton";
import { SegmentedControl } from "../src/SegmentedControl";
import { useScopedAetherTheme } from "../src/StudioChrome";
import { StylePropertiesPanel, type StylePropertiesValue } from "../src/StylePropertiesPanel";
import { TabbedSidebar } from "../src/TabbedSidebar";
import "./PropertiesPanelDemo.css";

export const INITIAL_STYLE: StylePropertiesValue = {
  width:240, height:200, rotation:0, opacity:100, corners:[12,12,12,12],
  fill:{enabled:true,color:"#82f5d8",opacity:100},
  border:{enabled:true,color:"#0099ff",width:2,style:"solid"},
  shadow:{enabled:true,color:"#394851",opacity:18,x:0,y:12,blur:28,spread:0},
};
const alpha = (color: string, opacity: number) => `${color}${Math.round(opacity * 2.55).toString(16).padStart(2,"0")}`;
/** Preview adapter is gallery-only: consumers map the value into their own renderer. */
export function previewStyle(v: StylePropertiesValue): CSSProperties {
  return { width:v.width,height:v.height,boxSizing:"border-box",opacity:v.opacity/100,
    borderRadius:v.corners.map(n => `${n}px`).join(" "),
    background:v.fill.enabled ? alpha(v.fill.color,v.fill.opacity) : "transparent",
    border:v.border.enabled ? `${v.border.width}px ${v.border.style} ${v.border.color}` : "none",
    boxShadow:v.shadow.enabled ? `${v.shadow.x}px ${v.shadow.y}px ${v.shadow.blur}px ${v.shadow.spread}px ${alpha(v.shadow.color,v.shadow.opacity)}` : "none",
  };
}
export function PropertiesPanelSpecimen() {
  const [value,setValue] = useState(INITIAL_STYLE), [guides,setGuides] = useState(true);
  const scale = Math.min(1,250/value.width,250/value.height);
  return <div className="properties-lab">
    <div className="properties-lab-stage">
      <header><div><span>STYLE STUDY / 01</span><h2>A little more clarity.</h2><p>One shape. Every detail in your hands.</p></div><IconButton label="Show selection guides" aria-pressed={guides} onClick={() => setGuides(!guides)}><AetherIcon name="rectangle-dashed"/></IconButton></header>
      <div className="properties-lab-canvas" aria-label="Live style preview">
        <div className="properties-lab-object-wrap" style={{width:value.width*scale,height:value.height*scale,transform:`rotate(${value.rotation}deg)`}}>
          <div className="properties-lab-object" data-testid="styled-object" style={{...previewStyle(value),transform:`scale(${scale})`,transformOrigin:"top left"}}/>
          {guides && <div className="properties-lab-selection" aria-hidden><i/><i/><i/><i/><span>{value.width} × {value.height}</span></div>}
        </div>
      </div>
      <div className="properties-lab-presets"><span>QUICK LOOKS</span><div>
        <Button onClick={() => setValue({...value,fill:{enabled:true,color:"#82f5d8",opacity:100},border:{...value.border,enabled:true,color:"#0099ff"}})}>Mint + blue</Button>
        <Button onClick={() => setValue({...value,fill:{enabled:true,color:"#0099ff",opacity:100},border:{...value.border,enabled:true,color:"#82f5d8"}})}>Blue + mint</Button>
        <Button onClick={() => setValue({...value,fill:{...value.fill,enabled:false}})}>Outline</Button>
      </div></div>
      <footer><span><AetherIcon name="rectangle"/> Rectangle 01</span><span>{Math.round(scale*100)}% preview</span></footer>
    </div>
    <div className="properties-lab-inspector"><StyleSidebar value={value} onChange={setValue}/></div>
  </div>;
}
/** In-context composition: the same inspector can be hosted in a sidebar. */
function StyleSidebar({value,onChange}: {value: StylePropertiesValue; onChange: (value: StylePropertiesValue) => void}) {
  const [tab,setTab] = useState<string | null>("style");
  return <TabbedSidebar ariaLabel="Style sidebar" floating heightPolicy="content" tabPosition="top"
    tabs={[{id:"style",label:"Style",icon:<AetherIcon name="palette"/>},{id:"layers",label:"Layers",icon:<AetherIcon name="layers"/>},{id:"export",label:"Export",icon:<AetherIcon name="export"/>}]}
    activeTab={tab} onTabChange={setTab} style={{"--aui-sidebar-expanded-width":"320px"} as CSSProperties}>
    {tab === "style" ? <div className="aui-shell-panel"><div className="aui-shell-panel-body"><StylePropertiesPanel value={value} onChange={onChange} selectionLabel="Rectangle 01" onReset={() => onChange(INITIAL_STYLE)}/></div></div>
      : tab ? <div className="aui-shell-panel"><div className="aui-shell-panel-body" style={{padding:12,color:"var(--aether-color-text-dim)"}}>{tab === "layers" ? "Rectangle 01" : "Export options"}</div></div> : null}
  </TabbedSidebar>;
}

/** Widgets showcase the standalone component; sidebar composition belongs in the in-context demo. */
export function StylePropertiesWidget() {
  const [value,setValue] = useState(INITIAL_STYLE);
  return <div className="properties-widget"><StylePropertiesPanel value={value} onChange={setValue} selectionLabel="Rectangle 01" onReset={() => setValue(INITIAL_STYLE)}/></div>;
}
export function PropertiesPanelDemo({onExit}: {onExit?: () => void}) {
  const [appearance,setAppearance] = useState<"light"|"dark">("light");
  useScopedAetherTheme("aether-studio",appearance);
  return <main className="properties-demo"><header>
    <div><IconButton label="Back to Aether UI" onClick={onExit}><AetherIcon name="chevron-left"/></IconButton><div><strong>Properties Studio</strong><span>Aether UI · Design studies</span></div></div>
    <SegmentedControl ariaLabel="Preview appearance" value={appearance} onChange={id => setAppearance(id as "light"|"dark")} options={[{id:"light",label:"Light"},{id:"dark",label:"Dark"}]}/>
  </header><PropertiesPanelSpecimen/></main>;
}

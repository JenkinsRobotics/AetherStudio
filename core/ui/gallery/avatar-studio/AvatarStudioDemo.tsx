import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AetherIcon, AppWordmark, Button, Dialog, DocumentBar, FloatingToolbar, FloatingToolbarMenu, IconButton, TabbedSidebar, useScopedAetherTheme } from "../../src";
import { AvatarControls, AvatarPicker, AvatarScene, MarkupControls, OutputControls, ScenePicker } from "./AvatarControls";
import { Annotations } from "./Annotations";
import { INITIAL, OUTPUTS, SCENES, type SceneState } from "./data";
import { exportScene } from "./export";
import "./avatar-studio.css";

export function AvatarStudioDemo({onExit}:{onExit?:()=>void}) {
  useScopedAetherTheme("aether-analytics","dark");
  const [state,setState]=useState<SceneState>({...INITIAL,caption:"Hello, world!"}),[tab,setTab]=useState<string|null>(null);
  const [tool,setTool]=useState("select"),[playing,setPlaying]=useState(false),[locked,setLocked]=useState(false),[brush,setBrush]=useState(4),[notice,setNotice]=useState(""),[exporting,setExporting]=useState(false);
  const [rendered,setRendered]=useState<{url:string;fileName:string;width:number;height:number}|null>(null);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>()=>{if(rendered)URL.revokeObjectURL(rendered.url);},[rendered]);
  const patch=(value:Partial<SceneState>)=>setState(current=>({...current,...value}));
  const scene=SCENES.find(item=>item.id===state.scene)!,output=OUTPUTS.find(item=>item.id===state.output)!;
  const toggleTab=(id:string)=>setTab(current=>current===id?null:id);
  const clear=()=>patch({strokes:[],caption:""});
  const save=async()=>{setPlaying(false);setExporting(true);try{const image=await exportScene(state);if(mounted.current){setRendered({url:URL.createObjectURL(image.blob),fileName:image.fileName,width:image.width,height:image.height});setNotice(`Image ready: ${output.label}.`);}}catch(error){setNotice(error instanceof Error?error.message:"Could not export the image.");}finally{setExporting(false);}};
  const action=(id:string)=>{setNotice("");if(id==="draw"||id==="select"){setTool(id);if(id==="draw"){setLocked(false);setTab("markup");}}else if(id==="text"){setTab("markup");setTool("select");}else if(id==="undo")patch({strokes:state.strokes.slice(0,-1)});else if(id==="mirror")patch({mirrored:!state.mirrored});else if(id==="export")void save();};
  const panels=tab==="scenes"?<><ScenePicker value={state.scene} onChange={scene=>patch({scene})}/><p className="avatar-hint">Choose a backdrop for your scene.</p></>:tab==="avatar"?<><AvatarPicker value={state.look} onChange={look=>patch({look})}/><AvatarControls state={state} patch={patch}/></>:tab==="markup"?<MarkupControls caption={state.caption} color={state.captionColor} width={brush} onCaption={caption=>patch({caption})} onColor={captionColor=>patch({captionColor})} onWidth={setBrush} onClear={clear}/>:<OutputControls state={state} patch={patch}/>;
  return <div className="avatar-studio">
    <DocumentBar windowChrome={false} leading={<><IconButton label="Back to component library" appearance="glyph" onClick={onExit}><AetherIcon name="arrow-left"/></IconButton><AppWordmark app="animation" size={28}/><span>Avatar Studio</span></>} trailing={<span className="avatar-demo-label">Illustrated scene demo</span>}/>
    <main className="avatar-workspace" aria-label="Avatar studio workspace">
      <div className="avatar-scene-heading"><div><span>MY SCENE</span><h1>{scene.label}</h1></div><span className="avatar-preview-state" data-playing={playing}>{playing?"Motion preview":"Ready to preview"}</span></div>
      <div className="avatar-stage-area"><div className="avatar-stage-frame" style={{"--avatar-aspect":output.width/output.height} as CSSProperties}>
        <AvatarScene state={state} playing={playing}><Annotations strokes={state.strokes} caption={state.caption} color={state.captionColor} brushWidth={brush} aspect={output.width/output.height} drawing={tool==="draw"&&!locked} onStroke={stroke=>setState(current=>({...current,strokes:[...current.strokes,stroke]}))}/></AvatarScene>
        <span className="avatar-frame-label">{output.label} · {locked?"Locked":tool==="draw"?"Draw on the scene":"Scene preview"}</span>
      </div></div>
      <div className="avatar-side"><TabbedSidebar ariaLabel="Studio tools" floating heightPolicy="content" attachment="attached" tabPosition="left" anchor="left" activeTab={tab} onTabChange={setTab} tabs={[{id:"scenes",label:"Scenes",icon:<AetherIcon name="image"/>},{id:"avatar",label:"Avatar",icon:<AetherIcon name="person"/>},{id:"markup",label:"Annotations",icon:<AetherIcon name="pencil"/>},{id:"output",label:"Output settings",icon:<AetherIcon name="sliders"/>}]}><div className="avatar-side-content">{panels}</div></TabbedSidebar></div>
      <div className="avatar-toolbar"><FloatingToolbar ariaLabel="Scene tools" onAction={action} groups={[
        {id:"edit",label:"Editing tools",actions:[{id:"select",label:"Select",icon:<AetherIcon name="cursor"/>,pressed:tool==="select"},{id:"draw",label:"Draw",icon:<AetherIcon name="pencil"/>,pressed:tool==="draw"&&!locked},{id:"text",label:"Add text",icon:<AetherIcon name="text"/>}]},
        {id:"history",label:"Scene actions",separatorBefore:true,actions:[{id:"undo",label:"Undo drawing",icon:<AetherIcon name="undo"/>,disabled:!state.strokes.length},{id:"mirror",label:"Mirror",icon:<AetherIcon name="flip-horizontal"/>,pressed:state.mirrored},{id:"export",label:exporting?"Saving image":"Save PNG",icon:<AetherIcon name="camera"/>,disabled:exporting}]}
      ]} trailing={<><FloatingToolbarMenu label="Video resolution" items={OUTPUTS.map(item=>({id:item.id,label:item.label,kind:"radio",checked:state.output===item.id}))} onSelect={output=>patch({output})}><AetherIcon name="monitor"/><span>{output.label}</span></FloatingToolbarMenu><Button primary active={playing} onClick={()=>setPlaying(value=>!value)}><AetherIcon name={playing?"pause":"play-filled"}/>{playing?"Pause preview":"Start preview"}</Button></>}/></div>
      <div className="avatar-corner"><IconButton label={locked?"Unlock annotations":"Lock annotations"} appearance="rounded" aria-pressed={locked} onClick={()=>{setLocked(value=>!value);setTool("select");}}><AetherIcon name={locked?"lock":"unlock"}/></IconButton><IconButton label="Choose avatar" appearance="rounded" aria-pressed={tab==="avatar"} onClick={()=>toggleTab("avatar")}><AetherIcon name="person"/></IconButton><IconButton label="Choose scene" appearance="rounded" aria-pressed={tab==="scenes"} onClick={()=>toggleTab("scenes")}><AetherIcon name="image"/></IconButton></div>
      <p className="avatar-status" role="status">{notice||"Local demo · PNG export · No camera connected"}</p>
    </main>
    <Dialog open={!!rendered} title="Export image" onClose={()=>setRendered(null)} actions={<><Button onClick={()=>setRendered(null)}>Done</Button>{rendered && <a className="aui-button aui-button--primary" href={rendered.url} download={rendered.fileName} onClick={()=>setNotice("PNG download requested.")}>Download PNG</a>}</>}>{rendered && <div className="avatar-export"><img src={rendered.url} alt="Exported scene"/><p>{rendered.width} × {rendered.height} · PNG</p></div>}</Dialog>
  </div>;
}

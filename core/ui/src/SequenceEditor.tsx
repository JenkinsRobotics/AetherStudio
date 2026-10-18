import { useEffect, useState } from "react";
import { Timeline, type TimelineTrack } from "./Timeline";
import { Button } from "./Button";
import { SegmentedControl } from "./SegmentedControl";
import "./ConceptInspectors.css";

export interface SequenceEditorProps { initialTracks: readonly TimelineTrack[]; durationS?: number; initialMode?: "dope-sheet" | "curves" | "waypoints" }
/** Local authoring specimen. Products supply evaluated motion to their renderer. */
export function SequenceEditor({initialTracks, durationS = 8, initialMode = "dope-sheet"}: SequenceEditorProps) {
  const [tracks,setTracks] = useState([...initialTracks]);
  const [mode,setMode] = useState(initialMode);
  const [time,setTime] = useState(0);
  const [playing,setPlaying] = useState(false);
  const [loop,setLoop] = useState(true);
  const [selection,setSelection] = useState<{trackID:string;index:number}|null>(null);
  const [filter,setFilter] = useState("");
  const [markers,setMarkers] = useState<number[]>([]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setTime((current) => Math.min(durationS, current + 1/30) === durationS && loop ? 0 : Math.min(durationS, current + 1/30)), 1000/30);
    return () => window.clearInterval(timer);
  }, [playing,loop,durationS]);
  useEffect(() => { if (!loop && time >= durationS) setPlaying(false); },[time,loop,durationS]);
  const visible = tracks.filter((track) => track.label.toLowerCase().includes(filter.toLowerCase()));
  return <section className="aui-sequence-editor" aria-label="Sequence editor">
    <header><input aria-label="Filter tracks" placeholder="Filter tracks" value={filter} onChange={(e)=>setFilter(e.target.value)}/><Button onClick={()=>setMarkers((list)=>[...list,time])}>Marker</Button><Button onClick={()=>setTracks((list)=>[...list,{id:`track-${list.length}`,label:`Motion ${list.length+1}`,keyframes:[]}])}>Add Row</Button><Button onClick={()=>{ const id=selection?.trackID ?? tracks[0]?.id; if(id) setTracks((list)=>list.map((t)=>t.id===id?{...t,keyframes:[...t.keyframes,{timeS:time,value:0}].sort((a,b)=>a.timeS-b.timeS)}:t)); }} disabled={!tracks.length}>Add Key</Button><Button disabled={!selection} onClick={()=>{setTracks((list)=>list.map((t)=>t.id===selection?.trackID?{...t,keyframes:t.keyframes.filter((_,i)=>i!==selection.index)}:t));setSelection(null);}}>Delete Key</Button></header>
    <SegmentedControl ariaLabel="Timeline design mode" value={mode} onChange={(id)=>setMode(id as typeof mode)} options={[{id:"dope-sheet",label:"Dopesheet"},{id:"curves",label:"Motion Curves"},{id:"waypoints",label:"Waypoint Lanes"}]}/>
    {mode === "waypoints" ? <div className="aui-waypoint-lanes" aria-label="Waypoint lanes"><Button onClick={()=>setPlaying(!playing)}>{playing?"Pause":"Play"}</Button><input aria-label="Waypoint time" type="range" min={0} max={durationS} step={.01} value={time} onChange={(e)=>setTime(Number(e.target.value))}/>{visible.map((track)=><div key={track.id}><strong>{track.label}</strong><div>{track.keyframes.map((key,index)=><button key={index} aria-pressed={selection?.trackID===track.id&&selection.index===index} onClick={()=>{setSelection({trackID:track.id,index});setTime(key.timeS);}}>{key.timeS.toFixed(2)}s · {key.value?.toFixed(2) ?? "—"}</button>)}</div></div>)}</div> : <Timeline variant="editor" mode={mode} tracks={visible} timeS={time} durationS={durationS} onSeek={setTime} playing={playing} onTogglePlay={()=>setPlaying(!playing)} looping={loop} onToggleLoop={()=>setLoop(!loop)} onStop={()=>{setPlaying(false);setTime(0);}} onStepFrame={(direction)=>setTime(Math.max(0,Math.min(durationS,time+direction/30)))} onSeekAdjacentKeyframe={(direction)=>{
      const times=[...new Set(tracks.flatMap(track=>track.keyframes.map(key=>key.timeS)))].sort((a,b)=>a-b);
      setTime(direction<0 ? [...times].reverse().find(t=>t<time-1e-6)??0 : times.find(t=>t>time+1e-6)??durationS);
    }} selected={selection} onSelectKeyframe={(trackID,index)=>setSelection({trackID,index})} emptyState={<Button onClick={()=>setTracks([{id:"first",label:"Motion 1",keyframes:[]}])}>Add first track</Button>}/>}
    <footer>{tracks.length} tracks · {time.toFixed(2)}s <span>Markers: {markers.length ? markers.map((m)=>`${m.toFixed(2)}s`).join(", ") : "None"}</span></footer>
  </section>;
}

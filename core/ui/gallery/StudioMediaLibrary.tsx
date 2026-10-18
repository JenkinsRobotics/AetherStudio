import { useEffect, useRef, useState } from "react";
import { AetherIcon, Button } from "../src/index";

export function useStudioMedia() {
  const input = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);
  const [assets,setAssets] = useState<{id:string;name:string;type:string;url:string}[]>([]);
  const [selected,setSelected] = useState<string | null>(null);
  useEffect(() => () => urls.current.forEach((url) => URL.revokeObjectURL(url)), []);
  const choose = (type: string) => { if(input.current) {input.current.accept=`${type}/*`;input.current.click();} };
  const fileInput = <input ref={input} type="file" multiple hidden aria-label="Import media files" onChange={(event) => {
    const files=[...(event.target.files ?? [])];
    const added=files.filter((file)=>/^(image|video|audio)\//.test(file.type)).map((file)=>{
      const url=URL.createObjectURL(file);urls.current.push(url);
      return {id:crypto.randomUUID(),name:file.name,type:file.type,url};
    });
    setAssets((current)=>[...current,...added]);setSelected(added[0]?.id??null);event.target.value="";
  }}/>;
  const active=assets.find((asset)=>asset.id===selected);
  const content=<div className="animation-media-library"><header><strong>Media</strong><small>Local preview · files stay in this tab</small></header>
    {assets.length ? assets.map((asset)=><button key={asset.id} type="button" aria-pressed={selected===asset.id} onClick={()=>setSelected(asset.id)}><AetherIcon name={asset.type.startsWith("image")?"image":asset.type.startsWith("audio")?"animate":"play"}/>{asset.name}</button>) : <p>No media imported. Add an image, audio, or video from the Assets toolbar.</p>}
    {active ? active.type.startsWith("image") ? <img src={active.url} alt={active.name}/> : active.type.startsWith("audio") ? <audio controls src={active.url}/> : <video controls src={active.url}/> : null}
    {active ? <Button onClick={()=>{setAssets((current)=>current.filter((asset)=>asset.id!==active.id));setSelected(null);URL.revokeObjectURL(active.url);urls.current=urls.current.filter((url)=>url!==active.url);}}>Remove media</Button> : null}
  </div>;
  return {choose,fileInput,content};
}

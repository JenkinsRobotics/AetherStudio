import { useEffect, useState } from "react";
import { initialParts, type PartRow } from "./AnimationStudioCatalog";

const key = "aether.animation-studio.concept-document.v1";
function restore(): readonly PartRow[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (Array.isArray(saved) && saved.every((item) => item && typeof item.id === "string" && typeof item.part === "string" && typeof item.source === "string" && typeof item.parent === "string" && typeof item.version === "string" && ["Ready", "Disconnected"].includes(item.state))) return saved;
  } catch { /* Leave corrupt/blocked storage intact; use a fresh sample in memory. */ }
  return initialParts;
}

export function useStudioDemoDocument() {
  const [history, setHistory] = useState(() => ({past: [] as (readonly PartRow[])[], present: restore(), future: [] as (readonly PartRow[])[]}));
  const [saved, setSaved] = useState(false);
  const save = () => {
    try { localStorage.setItem(key, JSON.stringify(history.present)); setSaved(true); }
    catch { setSaved(false); }
  };
  useEffect(save, [history.present]);
  const update = (change: (current: readonly PartRow[]) => readonly PartRow[]) => {
    setSaved(false);
    setHistory((current) => ({past:[...current.past.slice(-49), current.present], present:change(current.present), future:[]}));
  };
  const undo = () => setHistory((current) => !current.past.length ? current : ({past:current.past.slice(0,-1),present:current.past[current.past.length-1],future:[current.present,...current.future]}));
  const redo = () => setHistory((current) => !current.future.length ? current : ({past:[...current.past,current.present],present:current.future[0],future:current.future.slice(1)}));
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({format:"aether-ui-studio-concept",version:1,parts:history.present}, null, 2)], {type:"application/json"}));
    const anchor = document.createElement("a"); anchor.href=url; anchor.download="animation-concept.json"; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return {parts:history.present,update,undo,redo,save,saved,download,canUndo:history.past.length>0,canRedo:history.future.length>0};
}

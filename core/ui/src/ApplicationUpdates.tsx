import { useEffect, useId, useRef, type ReactNode, type CSSProperties } from 'react';
import { AetherIcon } from './AetherIcon';
import { IconButton } from './IconButton';
import './ApplicationUpdates.css';
export interface ApplicationUpdate { id:string; title:string; description:string; status:'Available'|'Planned'|'Preview'; artwork:ReactNode; color?:string; }
/** Products supply their own feature claims. This widget owns the home layout. */
export function ApplicationUpdates({name,description,artwork,updates=[]}:{name:string;description:string;artwork:ReactNode;updates?:readonly ApplicationUpdate[]}) {
 const id=useId(),track=useRef<HTMLUListElement>(null);
 useEffect(() => {
  const list = track.current;
  if (!list) return;
  const onWheel = (event: WheelEvent) => {
   // Preserve native horizontal/trackpad gestures and browser zoom. A normal
   // mouse wheel can also browse cards, without trapping page scroll at edges.
   if (event.ctrlKey || event.metaKey || event.shiftKey || event.deltaX !== 0 || !event.deltaY) return;
   const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? list.clientWidth : 1;
   const next = Math.max(0, Math.min(list.scrollWidth - list.clientWidth, list.scrollLeft + event.deltaY * unit));
   if (next === list.scrollLeft) return;
   event.preventDefault();
   list.scrollLeft = next;
  };
  list.addEventListener('wheel', onWheel, { passive: false });
  return () => list.removeEventListener('wheel', onWheel);
 }, []);
 const scroll=(direction:number)=>track.current?.scrollBy({left:352*direction,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 return <section className="aui-app-updates" aria-labelledby={id}>
 <header><div><h2 id={id}>What’s new</h2><p>The latest in {name}, and what’s coming next.</p></div><div className="aui-app-updates-nav"><IconButton label="Scroll updates left" onClick={()=>scroll(-1)}><AetherIcon name="chevron-left"/></IconButton><IconButton label="Scroll updates right" onClick={()=>scroll(1)}><AetherIcon name="chevron-right"/></IconButton></div></header>
 <ul ref={track} tabIndex={0} aria-label={`${name} updates; scroll for more`}>
 <li className="aui-app-update aui-app-update-welcome"><div><small>Welcome</small><h3>{name}</h3><p>{description}</p></div><div className="aui-app-update-art" aria-hidden="true">{artwork}</div></li>
 {updates.map(item=><li className="aui-app-update" key={item.id} style={{'--update-color':item.color??'#b8cce9'} as CSSProperties}><div><small>{item.status === 'Planned' ? 'Coming soon' : item.status}</small><h3>{item.title}</h3><p>{item.description}</p></div><div className="aui-app-update-art" aria-hidden="true">{item.artwork}</div></li>)}
 </ul></section>;
}

import { useState } from "react";
import { AetherIcon } from "./AetherIcon";
import { Menu, type MenuItem } from "./Menu";

export function ViewportCubeHome({onHome,items,onSelect}: {
  onHome: ()=>void; items?: readonly MenuItem[]; onSelect?: (id:string)=>void;
}) {
  const [anchor,setAnchor]=useState<HTMLButtonElement|null>(null);
  const hasMenu=!!items?.length && !!onSelect;
  return <>
    <button className="aui-viewport-cube-home" type="button" title="Home view" aria-label="Home view"
      aria-haspopup={hasMenu ? "menu" : undefined} aria-expanded={hasMenu ? !!anchor : undefined}
      onClick={onHome}
      onContextMenu={event=>{if(hasMenu){event.preventDefault();event.stopPropagation();setAnchor(event.currentTarget);}}}
      onKeyDown={event=>{if(hasMenu && (event.key==="ArrowDown" || event.key==="ContextMenu" || (event.shiftKey && event.key==="F10"))){event.preventDefault();event.stopPropagation();setAnchor(event.currentTarget);}}}>
      <AetherIcon name="home" />
    </button>
    {hasMenu ? <Menu open={!!anchor} anchor={anchor} items={items!} onSelect={onSelect!} onClose={()=>setAnchor(null)} ariaLabel="View and graphics options" placement="bottom-end" /> : null}
  </>;
}

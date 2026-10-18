import {useState} from 'react';
import {AetherIcon} from './AetherIcon';
import {Popover} from './Popover';
import {SelectField} from './SelectField';
import {Button} from './Button';
import {useWorkspaceChrome,setWorkspaceChrome} from './WorkspaceChromePreferences';
import type {WorkspaceControls,ControlPlacement} from './workspace-controls';
export function WorkspaceLayoutControl({controls}:{controls:WorkspaceControls}) {
 const [anchor,setAnchor]=useState<HTMLElement|null>(null);const chrome=useWorkspaceChrome();
 return <><button type="button" className="aui-icon-button" aria-label="Workspace layout" aria-expanded={!!anchor} onClick={event=>setAnchor(anchor?null:event.currentTarget)}><AetherIcon name="layout"/></button>
 <Popover open={!!anchor} anchor={anchor} onClose={()=>setAnchor(null)} ariaLabel="Workspace layout" placement="bottom-end"><div style={{width:280,maxHeight:'70vh',overflow:'auto',display:'grid',gap:10,padding:10}}>
 <strong>Workspace layout</strong>
 <label>Toolbar density<SelectField aria-label="Toolbar density" value={chrome.toolbarDensity} options={['app','compact','standard','expanded'].map(value=>({value,label:value==='app'?'App default':value}))} onChange={event=>setWorkspaceChrome({toolbarDensity:event.target.value as typeof chrome.toolbarDensity})}/></label>
 {controls.panels.map(panel=><label key={panel.id} style={{display:'grid',gridTemplateColumns:'1fr 120px',alignItems:'center',gap:8}}>{panel.label}<SelectField aria-label={`${panel.label} placement`} value={panel.placement} options={[{value:'docked',label:`Dock ${panel.side}`},{value:'floating',label:'Float'},{value:'hidden',label:'Hidden'}]} onChange={event=>controls.place(panel.id,event.target.value as ControlPlacement)}/></label>)}
 <Button onClick={controls.reset}>Reset panel placements</Button></div></Popover></>;
}

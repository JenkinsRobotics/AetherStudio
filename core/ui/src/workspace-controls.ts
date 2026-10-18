import {useEffect,useRef,useSyncExternalStore, type RefObject} from 'react';
export type ControlPlacement='docked'|'floating'|'hidden';
export interface WorkspaceControls {
 panels:readonly {id:string;label:string;side:'left'|'right';placement:ControlPlacement}[];
 show:(id:string)=>void;
 place:(id:string,placement:ControlPlacement)=>void;
 reset:()=>void;
}
const clients=new Map<object,{element:RefObject<HTMLElement|null>;current:()=>WorkspaceControls}>();
const listeners=new Set<()=>void>();let version=0;
function emit(){version++;listeners.forEach(listener=>listener());}
/** Registers presentation capabilities only; the shell remains the state owner. */
export function useRegisterWorkspaceControls(element:RefObject<HTMLElement|null>,controls:WorkspaceControls){
 const current=useRef(controls);current.current=controls;
 const signature=JSON.stringify(controls.panels);
 useEffect(()=>{const id={};clients.set(id,{element,current:()=>current.current});emit();return()=>{clients.delete(id);emit();};},[element]);
 useEffect(emit,[signature]);
}
export function useWorkspaceControls(){
 useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},()=>version,()=>0);
 return [...clients.values()].reverse().find(client=>client.element.current&&!client.element.current.closest('[hidden],[inert],[aria-hidden="true"]'))?.current();
}

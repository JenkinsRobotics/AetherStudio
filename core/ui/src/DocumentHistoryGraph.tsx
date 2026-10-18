import { useMemo, useRef, useState } from "react";
import { AetherIcon } from "./AetherIcon";
import { IconButton } from "./IconButton";
import { Menu, type MenuItem } from "./Menu";
import { historyBranchKey, type DocumentHistory } from "./DocumentServices";
import type { HistoryMilestone } from "./document-history-graph";
import { milestoneChanges, visibleHistory, visibleParents, type BranchFilter } from "./document-history-view";

export const HISTORY_LEGEND = [["workspace","Workspace"],["tag","Version"],["change","Change"],["triangle","Release candidate"],["triangle-filled","Release"],["obsoletion","Contains obsoletion"],["auto-version","Automatic version"]] as const;
const stamp = (time: number) => time ? new Date(time * 1000).toLocaleString(undefined,{dateStyle:"short",timeStyle:"short"}) : "";
const marker = (row: HistoryMilestone) => row.kind === "workspace" ? "workspace" : row.kind === "start" ? "change" : row.status === "candidate" ? "triangle" : row.status === "released" ? "triangle-filled" : row.status === "obsolete" ? "obsoletion" : row.origin === "automatic" ? "auto-version" : "tag";
const filters: {id:BranchFilter;label:string;icon:string}[] = [
  {id:"all",label:"Show all branches",icon:"branch"},
  {id:"workspaces",label:"Show all branches with workspaces",icon:"workspace"},
  {id:"current",label:"Show current branch",icon:"branch-from"},
  {id:"parents",label:"Show current branch with parent branches",icon:"version-control"},
];

/** Shared graph presentation: visibility is local, history remains server-owned. */
export function DocumentHistoryGraph({ history, graph, branch, query, selectedID, selectedSave, onSelect, onSelectSave, onOpenWorkspace, onContextMenu }: {
  history: DocumentHistory | null; graph: HistoryMilestone[]; branch: string; query: string;
  selectedID?: string; selectedSave: number | null;
  onSelect:(row:HistoryMilestone)=>void; onSelectSave:(id:number)=>void;
  onOpenWorkspace:(name:string)=>void;
  onContextMenu:(position:{x:number;y:number})=>void;
}) {
  const [filter,setFilter]=useState<BranchFilter>("all"), [filterOpen,setFilterOpen]=useState(false);
  const [automatic,setAutomatic]=useState(true), [merges,setMerges]=useState(true);
  const [expanded,setExpanded]=useState<ReadonlySet<string>>(new Set());
  const anchor=useRef<HTMLDivElement>(null);
  const shown=useMemo(()=>history?visibleHistory(graph,history,branch,filter,automatic,query):[],[graph,history,branch,filter,automatic,query]);
  const changes=useMemo(()=>new Map(shown.map(row=>[row.id,history?milestoneChanges(row,history):[]])),[shown,history]);
  const offsets=new Map<string,number>(); let height=0;
  for(const row of shown){offsets.set(row.id,height);height+=52+(expanded.has(row.id)?(changes.get(row.id)?.length??0)*40:0);}
  const graphWidth=16+Math.max(1,...shown.map(row=>row.lane+1))*14;
  const items:MenuItem[]=filters.map(item=>({...item,icon:<AetherIcon name={item.icon}/>,kind:"radio",checked:filter===item.id}));
  return <>
    <div className="aui-version-tools" role="toolbar" aria-label="History display">
      <div ref={anchor}><IconButton label="Filter branches" aria-haspopup="menu" aria-expanded={filterOpen} onClick={()=>setFilterOpen(!filterOpen)}><AetherIcon name="branch-filter"/></IconButton></div>
      <IconButton label={automatic?"Hide automatic versions":"Show automatic versions"} aria-pressed={automatic} onClick={()=>setAutomatic(!automatic)}><AetherIcon name="auto-version"/></IconButton>
      <IconButton label={merges?"Hide merge lines":"Show merge lines"} aria-pressed={merges} onClick={()=>setMerges(!merges)}><AetherIcon name="merge"/></IconButton>
      <span title={filters.find(f=>f.id===filter)?.label}>{history?.branches.find(b => historyBranchKey(b) === branch)?.name ?? branch}{history?.writable===false?" · Read only":""}</span>
    </div>
    <Menu open={filterOpen} anchor={anchor.current} items={items} onSelect={id=>{setFilter(id as BranchFilter);setFilterOpen(false);}} onClose={()=>setFilterOpen(false)} ariaLabel="Branch visibility"/>
    <div className="aui-version-columns" style={{paddingLeft:graphWidth}}><span>Name</span><span>Modified</span></div>
    <div className="aui-version-graph-scroll">
      <div className="aui-version-graph-content">
        <svg className="aui-version-links" width={graphWidth} height={height} aria-hidden="true">
          {shown.flatMap(row=>visibleParents(row,graph,shown,merges).map(parent=>{
            const to=shown.find(item=>item.id===parent)!;
            const x=14+row.lane*14,y=offsets.get(row.id)!+17,px=14+to.lane*14,py=offsets.get(parent)!+17;
            return <path key={`${row.id}-${parent}`} d={`M ${x} ${y} C ${x} ${(y+py)/2}, ${px} ${(y+py)/2}, ${px} ${py}`}/>;
          }))}
        </svg>
        <ol aria-label="Version graph">
          {shown.map(row=>{const entries=changes.get(row.id)!;return <li key={row.id} data-kind={row.kind} data-status={row.status} data-origin={row.origin}>
            <div className="aui-version-entry">
              <button type="button" className="aui-version-row" style={{paddingLeft:graphWidth}} aria-pressed={selectedSave==null&&selectedID===row.id}
                aria-label={`${row.kind==="workspace"?"Workspace":row.kind==="version"?"Version":"Document"} ${row.name}`} title={[row.message,row.statusNote].filter(Boolean).join(" — ")}
                onClick={()=>onSelect(row)} onDoubleClick={()=>{if(row.kind==="workspace"&&(row.branchID ?? row.name)!==branch)onOpenWorkspace(row.branchID ?? row.name);}}
                onContextMenu={e=>{e.preventDefault();onSelect(row);onContextMenu({x:e.clientX,y:e.clientY});}}>
                <span className="aui-version-marker" style={{left:row.lane*14+6}}><AetherIcon name={marker(row)}/></span>
                <span className="aui-version-name"><strong>{row.name}</strong></span>
                <span className="aui-version-modified"><span>{row.author}</span><small>{stamp(row.saved)}</small></span>
              </button>
              {row.kind!=="start"&&(entries.length?<button type="button" className="aui-version-expand" style={{left:graphWidth}} aria-expanded={expanded.has(row.id)} aria-label={`Show changes for ${row.name}`} onClick={()=>setExpanded(prev=>{const next=new Set(prev);next.has(row.id)?next.delete(row.id):next.add(row.id);return next;})}>
                <AetherIcon name={expanded.has(row.id)?"chevron-down":"chevron-right"}/>{expanded.has(row.id)?"Hide changes":"Show changes…"}
              </button>:<small className="aui-version-no-changes" style={{left:graphWidth}}>0 changes</small>)}
            </div>
            {expanded.has(row.id)&&<ol aria-label={`Changes for ${row.name}`} className="aui-version-changes">{entries.map(save=><li key={save.revision}><button type="button" aria-pressed={selectedSave===save.revision} onClick={()=>onSelectSave(save.revision)}
              onContextMenu={e=>{e.preventDefault();onSelectSave(save.revision);onContextMenu({x:e.clientX,y:e.clientY});}} style={{paddingLeft:graphWidth}}>
              <AetherIcon name="change"/><span><strong>{save.note|| (save.event==="save"?"Saved changes":save.event)}</strong><small>{save.author} · {stamp(save.saved)}</small></span>
            </button></li>)}</ol>}
          </li>;})}
        </ol>
      </div>
      {!history&&<p role="status">Loading history…</p>}
      {history&&!shown.length&&<p>No matching versions or workspaces.</p>}
    </div>
    <dl className="aui-version-legend">{HISTORY_LEGEND.map(([icon,label])=><div key={label}><dt><AetherIcon name={icon}/></dt><dd>{label}</dd></div>)}</dl>
    <footer className="aui-version-foot">Right-click an entry for actions</footer>
  </>;
}

import { useMemo, useState } from "react";
import { AetherIcon } from "./AetherIcon";
import { TreePanel, type TreeControl } from "./TreePanel";
import { TreePanelSplit } from "./TreePanelSplit";
import type { TreeMovePosition, TreeNode, TreeProps } from "./Tree";
import { DEFAULT_FEATURE_GEOMETRY, FeatureTypeIcon, featureTreeActions, featureTreeMenuItems, flattenFeatureItems, type FeatureTreeCommand, type FeatureTreeItem, type FeatureTreeRequest } from "./feature-tree";
import "./FeatureTree.css";

export interface FeatureTreeProps {
  features: readonly FeatureTreeItem[];
  parts: readonly FeatureTreeItem[];
  defaultGeometry?: readonly FeatureTreeItem[];
  selectedIDs: ReadonlySet<string>;
  onSelect: TreeProps["onSelect"];
  availableCommands?: readonly FeatureTreeCommand[];
  onCommand?: (request: FeatureTreeRequest) => void;
  /** Owning application validates dependencies, locks, transactions and folder cycles. */
  canCommand?: (request: FeatureTreeRequest) => boolean | string;
  rollbackIndex?: number;
  filter?: string;
  onFilterChange?: (query: string) => void;
  ariaLabel?: string;
  partsLabel?: string;
  className?: string;
  storageKey?: string;
}
const GEOMETRY = "__feature-tree-geometry__", ROLLBACK = "__feature-tree-rollback__";
const NO_COMMANDS: readonly FeatureTreeCommand[] = [];
/** Content-only authoring widget. Containers and model evaluation belong to its host. */
export function FeatureTree({ features, parts, defaultGeometry = DEFAULT_FEATURE_GEOMETRY, selectedIDs, onSelect,
  availableCommands = NO_COMMANDS, onCommand, canCommand, rollbackIndex, filter, onFilterChange,
  ariaLabel = "Features", partsLabel = "Parts", className = "", storageKey }: FeatureTreeProps) {
  const [localFilter,setLocalFilter] = useState("");
  const query = filter ?? localFilter;
  const [category,setCategory] = useState("all");
  const filtered = !!query || category !== "all";
  const [renaming,setRenaming] = useState<string|null>(null);
  const all = useMemo(()=>flattenFeatureItems([...defaultGeometry,...features,...parts]),[defaultGeometry,features,parts]);
  const history = useMemo(()=>flattenFeatureItems(features).filter(item=>item.kind === "feature"),[features]);
  const cutoff = Math.max(0,Math.min(history.length,rollbackIndex ?? history.length));
  const get = (id:string) => all.find(item=>item.id === id);
  const selectedFor = (id:string) => (selectedIDs.has(id) ? all.filter(item=>selectedIDs.has(item.id)) : all.filter(item=>item.id === id));
  const can = (request:FeatureTreeRequest) => !(filtered && ["move","add-to-folder","new-folder","rollback"].includes(request.command)) && !!onCommand && availableCommands.includes(request.command) && (canCommand?.(request) ?? true) === true;
  const dispatch = (request:FeatureTreeRequest) => { if(can(request))onCommand?.(request); };
  const actions = (id:string) => {
    const item=get(id);return item ? featureTreeActions(item,{selected:selectedFor(id),features,rollbackIndex:cutoff,available:onCommand ? availableCommands:NO_COMMANDS,canCommand:request=>filtered && ["move","add-to-folder","new-folder","rollback"].includes(request.command)?"Clear the filter before changing history order.":canCommand?.(request)??true}) : [];
  };
  const run = (id:string,commandID:string) => {
    const action=actions(id).find(action=>action.item.id === commandID);
    if(!action || action.item.disabled)return;
    if(action.request.command === "rename")setRenaming(id);else dispatch(action.request);
  };
  function present(items:readonly FeatureTreeItem[]):TreeNode[] {
    return items.map(item=>{
      const index=history.findIndex(row=>row.id === item.id), rolledBack=index >= cutoff && index >= 0;
      const visibility:FeatureTreeRequest={command:"visibility",ids:[item.id],value:!!item.hidden};
      return {id:item.id,label:item.label,category:item.type,searchText:item.type,draggable:!filtered && (item.kind === "feature" || item.kind === "folder") && availableCommands.includes("move"),dropMode:item.kind === "folder"?"hierarchy":"reorder",icon:item.icon ?? <FeatureTypeIcon type={item.type}/>,
        dimmed:item.hidden || item.suppressed || rolledBack,tone:item.error?"error":undefined,
        className:["aui-feature-tree-item",item.suppressed?"aui-feature-tree-item--suppressed":"",rolledBack?"aui-feature-tree-item--rolled-back":""].join(" "),
        status:[...(item.dimensionsShown?[{id:"dimensions",label:"Dimensions shown",icon:<AetherIcon name="ruler"/>}]:[]),...(item.dynamicSuppression?[{id:"dynamic",label:"Dynamic suppression",icon:<AetherIcon name="settings"/>}]:[]),...(item.suppressed?[{id:"suppressed",label:"Suppressed",icon:<AetherIcon name="pause"/>}]:[]),...(rolledBack?[{id:"rollback",label:"Rolled back",icon:<AetherIcon name="history"/>}]:[]),...(item.error?[{id:"error",label:item.error,icon:<AetherIcon name="status-error"/>}]:[])],
        actions:can(visibility)?[{id:"visibility",label:`${item.hidden?"Show":"Hide"} ${item.label}`,icon:<AetherIcon name={item.hidden?"hidden":"visible"}/>,pinned:!!item.hidden,state:true}]:[],
        children:item.children && present(item.children)};
    });
  }
  const historyNodes=present(features);
  if(rollbackIndex !== undefined && !filtered){
    let remaining=cutoff,inserted=false;
    const line:TreeNode={id:ROLLBACK,label:`Rollback: ${cutoff} of ${history.length} features`,variant:"divider",draggable:availableCommands.includes("rollback"),className:"aui-feature-tree-rollback"};
    const place=(rows:TreeNode[])=>{for(let i=0;i<rows.length;i++){
      if(rows[i].children){const children=[...rows[i].children!];place(children);rows[i]={...rows[i],children};if(inserted)return;}
      else if(get(rows[i].id)?.kind === "feature"){if(remaining===0){rows.splice(i,0,line);inserted=true;return;}remaining--;}
    }};
    place(historyNodes);if(!inserted)historyNodes.push(line);
  }
  const canMove=(sourceID:string,targetID:string,position:TreeMovePosition)=>{
    if(filtered)return false;
    const source=get(sourceID),target=get(targetID);
    if(sourceID === ROLLBACK)return target?.kind === "feature" && position !== "inside" && can({command:"rollback",ids:[],index:history.findIndex(row=>row.id===targetID)+(position === "after"?1:0)});
    if(!source || !target || sourceID===targetID || source.kind === "reference" || source.kind === "part" || target.kind === "reference" || target.kind === "part")return false;
    if(position === "inside" && target.kind !== "folder")return false;
    if(flattenFeatureItems(source.children ?? []).some(item=>item.id === targetID))return false;
    return can({command:"move",ids:[sourceID],targetID,position});
  };
  const move=(sourceID:string,targetID:string,position:TreeMovePosition)=>{
    if(!canMove(sourceID,targetID,position))return;
    dispatch(sourceID === ROLLBACK ? {command:"rollback",ids:[],index:history.findIndex(row=>row.id===targetID)+(position === "after"?1:0)} : {command:"move",ids:[sourceID],targetID,position});
  };
  const selection=all.filter(item=>selectedIDs.has(item.id)),single=selection.length===1?selection[0]:undefined;
  const controls:TreeControl[]=[
    {id:"new-folder",label:"New folder",icon:<AetherIcon name="folder-add"/>,disabled:!can({command:"new-folder",ids:[]}),onClick:()=>dispatch({command:"new-folder",ids:[]})},
    {id:"rename",label:"Rename",icon:<AetherIcon name="pencil"/>,shortcut:"F2",disabled:!single || single.kind === "reference" || !can({command:"rename",ids:[single.id]}),onClick:()=>single&&setRenaming(single.id)},
    {id:"delete",label:"Delete",icon:<AetherIcon name="delete"/>,shortcut:"Delete",disabled:!selection.length || selection.some(item=>item.kind === "reference") || !can({command:"delete",ids:selection.map(item=>item.id)}),onClick:()=>dispatch({command:"delete",ids:selection.map(item=>item.id)})},
  ];
  const common={selectedIDs,onSelect:(ids:readonly string[],mode:"single"|"toggle"|"range")=>{const rows=ids.filter(id=>id!==ROLLBACK&&id!==GEOMETRY);if(rows.length)onSelect(rows,mode);},
    menuItems:(id:string)=>featureTreeMenuItems(actions(id)),onCommand:run,onAction:(id:string)=>{const item=get(id);if(item)dispatch({command:"visibility",ids:[id],value:!!item.hidden});},
    onActivate:(id:string)=>run(id,"edit"),renamingID:renaming,onCancelRename:()=>setRenaming(null),
    onRename:(id:string,name:string)=>{if(name.trim())dispatch({command:"rename",ids:[id],name:name.trim()});setRenaming(null);},controls:controls.slice(1),controlsLabel:"Feature commands"};
  return <div className={`aui-feature-tree ${className}`} onKeyDownCapture={event=>{
    if(!(event.target instanceof HTMLElement)||!event.target.classList.contains("aui-feature-tree-rollback"))return;
    const index=event.key === "ArrowUp"?cutoff-1:event.key === "ArrowDown"?cutoff+1:event.key === "Home"?0:event.key === "End"?history.length:null;
    if(index !== null){event.preventDefault();event.stopPropagation();dispatch({command:"rollback",ids:[],index:Math.max(0,Math.min(history.length,index))});}
  }}>
    <TreePanelSplit defaultRatio={0.78} primaryLabel={ariaLabel} secondaryLabel={partsLabel} storageKey={storageKey} primary={<TreePanel {...common}
      title={`Features (${history.length})`} ariaLabel={ariaLabel} menuLabel="Feature actions" filterLabel="Filter by name or type" filter={query} onFilterChange={onFilterChange ?? setLocalFilter}
      onCategoryChange={setCategory} filterOptions={[...new Set(history.map(item=>item.type))].map(type=>({id:type,label:type.charAt(0).toUpperCase()+type.slice(1),icon:<FeatureTypeIcon type={type}/>}))}
      controls={controls} headerControls={controls.slice(0,1)}
      nodes={[{id:GEOMETRY,draggable:false,label:"Default geometry",icon:<AetherIcon name="planes-axes"/>,children:present(defaultGeometry)},...historyNodes]}
      onMove={move} canMove={canMove} emptyState="No matching features"/>
    } secondary={<TreePanel {...common} title={`${partsLabel} (${parts.length})`} ariaLabel={partsLabel} menuLabel="Part actions" showFilter={false} filter={query} nodes={present(parts)} emptyState="No parts"/>}/>

  </div>;
}

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AetherIcon } from "./AetherIcon";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { IconButton } from "./IconButton";
import { MenuButton } from "./Menu";
import { SearchField } from "./SearchField";
import { useOverlayHost } from "./OverlayScope";
import type { CollaborationItem, DocumentCollaboration } from "./DocumentServices";
import "./ActionItemsView.css";

type ItemType = "tasks" | "reminders";
interface Props {
  documentKey: string; state: DocumentCollaboration | null;
  busy: boolean; error: string; conflicted: boolean; conflict: ReactNode;
  editing: string | null; collection: ItemType; text: string; due: string; assignee: string;
  onCollection: (value: ItemType) => void;
  onText: (value: string) => void; onDue: (value: string) => void; onAssignee: (value: string) => void;
  onSubmit: () => Promise<boolean>; onCancel: () => void;
  onEdit: (item: CollaborationItem, type: ItemType) => void;
  onRemove: (item: CollaborationItem, type: ItemType) => void;
  onStatus: (item: CollaborationItem, type: ItemType, status: string) => void;
}
export function ActionItemsView(props: Props) {
  const {state,busy}=props;
  const [query,setQuery]=useState(""), [type,setType]=useState("all"), [status,setStatus]=useState("all");
  const [assignee,setAssignee]=useState("me"), [dueFilter,setDueFilter]=useState("all"), [sort,setSort]=useState("updated");
  const [open,setOpen]=useState(false);
  const host=useOverlayHost(), latest=useRef(props); latest.current=props;
  const close=useCallback(()=>{if(!latest.current.busy){setOpen(false);latest.current.onCancel();}},[]);
  useEffect(()=>{setOpen(false);setQuery("");setType("all");setStatus("all");setAssignee("me");setDueFilter("all");},[props.documentKey]);
  const person=(id?:string)=>state?.members.find(member=>member.id===id)?.name??"Former member";
  const owner=(item:CollaborationItem)=>state?.actor===state?.owner||state?.actor===item.author;
  const dateKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  const today=dateKey(new Date()), nextWeek=new Date();nextWeek.setDate(nextWeek.getDate()+7);
  const rows=(["tasks","reminders"] as const).flatMap(collection=>(state?.[collection]??[]).map(item=>({item,collection})))
    .filter(({item,collection})=>!item.deleted&&(type==="all"||type===collection)&&(status==="all"||item.status===status)
      &&(assignee==="all"||item.assignee===(assignee==="me"?state?.actor:assignee))
      &&(!query.trim()||`${item.text} ${person(item.assignee)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
      &&(dueFilter==="all"||(dueFilter==="none"?!item.due:dueFilter==="overdue"?!!item.due&&item.due<today&&item.status!=="done":!!item.due&&item.due>=today&&item.due<=dateKey(nextWeek)&&item.status!=="done")))
    .sort((a,b)=>sort==="name"?a.item.text.localeCompare(b.item.text):sort==="due"?(a.item.due||"9999").localeCompare(b.item.due||"9999"):b.item.updated-a.item.updated);
  const filtersActive=!!query||type!=="all"||status!=="all"||assignee!=="all"||dueFilter!=="all";
  return <section className="aui-action-items" aria-label="Action items">
    <header className="aui-action-items-header"><h3>Action items</h3>
      <MenuButton label="Sort action items" items={[
        {id:"updated",label:"Recently updated",icon:<AetherIcon name="history"/>,kind:"radio",checked:sort==="updated"},
        {id:"due",label:"Due date",icon:<AetherIcon name="stopwatch"/>,kind:"radio",checked:sort==="due"},
        {id:"name",label:"Name",icon:<AetherIcon name="text"/>,kind:"radio",checked:sort==="name"},
      ]} onSelect={setSort}><AetherIcon name="sort-chevron"/></MenuButton>
      <IconButton label="Create action item" disabled={!state||busy} onClick={()=>{props.onCancel();props.onCollection(type==="reminders"?"reminders":"tasks");setOpen(true);}}><AetherIcon name="document-add"/></IconButton>
    </header>
    <div className="aui-action-items-tools">
      <SearchField value={query} onQueryChange={setQuery} ariaLabel="Search in Action items" placeholder="Search in Action items"/>
      <div className="aui-action-items-filters">
        <select aria-label="Action item type" title="Type" value={type} onChange={event=>setType(event.target.value)}><option value="all">Type</option><option value="tasks">Tasks</option><option value="reminders">Reminders</option></select>
        <select aria-label="Action item status" title="Status" value={status} onChange={event=>setStatus(event.target.value)}><option value="all">Status</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="done">Completed</option></select>
        <div className="aui-action-assignee"><select aria-label="Action item assignee" title="Assignee" value={assignee} onChange={event=>setAssignee(event.target.value)}><option value="all">Assignee</option><option value="me">Me</option>{state?.members.map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select>{assignee!=="all"&&<span aria-label="1 assignee filter">1</span>}</div>
        <MenuButton label="Due date filter" items={[
          {id:"all",label:"Any due date",kind:"radio",checked:dueFilter==="all",icon:<AetherIcon name="stopwatch"/>},
          {id:"overdue",label:"Overdue",kind:"radio",checked:dueFilter==="overdue",icon:<AetherIcon name="stopwatch"/>},
          {id:"week",label:"Due in the next 7 days",kind:"radio",checked:dueFilter==="week",icon:<AetherIcon name="stopwatch"/>},
          {id:"none",label:"No due date",kind:"radio",checked:dueFilter==="none",icon:<AetherIcon name="document"/>},
        ]} onSelect={setDueFilter}><AetherIcon name={dueFilter==="all"?"plus-square":"filter"}/></MenuButton>
        <IconButton label="Clear action item filters" disabled={!filtersActive} onClick={()=>{setQuery("");setType("all");setStatus("all");setAssignee("all");setDueFilter("all");}}><AetherIcon name="close"/></IconButton>
      </div>
    </div>
    {props.error&&!open&&<p className="aui-action-items-error" role="alert">{props.error}</p>}
    <div className="aui-action-items-body">
      {!state?<p role="status">Loading action items…</p>:!rows.length?<div className="aui-action-items-empty"><AetherIcon name="action-items-empty"/><p>No action items found for the current filter.</p></div>:<ul aria-label="Action item results">{rows.map(({item,collection})=><li key={`${collection}:${item.id}`}>
        <div className="aui-action-item-title"><AetherIcon name={collection==="tasks"?"tasks":"stopwatch"}/><strong>{item.text}</strong>
          {owner(item)&&<MenuButton label={`Actions for ${item.text}`} items={[
            {id:"edit",label:"Edit item",icon:<AetherIcon name="pencil"/>,disabled:busy},
            {id:"remove",label:"Remove item",icon:<AetherIcon name="delete"/>,danger:true,disabled:busy},
          ]} onSelect={id=>{if(id==="edit"){props.onEdit(item,collection);setOpen(true);}else props.onRemove(item,collection);}}><AetherIcon name="more"/></MenuButton>}
        </div>
        <small>{collection==="tasks"?"Task":"Reminder"} · {person(item.assignee)}{item.due?` · Due ${item.due}${item.due<today&&item.status!=="done"?" · Overdue":""}`:""}</small>
        <select aria-label={`Status for ${item.text}`} value={item.status??"open"} disabled={busy||!(owner(item)||state.actor===item.assignee)} onChange={event=>props.onStatus(item,collection,event.target.value)}><option value="open">Open</option><option value="in_progress">In progress</option><option value="done">Completed</option></select>
      </li>)}</ul>}
    </div>
    {open&&createPortal(<div className="aui-action-item-dialog"><Dialog open title={props.editing?"Edit action item":"Create action item"} onClose={close}>
      {props.error&&<p role="alert">{props.error}</p>}{props.conflict}
      <form onSubmit={event=>{event.preventDefault();void props.onSubmit().then(ok=>{if(ok){setOpen(false);setQuery("");setType("all");setStatus("all");setAssignee("all");setDueFilter("all");}});}}>
        <label>Type<select aria-label="New action item type" value={props.collection} disabled={busy||!!props.editing} onChange={event=>props.onCollection(event.target.value as ItemType)}><option value="tasks">Task</option><option value="reminders">Reminder</option></select></label>
        <label>Description<textarea aria-label="Action items text" value={props.text} disabled={busy} maxLength={1000} rows={4} onChange={event=>props.onText(event.target.value)}/></label>
        <label>Due date<input aria-label="Due date" type="date" value={props.due} disabled={busy} onChange={event=>props.onDue(event.target.value)}/></label>
        <label>Assigned to<select aria-label="Assigned to" value={props.assignee||state?.actor||""} disabled={busy} onChange={event=>props.onAssignee(event.target.value)}>{state?.members.map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
        <div className="aui-action-item-buttons"><Button primary type="submit" disabled={busy||props.conflicted||!props.text.trim()}>{props.editing?"Save changes":props.collection==="tasks"?"Add task":"Add reminder"}</Button><Button disabled={busy} onClick={close}>Cancel</Button></div>
      </form>
    </Dialog></div>,host??document.body)}
  </section>;
}

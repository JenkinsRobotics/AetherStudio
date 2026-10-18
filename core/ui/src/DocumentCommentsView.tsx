import { useEffect, useRef, useState, type ReactNode } from "react";
import { SelectField } from "./SelectField";
import { AetherIcon } from "./AetherIcon";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { Menu, type MenuItem } from "./Menu";
import { Popover } from "./Popover";
import type { CollaborationItem, CommentImage, DocumentCollaboration, DocumentConnection, DocumentHistory } from "./DocumentServices";
import { commentImage, commentScreenshot } from "./comment-images";
import "./DocumentCommentsView.css";

export interface CommentsViewProps {
  connection: DocumentConnection; state: DocumentCollaboration | null;
  draftReset: number; text: string; editing: string | null; reply: string | null;
  busy: boolean; error: string; conflicted: boolean; conflict: ReactNode;
  following: boolean; onFollowing:(value:boolean)=>void;
  onText:(text:string)=>void; onCancel:()=>void;
  onSubmit:(metadata:Record<string,unknown>)=>Promise<boolean>;
  onEdit:(item:CollaborationItem)=>void; onReply:(item:CollaborationItem)=>void;
  onRemove:(item:CollaborationItem)=>void;
  onResolve:(item:CollaborationItem)=>void;
}
const when = (seconds:number) => {
  const date=new Date(seconds*1000), today=new Date();
  const time=date.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});
  return `${time} ${date.toDateString()===today.toDateString()?"Today":date.toLocaleDateString()}`;
};

/** The shared comment surface; mutation/conflict handling stays in its controller. */
export function DocumentCommentsView(props:CommentsViewProps) {
  const {connection,state,text,editing,reply,busy,error,conflict,conflicted}=props;
  const [filter,setFilter]=useState("all"), [scope,setScope]=useState(connection.branch??"Main");
  const [images,setImages]=useState<CommentImage[]>([]), [revision,setRevision]=useState<number|undefined>();
  const [history,setHistory]=useState<DocumentHistory|null>(null), [tagOpen,setTagOpen]=useState(false);
  const [imageError,setImageError]=useState(""), [capturing,setCapturing]=useState(false);
  const [menu,setMenu]=useState<{item:CollaborationItem;anchor:HTMLElement}|null>(null);
  const tagAnchor=useRef<HTMLDivElement>(null), fileInput=useRef<HTMLInputElement>(null), editor=useRef<HTMLTextAreaElement>(null);
  const captureGeneration=useRef(0);
  useEffect(()=>{
    let live=true;
    setScope(connection.branch??"Main");setImages([]);setRevision(undefined);setImageError("");setTagOpen(false);setMenu(null);setHistory(null);
    void connection.call<DocumentHistory>("history").then(h=>{if(live)setHistory(h);}).catch(()=>{});
    return()=>{live=false;captureGeneration.current++;};
  },[connection.key]);
  useEffect(()=>{
    captureGeneration.current++;
    const item=state?.comments.find(i=>i.id===editing);
    setImages(item?.attachments??[]);setRevision(item?.revision);setImageError("");
    if(editing||reply)editor.current?.focus();
  },[editing,reply,props.draftReset]);
  const clear = () => {captureGeneration.current++;props.onCancel();setImages([]);setRevision(undefined);setImageError("");};
  const addImage=async(load:()=>Promise<CommentImage>)=>{
    if(images.length>=3){setImageError("Attach up to three images.");return;}
    const generation=captureGeneration.current;
    setCapturing(true);setImageError("");
    try {const image=await load();if(generation===captureGeneration.current)setImages(old=>[...old,image].slice(0,3));}
    catch(e){if(generation===captureGeneration.current && (e as Error).name!=="NotAllowedError")setImageError((e as Error).message);}
    finally {setCapturing(false);}
  };
  const branches=[...new Set(["Main",connection.branch??"Main",...(history?.branches.map(b=>b.name)??[]),...(state?.comments.map(i=>i.branch??"Main")??[])])];
  const person=(id:string)=>state?.members.find(member=>member.id===id);
  const allowed=(item:CollaborationItem)=>item.author===state?.actor||state?.actor===state?.owner;
  const threads=state?.comments.filter(item=>!item.parent && (!item.deleted || state.comments.some(c=>c.parent===item.id&&!c.deleted)) &&
    (scope==="*"||(item.branch??"Main")===scope) && (filter==="all"||(filter==="resolved"?item.resolved:!item.resolved)))??[];
  const options:MenuItem[]=menu?[{id:"edit",label:"Edit comment",icon:<AetherIcon name="pencil"/>,disabled:busy},{id:"remove",label:"Remove comment",icon:<AetherIcon name="delete"/>,disabled:busy,danger:true}]:[];
  const renderComment=(item:CollaborationItem,child=false):ReactNode=>{
    const author=person(item.author), name=author?.name??"Former member";
    return <li key={item.id} className={child?"aui-comment-reply":undefined} data-resolved={item.resolved||undefined}>
      <article aria-label={`Comment by ${name}`}>
        <header className="aui-comment-author">
          {author?.avatar?<img className="aui-comment-avatar" src={author.avatar} alt=""/>:<span className="aui-comment-avatar" aria-hidden="true">{name.split(/\s+/).slice(0,2).map(part=>part[0]).join("")}</span>}
          <div><strong>{name}</strong><time dateTime={new Date(item.created*1000).toISOString()}>{when(item.created)}{item.updated>item.created?" · Edited":""}</time></div>
          {!child&&!item.deleted&&<input type="checkbox" aria-label={item.resolved?"Reopen discussion":"Resolve discussion"} title={item.resolved?"Reopen discussion":"Resolve discussion"} checked={!!item.resolved} disabled={busy||!allowed(item)} onChange={()=>props.onResolve(item)}/>}
          {!item.deleted&&allowed(item)&&<IconButton className="aui-comment-more" label="Comment actions" aria-haspopup="menu" onClick={e=>setMenu({item,anchor:e.currentTarget})}><AetherIcon name="more"/></IconButton>}
        </header>
        <p className="aui-comment-text">{item.deleted?"Comment removed":item.text}</p>
        {!item.deleted&&!!item.attachments?.length&&<div className="aui-comment-images">{item.attachments.map((image,i)=><a key={i} href={image.data_url} download={image.name} title={`Download ${image.name}`}><img src={image.data_url} alt={image.name}/></a>)}</div>}
        <footer className="aui-comment-footer">
          {!child&&!item.deleted&&<button type="button" className="aui-comment-link" disabled={busy} onClick={()=>props.onReply(item)}>Reply</button>}
          <span className="aui-comment-workspace" title={item.revision?item.reference_name??"Saved state":undefined}><AetherIcon name={item.revision?"price-tag":"workspace"}/>{item.reference_name||(item.branch??"Main")}</span>
        </footer>
      </article>
      {!child&&<ol aria-label={`Replies to ${name}`}>{state?.comments.filter(c=>c.parent===item.id&&!c.deleted).map(c=>renderComment(c,true))}</ol>}
    </li>;
  };
  return <section className="aui-comments-panel" aria-label="Comments">
    <header className="aui-comments-header"><h3>Comments</h3><IconButton label={props.following?"Pause live comment updates":"Follow live comment updates"} aria-pressed={props.following} disabled={!state} onClick={()=>props.onFollowing(!props.following)}><AetherIcon name="bell"/></IconButton></header>
    <div className="aui-comments-filters">
      <SelectField title="Workspace" aria-label="Comments workspace" icon={<AetherIcon name="workspace"/>}
        value={scope} onChange={e=>setScope(e.target.value)}
        options={[{value:"*",label:"All workspaces"},...branches.map(branch=>({value:branch,label:branch}))]}/>
      <SelectField aria-label="Comments filter" icon={<AetherIcon name="filter"/>}
        value={filter} onChange={e=>setFilter(e.target.value)}
        options={[{value:"all",label:"All"},{value:"open",label:"Open"},{value:"resolved",label:"Resolved"}]}/>
    </div>
    {(error||imageError)&&<p className="aui-comments-error" role="alert">{imageError||error}</p>}
    {conflict}
    <form aria-label="Comment composer" className="aui-comments-composer" onSubmit={e=>{e.preventDefault();void props.onSubmit({branch:connection.branch??"Main",revision:revision??null,attachments:images}).then(ok=>{if(ok){setImages([]);setRevision(undefined);setImageError("");}});}}>
      {(reply||editing)&&<small>{editing?"Editing comment":`Replying to ${person(state?.comments.find(i=>i.id===reply)?.author??"")?.name??"discussion"}`}</small>}
      <textarea ref={editor} aria-label="Comments text" placeholder="Add a comment…" value={text} onChange={e=>props.onText(e.target.value)} rows={3} maxLength={10000}/>
      <div className="aui-comments-compose-tools">
        <div ref={tagAnchor}><IconButton label="Tag a saved state" aria-haspopup="dialog" aria-expanded={tagOpen} disabled={busy} onClick={()=>{setTagOpen(!tagOpen);void connection.call<DocumentHistory>("history").then(setHistory).catch(e=>setImageError(e.message));}}><AetherIcon name="price-tag"/></IconButton></div>
        <IconButton label="Attach screenshot" disabled={busy||capturing||images.length>=3} onClick={()=>void addImage(commentScreenshot)}><AetherIcon name="screenshot"/></IconButton>
        <IconButton label="Attach image" disabled={busy||capturing||images.length>=3} onClick={()=>fileInput.current?.click()}><AetherIcon name="image"/></IconButton>
        <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Comment image file" hidden onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void addImage(()=>commentImage(file));}}/>
      </div>
      {revision!=null&&<div className="aui-comment-reference"><AetherIcon name="price-tag"/>{history?.versions.find(v=>v.revision===revision)?.name??"Saved state"}<IconButton label="Remove saved-state tag" onClick={()=>setRevision(undefined)}><AetherIcon name="close"/></IconButton></div>}
      {!!images.length&&<div className="aui-comment-draft-images">{images.map((image,i)=><div key={i}><img src={image.data_url} alt={image.name}/><IconButton label={`Remove ${image.name}`} onClick={()=>setImages(old=>old.filter((_,index)=>index!==i))}><AetherIcon name="close"/></IconButton></div>)}</div>}
      <div className="aui-comments-submit"><Button primary type="submit" disabled={busy||capturing||conflicted||!state||!text.trim()}>{editing?"Save":reply?"Reply":"Add"}</Button><Button disabled={busy} onClick={clear}>Cancel</Button>{capturing&&<small role="status">Preparing image…</small>}</div>
    </form>
    {!state&&<p role="status">Loading comments…</p>}
    <ol className="aui-comments-list" aria-label="Discussions">{threads.map(item=>renderComment(item))}</ol>
    <Menu open={!!menu} anchor={menu?.anchor??null} ariaLabel="Comment actions" items={options} onSelect={id=>{if(menu){if(id==="edit")props.onEdit(menu.item);else props.onRemove(menu.item);}setMenu(null);}} onClose={()=>setMenu(null)}/>
    <Popover open={tagOpen} anchor={tagAnchor.current} ariaLabel="Tag a saved state" className="aui-comment-tag-picker" onClose={()=>setTagOpen(false)}>
      <label>Saved state<select aria-label="Saved-state tag" value={revision??""} onChange={e=>setRevision(e.target.value?Number(e.target.value):undefined)}><option value="">No tag</option>{history?.branches.map(b=><option key={`branch:${b.name}`} value={b.head_revision}>{b.name} · current saved state</option>)}{history?.versions.map(v=><option key={`version:${v.name}`} value={v.revision}>{v.name}</option>)}</select></label>
      <Button onClick={()=>setTagOpen(false)}>Done</Button>
    </Popover>
  </section>;
}

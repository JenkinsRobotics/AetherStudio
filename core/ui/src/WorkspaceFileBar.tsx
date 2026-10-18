import {useState, type ReactNode} from 'react';
import {AetherIcon} from './AetherIcon';
import {MenuButton} from './Menu';
import {Button} from './Button';
import {Dialog} from './Dialog';
import {DocumentTabs, type DocumentTabsProps} from './DocumentTabs';
import {DocumentFileManager, type DocumentFileManagerProps} from './DocumentFileManager';
import {FileManagerPanel} from './FileManagerPanel';
import './DocumentTabBar.css';
import './WorkspaceFileBar.css';

export interface WorkspaceFileBarProps extends DocumentTabsProps {
  manager: DocumentFileManagerProps;
  onAdd: () => void;
  addLabel?: string;
  trailing?: ReactNode;
  /** Product file menu, placed with the contents/library controls on the right. */
  fileActions?: ReactNode;
}
/** Shared bottom document strip. Products retain save, create and navigation semantics. */
export function WorkspaceFileBar({manager,onAdd,addLabel='Create new document',trailing,fileActions,...tabs}:WorkspaceFileBarProps) {
 const [open,setOpen]=useState(false),[library,setLibrary]=useState(false);
 const [error,setError]=useState('');
 const groups=manager.documentGroups?.length ? manager.documentGroups : [{id:'open',label:'Open files',items:tabs.tabs.map(tab=>({id:tab.id,name:tab.label,kind:'file' as const,icon:tab.icon}))}];
 const manage=()=>{setLibrary(false);setError('');setOpen(true);};
 return <>
  <div className="aui-document-tabbar aui-document-tray" data-placement="bottom">
   <div className="aui-document-tray-heading">Open files</div>
   <div className="aui-tab-add-group">
    <button type="button" className="aui-document-tabbar-add aui-menu-trigger" aria-label={addLabel} title={addLabel} onClick={onAdd}><AetherIcon name="plus"/></button>
    <MenuButton className="aui-tab-add-menu" label="Add options" placement="top-start" anchorTo="group" items={[{id:'add',label:addLabel,icon:<AetherIcon name="plus"/>},{id:'manage',label:'Manage files…',icon:<AetherIcon name="folder"/>}]} onSelect={id=>id==='add'?onAdd():manage()}><AetherIcon name="chevron" style={{transform:'rotate(90deg)'}}/></MenuButton>
   </div>
   <DocumentTabs {...tabs} onClose={undefined} renderTabActions={tabs.renderTabActions ?? (tab=><MenuButton className="aui-tab-menu" label={`Options for ${tab.label}`} placement="top-end"
    items={[...(tabs.onReorder?[{id:'left',label:'Move left',disabled:tabs.tabs.indexOf(tab)===0},{id:'right',label:'Move right',disabled:tabs.tabs.indexOf(tab)===tabs.tabs.length-1}]:[]),{id:'manage',label:'Manage files…',icon:<AetherIcon name="folder"/>},...(tabs.onClose?[{id:'close',label:'Close tab',disabled:tab.pinned&&!tabs.allowClosePinned,separatorBefore:true}]:[])]}
    onSelect={id=>{const index=tabs.tabs.indexOf(tab);if(id==='close')tabs.onClose?.(tab.id);else if(id==='manage')manage();else {const target=tabs.tabs[index+(id==='left'?-1:1)];if(target)tabs.onReorder?.(tab.id,target.id);}}}><AetherIcon name="chevron" style={{transform:'rotate(90deg)'}}/></MenuButton>)}/>{trailing}
   <div className="aui-document-tray-actions">
    {fileActions}
    <button type="button" className="aui-document-tabbar-add aui-menu-trigger" aria-label="Manage folders and files" title="Folders and files" onClick={()=>{setError('');setLibrary(true);setOpen(true);}}><AetherIcon name="folder"/></button>
    <button type="button" className="aui-document-tabbar-add aui-menu-trigger" aria-label="Part manager" title="Document contents" onClick={manage}><AetherIcon name="part-manager"/></button>
   </div>
  </div>
  <Dialog open={open} title="File manager" onClose={()=>setOpen(false)} actions={<Button onClick={()=>setLibrary(!library)}>{library?'Document contents':'Open from library…'}</Button>}>
   <div className="aui-workspace-files">
    {error&&<p role="alert">{error}</p>}
    {open && (library ? <DocumentFileManager {...manager}/> : <FileManagerPanel showLibrary={false} ariaLabel="Document contents" documentName={manager.connection.name} documentGroups={groups} activeID={manager.activeID??tabs.activeID} onOpen={async item=>{
     try {if(manager.documentGroups?.length) await manager.onOpenItem?.(item);else tabs.onSelect(item.id);setOpen(false);}catch(e){setError(e instanceof Error?e.message:String(e));}
    }}/>) }
   </div>
  </Dialog>
 </>;
}

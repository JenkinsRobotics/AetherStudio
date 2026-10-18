import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
import {WorkspaceFileBar} from './WorkspaceFileBar';
afterEach(cleanup);
test('manager follows tabs and opens current contents without fetching library',async()=>{
 const call=vi.fn(async()=>({files:[]})), add=vi.fn(), selected=vi.fn();
 const connection={key:'map:1',name:'Show',flush:async()=>{},reload:async()=>{},call} as any;
 render(<WorkspaceFileBar tabs={[{id:'show',label:'Show'}]} activeID="show" onSelect={()=>{}} onAdd={add}
  manager={{connection,documentGroups:[{id:'scenes',label:'Scenes',items:[{id:'scene',name:'Lobby',kind:'scene'}]}],onOpenItem:selected}}/>);
 const buttons=screen.getAllByRole('button');expect(buttons.at(-1)?.getAttribute('aria-label')).toBe('Part manager');
 fireEvent.click(screen.getByRole('button',{name:'Create new document'}));expect(add).toHaveBeenCalledOnce();
 fireEvent.click(screen.getByRole('button',{name:'Part manager'}));expect(screen.getByRole('dialog',{name:'File manager'})).toBeTruthy();expect(call).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Lobby'}));expect(selected).toHaveBeenCalledWith(expect.objectContaining({id:'scene'}));
});

test('shared tray exposes add and tab menus with compact status',()=>{
 const close=vi.fn(), add=vi.fn();const connection={key:'show',name:'Show',call:vi.fn(),flush:async()=>{},reload:async()=>{}} as any;
 const {container}=render(<WorkspaceFileBar tabs={[{id:'show',label:'Show',status:'Saved'}]} activeID="show" onSelect={()=>{}} onAdd={add} onClose={close} manager={{connection}}/>);
 expect(screen.getByText('Open files')).toBeTruthy();expect(container.querySelector('[data-save-tone="saved"]')?.textContent).toBe('Saved');
 fireEvent.click(screen.getByRole('button',{name:'Options for Show'}));fireEvent.click(screen.getByRole('menuitem',{name:'Close tab'}));expect(close).toHaveBeenCalledWith('show');
 fireEvent.click(screen.getByRole('button',{name:'Add options'}));fireEvent.click(screen.getByRole('menuitem',{name:'Create new document'}));expect(add).toHaveBeenCalledOnce();
});

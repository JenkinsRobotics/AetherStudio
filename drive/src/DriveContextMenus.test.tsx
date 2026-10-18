import {expect, test} from 'vitest';
import {driveBackgroundMenu} from './DriveContextMenus';
test('background controls have icons and show the selected view and sort direction',()=>{
 const items=driveBackgroundMenu({creation:[],canCreate:true,grid:true,details:true,selected:0,count:0,busy:false,sort:'modified',ascending:false});
 const all=items.flatMap(item=>[item,...item.children??[]]);
 expect(all.every(item=>!!item.icon)).toBe(true);
 expect(all.find(item=>item.id==='sort:modified')?.checked).toBe(true);
 expect(all.find(item=>item.id==='sort:name')?.checked).toBe(false);
 expect(all.find(item=>item.id==='order:descending')?.checked).toBe(true);
 expect(all.find(item=>item.id==='view-grid')?.checked).toBe(true);
 expect(all.find(item=>item.id==='details')?.checked).toBe(true);
 expect(all.find(item=>item.id==='select-all')?.disabled).toBe(true);
 expect(all.find(item=>item.id==='clear-selection')?.disabled).toBe(true);
});

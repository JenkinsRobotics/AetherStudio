import {render} from '@testing-library/react';
import {expect,test} from 'vitest';
import {contextCommandItems} from './context-commands';
test('context groups use separators and shared icons without heading or leading divider',()=>{
 const items=contextCommandItems([{id:'undo',label:'Undo',heading:'Edit',run:()=>{}},{id:'zoom-fit',label:'Fit view',heading:'View',run:()=>{}}]);
 expect(items[0].separatorBefore).toBe(false);expect(items[1].separatorBefore).toBe(true);
 expect(items.every(item=>!item.heading)).toBe(true);
 for(const item of items){const {container,unmount}=render(<>{item.icon}</>);expect(container.querySelector('svg')).toBeTruthy();unmount();}
});

import {act,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
import {Menu} from './Menu';
afterEach(()=>vi.useRealTimers());
test('menu instructions appear after dwell and Escape dismisses them',()=>{
 vi.useFakeTimers();
 render(<Menu open anchor={{x:10,y:10}} applicationCommands={false} ariaLabel="Insert" onSelect={()=>{}} onClose={()=>{}} items={[{id:'svg',label:'SVG',help:{summary:'Editable contours',steps:['Open a sketch','Choose SVG']}}]}/>);
 const item=screen.getByRole('menuitem',{name:'SVG'});
 fireEvent.blur(item);
 fireEvent.pointerEnter(item.parentElement!);
 act(()=>vi.advanceTimersByTime(649));expect(screen.queryByRole('tooltip')).toBeNull();
 act(()=>vi.advanceTimersByTime(1));expect(screen.getByRole('tooltip').textContent).toContain('Open a sketch');
 expect(item.getAttribute('aria-describedby')).toBe(screen.getByRole('tooltip').id);
 fireEvent.keyDown(document,{key:'Escape'});expect(screen.queryByRole('tooltip')).toBeNull();
});

import {fireEvent,render,screen} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {ApplicationListHeading,ApplicationListControls,ListToolMenu} from './ApplicationList';
test('list tools use the accessible shared checked menu and dismiss after choosing',()=>{
 const pick=vi.fn();
 render(<><ApplicationListHeading>My files</ApplicationListHeading><ApplicationListControls actions={<ListToolMenu label="Sort" items={[{id:'name',label:'Name',checked:true},{id:'date',label:'Modified',checked:false}]} onPick={pick}/>}/></>);
 fireEvent.click(screen.getByRole('button',{name:'Sort'}));
 expect(screen.getByRole('menuitemradio',{name:'Name'}).getAttribute('aria-checked')).toBe('true');
 fireEvent.click(screen.getByRole('menuitemradio',{name:'Modified'}));
 expect(pick).toHaveBeenCalledWith('date');
 expect(screen.queryByRole('menu')).toBeNull();
});

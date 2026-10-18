import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ApplicationUpdates } from './ApplicationUpdates';
test('keeps planned capabilities separate from available updates',()=>{
 render(<ApplicationUpdates name="Aether Test" description="Welcome home" artwork={<span/>} updates={[{id:'future',title:'Future tool',description:'Not shipped',status:'Planned',artwork:<span/>}]}/>);
 expect(screen.getByRole('list',{name:'Aether Test updates; scroll for more'})).toBeTruthy();
 expect(screen.queryByText('Planned features are not yet available.')).toBeNull();
 expect(screen.getByText('Coming soon')).toBeTruthy();
 expect(screen.getByText('Future tool')).toBeTruthy();
});

test('scrolls wheel input without trapping boundaries or native horizontal gestures', () => {
 const { container, unmount } = render(<ApplicationUpdates name="Wheel test" description="Welcome" artwork={<span/>}/>);
 const list = container.querySelector('ul')!;
 Object.defineProperties(list, { clientWidth: { value: 400 }, scrollWidth: { value: 1200 } });
 const wheel = (init: WheelEventInit) => {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
  list.dispatchEvent(event);
  return event;
 };
 expect(wheel({ deltaY: 3, deltaMode: 1 }).defaultPrevented).toBe(true);
 expect(list.scrollLeft).toBe(48);
 expect(wheel({ deltaX: 20, deltaY: 1 }).defaultPrevented).toBe(false);
 expect(list.scrollLeft).toBe(48);
 expect(wheel({ deltaY: 20, ctrlKey: true }).defaultPrevented).toBe(false);
 expect(wheel({ deltaY: 20, shiftKey: true }).defaultPrevented).toBe(false);
 list.scrollLeft = 800;
 expect(wheel({ deltaY: 20 }).defaultPrevented).toBe(false);
 expect(wheel({ deltaY: -1, deltaMode: 2 }).defaultPrevented).toBe(true);
 expect(list.scrollLeft).toBe(400);
 list.scrollLeft = 0;
 expect(wheel({ deltaY: -20 }).defaultPrevented).toBe(false);
 unmount();
 expect(wheel({ deltaY: 20 }).defaultPrevented).toBe(false);
});

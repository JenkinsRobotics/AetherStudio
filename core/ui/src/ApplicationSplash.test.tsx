import {render,screen,cleanup} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {ApplicationSplash} from './ApplicationSplash';
afterEach(cleanup);
it('reports real caller-supplied progress and stage states',()=>{
 const {rerender}=render(<ApplicationSplash appName="Aether CAD" headline="Loading tools" progress={.45} stages={[{id:'engine',title:'Modeling engine',phase:'running'}]}/>);
 expect(screen.getByRole('progressbar').getAttribute('value')).toBe('0.45');
 expect(screen.getByText('Modeling engine')).toBeTruthy();expect(screen.getByText('Loading')).toBeTruthy();
 rerender(<ApplicationSplash appName="Aether CAD" headline="Ready" state="ready" progress={2}/>);
 expect(screen.getByRole('progressbar').getAttribute('value')).toBe('1');
 expect(screen.getByRole('region').getAttribute('aria-busy')).toBe('false');
});
it('uses indeterminate progress for unknown values and exposes actionable errors',()=>{
 render(<ApplicationSplash appName="Aether Map" headline="Unable to start" state="error" progress={NaN} actions={<button>Retry</button>}/>);
 expect(screen.getByRole('progressbar').hasAttribute('value')).toBe(false);
 expect(screen.getByRole('alert').textContent).toContain('Unable to start');expect(screen.getByRole('button',{name:'Retry'})).toBeTruthy();
});

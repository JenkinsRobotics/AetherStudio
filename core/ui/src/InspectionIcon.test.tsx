import {render} from '@testing-library/react';
import {expect,test} from 'vitest';
import {InspectionIcon} from './InspectionIcon';
test('inspection artwork is distinct and decorative',()=>{
 const art=new Set<string>();
 for(const kind of ['measure','section','interference'] as const){
  const {container,unmount}=render(<InspectionIcon kind={kind}/>);
  expect(container.querySelector('[aria-hidden=true]')).not.toBeNull();
  expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 32 32');
  art.add(container.querySelector('svg')!.innerHTML);unmount();
 }
 expect(art.size).toBe(3);
});

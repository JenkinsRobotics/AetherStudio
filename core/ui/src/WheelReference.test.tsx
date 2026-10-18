import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ComponentProps } from 'react';
import * as THREE from 'three';
import type { WheelViewport } from '../gallery/wheel-studio/WheelViewport';
import { WheelReferenceDemo, referenceInitialWheel } from '../gallery/wheel-studio/WheelReferenceDemo';
import { WheelReferenceSpecimens } from '../gallery/wheel-studio/WheelReferenceSpecimens';
import { referenceProfile, referenceWheel } from '../gallery/wheel-studio/reference-geometry';
import { disposeWheel, MM_PER_UNIT } from '../gallery/wheel-studio/geometry';
import { sectionTab } from '../gallery/showcase';
let viewport:ComponentProps<typeof WheelViewport>;
vi.mock('../gallery/wheel-studio/WheelViewport',()=>({WheelViewport:(props:ComponentProps<typeof WheelViewport>)=>{viewport=props;return <div aria-label="Live wheel rendering boundary"/>}}));
vi.mock('./ViewportNavigationCube',()=>({ViewportNavigationCube:()=> <div aria-label="View cube"/>}));
beforeEach(()=>vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}}));
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
const button=(name:string)=>screen.getByRole('button',{name});
function enter(name:string,value:string){const el=screen.getByRole('textbox',{name});fireEvent.input(el,{target:{value}});fireEvent.keyDown(el,{key:'Enter'})}
test('reference wheel has a real through bore, deep dish and distinct rounding geometry',()=>{
 const profile=referenceProfile(referenceInitialWheel),changed=referenceProfile({...referenceInitialWheel,rounding:6});expect(profile).not.toEqual(changed);expect(profile[0]).toEqual(profile.at(-1));
 const model=referenceWheel(referenceInitialWheel),mesh=model.children[0] as THREE.Mesh;mesh.geometry.computeBoundingBox();expect(mesh.geometry.boundingBox!.max.x*MM_PER_UNIT).toBeCloseTo(232,0);
 const position=mesh.geometry.getAttribute('position');let minRadius=Infinity;for(let i=0;i<position.count;i++)minRadius=Math.min(minRadius,Math.hypot(position.getX(i),position.getY(i)));expect(minRadius*MM_PER_UNIT).toBeCloseTo(24,3);
 expect(mesh.children.filter(child=>child instanceof THREE.Mesh)).toHaveLength(6);const assembly=referenceWheel(referenceInitialWheel,true);expect(assembly.children.filter(child=>child instanceof THREE.Mesh).map(child=>child.userData.part)).toEqual(['wheel','wheel','axle']);disposeWheel(model);disposeWheel(assembly);
});
test('reference dimensions convert displayed units and reach the shared live renderer',()=>{
 render(<WheelReferenceDemo/>);expect(viewport.reference).toBe(true);
 fireEvent.change(screen.getByRole('combobox',{name:'Reference units'}),{target:{value:'cm'}});fireEvent.click(button('Extrude'));enter('Reference Width','16');expect(viewport.study.width).toBe(160);enter('Reference Edge radius','.5');expect(viewport.study.rounding).toBe(5);fireEvent.click(button('Done'));
 fireEvent.click(screen.getByRole('tab',{name:/Assembly 1/}));expect(viewport.assembly).toBe(true);expect(viewport.study.width).toBe(160);
});
test('reference switches and workspace modes change the viewport without claiming CAD feature evaluation',()=>{
 render(<WheelReferenceDemo/>);fireEvent.click(screen.getByRole('switch',{name:'Show hidden lines'}));expect(viewport.hiddenLines).toBe(true);fireEvent.click(screen.getByRole('switch',{name:'Show section plane'}));expect(viewport.display.section).toBe(true);
 fireEvent.change(screen.getByRole('combobox',{name:'Reference material'}),{target:{value:'Bronze'}});expect(viewport.study.color).toBe('#b59062');fireEvent.click(screen.getByRole('radio',{name:'Simulation'}));expect(viewport.turntable).toBe(true);expect(screen.getByText('Turntable preview')).toBeTruthy();fireEvent.click(screen.getByRole('radio',{name:'Design'}));expect(viewport.turntable).toBe(false);
});
test('custom properties and comments survive inspector navigation',()=>{
 render(<WheelReferenceDemo/>);fireEvent.click(button('Add custom property'));fireEvent.change(screen.getByRole('textbox',{name:'Custom property name'}),{target:{value:'Finish code'}});fireEvent.change(screen.getByRole('textbox',{name:'Custom property value'}),{target:{value:'SB-01'}});fireEvent.click(button('Add property'));expect(screen.getByText('SB-01')).toBeTruthy();
 fireEvent.click(screen.getByRole('radio',{name:'Comments'}));fireEvent.change(screen.getByRole('textbox',{name:'Add a comment'}),{target:{value:'Review rim depth'}});fireEvent.click(button('Add comment'));fireEvent.click(screen.getByRole('radio',{name:'Properties'}));fireEvent.click(screen.getByRole('radio',{name:'Comments'}));expect(screen.getByText('Review rim depth')).toBeTruthy();
});
test('reference widgets are independently reviewable under Widgets with no app links',()=>{expect(sectionTab('Trees + hierarchies — every variant side by side')).toBe('widgets');render(<><WheelReferenceSpecimens kind="trees"/><WheelReferenceSpecimens kind="inspectors"/></>);expect(screen.getByRole('tree',{name:'Reference features'})).toBeTruthy();expect(screen.getByRole('textbox',{name:'Reference Width'})).toBeTruthy();expect(screen.queryByRole('link')).toBeNull()});

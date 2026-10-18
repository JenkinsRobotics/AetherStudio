import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AvatarStudioDemo } from "../gallery/avatar-studio/AvatarStudioDemo";
import { AvatarStudioSpecimens, MediaPreviewSpecimen } from "../gallery/avatar-studio/AvatarStudioSpecimens";
import { Annotations } from "../gallery/avatar-studio/Annotations";
import { coverRect } from "../gallery/avatar-studio/export";
import { sectionTab } from "../gallery/showcase";
import { ThumbnailPicker } from "./ThumbnailPicker";

afterEach(()=>{cleanup();vi.restoreAllMocks();});

test("the avatar demo composes the existing sidebar and toolbar and edits scene state",()=>{
  const {container}=render(<AvatarStudioDemo/>);
  expect(container.querySelector('.aui-tabbed-sidebar')).toBeTruthy();
  expect(container.querySelector('.aui-floating-toolbar')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Choose scene'}));
  fireEvent.click(screen.getByRole('button',{name:'Moonlit grove'}));
  expect(screen.getByRole('heading',{level:1}).textContent).toBe('Moonlit grove');
  fireEvent.click(screen.getByRole('button',{name:'Choose avatar'}));
  fireEvent.click(screen.getByRole('button',{name:'Graphite'}));
  const image=screen.getByRole('img',{name:'Silver-haired illustrated presenter'});
  expect(image.style.filter).toBe('grayscale(1)');
  fireEvent.change(screen.getByRole('slider',{name:'Avatar size'}),{target:{value:'120'}});
  expect(image.parentElement?.style.transform).toContain('scale(1.2)');
  fireEvent.click(screen.getByRole('checkbox',{name:'Mirror avatar'}));
  expect(image.style.transform).toBe('scaleX(-1)');
  fireEvent.click(screen.getByRole('button',{name:'Start preview'}));
  expect(container.querySelector('.aui-media-preview')?.getAttribute('data-playing')).toBe('true');
  fireEvent.click(screen.getByRole('button',{name:'Pause preview'}));
  expect(container.querySelector('.aui-media-preview')?.getAttribute('data-playing')).toBe('false');
  expect(container.querySelectorAll('[data-icon-missing]')).toHaveLength(0);
});

test("resolution menu changes the stage aspect while annotations remain editable",()=>{
  const {container}=render(<AvatarStudioDemo/>);
  fireEvent.click(screen.getByRole('button',{name:'Video resolution'}));
  fireEvent.click(screen.getByRole('menuitemradio',{name:'1080 × 1920'}));
  expect((container.querySelector('.aui-media-preview') as HTMLElement).style.aspectRatio).toBe('1080 / 1920');
  fireEvent.click(screen.getByRole('button',{name:'Add text'}));
  fireEvent.change(screen.getByRole('textbox',{name:'Overlay text'}),{target:{value:'Hello Aether'}});
  expect(container.querySelector('.avatar-annotations text')?.textContent).toBe('Hello Aether');
  fireEvent.click(screen.getByRole('button',{name:'Draw'}));
  expect(container.querySelector('.avatar-annotations')?.getAttribute('data-drawing')).toBe('true');
  fireEvent.click(screen.getByRole('button',{name:'Lock annotations'}));
  expect(container.querySelector('.avatar-annotations')?.getAttribute('data-drawing')).toBe('false');
  fireEvent.click(screen.getByRole('button',{name:'Clear annotations'}));
  expect(container.querySelector('.avatar-annotations text')).toBeNull();
});

test("drawing commits normalized points; canceled gestures leave no marks",()=>{
  vi.stubGlobal('PointerEvent',MouseEvent);
  const commit=vi.fn();
  render(<Annotations strokes={[]} caption="" color="#ff8800" brushWidth={4} aspect={2} drawing onStroke={commit}/>);
  const svg=screen.getByRole('img',{name:'Scene annotations'});
  Object.assign(svg,{setPointerCapture:vi.fn(),hasPointerCapture:()=>false,getBoundingClientRect:()=>({left:20,top:10,width:200,height:100})});
  fireEvent.pointerDown(svg,{button:0,clientX:40,clientY:30});
  fireEvent.pointerMove(svg,{clientX:120,clientY:60});
  fireEvent.pointerUp(svg,{clientX:240,clientY:140});
  expect(commit).toHaveBeenCalledWith({color:'#ff8800',width:4,points:[[.1,.2],[.5,.5],[1,1]]});
  fireEvent.pointerDown(svg,{button:0,clientX:40,clientY:30});fireEvent.pointerCancel(svg);
  expect(commit).toHaveBeenCalledTimes(1);
  vi.unstubAllGlobals();
});

test("new widgets are independent and picker disabled states are respected",()=>{
  const pick=vi.fn();const {unmount}=render(<ThumbnailPicker label="Scenes" items={[{id:'a',label:'Forest',preview:<span/>},{id:'b',label:'Unavailable',preview:<span/>,disabled:true}]} value="a" onChange={pick}/>);
  expect(screen.getByRole('button',{name:'Forest'}).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button',{name:'Unavailable'}));expect(pick).not.toHaveBeenCalled();unmount();
  render(<><AvatarStudioSpecimens kind="appearance"/><MediaPreviewSpecimen/></>);
  expect(screen.queryByRole('main')).toBeNull();
  expect(within(screen.getByRole('region',{name:'Scenes'})).getAllByRole('button')).toHaveLength(4);
  expect(screen.getByRole('group',{name:'Scene preview'})).toBeTruthy();
  expect(sectionTab('Appearance, materials + visualization — every variant side by side')).toBe('widgets');expect(sectionTab('Media preview')).toBe('widgets');
});

test("image cover sizing crops landscape artwork correctly for portrait output",()=>{
  expect(coverRect(200,100,100,200)).toEqual({x:-150,y:0,width:400,height:200});
  expect(coverRect(100,200,200,100)).toEqual({x:0,y:-150,width:200,height:400});
});

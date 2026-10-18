import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { AppLayout } from "./AppLayout";
import { ThreeColumnWireframe } from "../gallery/StandardWindowLayouts";
afterEach(cleanup);

test("outer bars surround the body and both toolbars stay within the center column", () => {
  const { container } = render(<AppLayout header="App controls" footer="Documents" center="Editor" topToolbar="Tools" bottomToolbar="View tools"/>);
  const layout = container.querySelector('.aui-app-layout')!;
  expect(layout.children[0]).toBe(screen.getByRole('banner', { name:'Header' }));
  expect(layout.children[2]).toBe(screen.getByRole('contentinfo', { name:'Footer' }));
  const center = container.querySelector('.aui-shell-main')!;
  expect(center.contains(screen.getByRole('region', { name:'Top toolbar' }))).toBe(true);
  expect(center.contains(screen.getByRole('region', { name:'Bottom toolbar' }))).toBe(true);
  expect(center.contains(screen.getByRole('main', { name:'Center' }))).toBe(true);
});

test("shared sidebar resize clamps both sides and collapse preserves inspector edits", () => {
  render(<ThreeColumnWireframe/>);
  const field = screen.getByRole('textbox', { name:'Selection name' });
  fireEvent.change(field, { target:{ value:'Edited selection' } });
  for(const side of ['left','right']) {
    const resize = screen.getByRole('separator', { name:`Resize ${side} sidebar width` });
    expect(resize.getAttribute('aria-valuenow')).toBe('280');
    expect(resize.getAttribute('aria-valuemin')).toBe('220');
    expect(resize.getAttribute('aria-valuemax')).toBe('360');
    for(let i=0;i<8;i++) fireEvent.keyDown(resize,{key:side==='left'?'ArrowRight':'ArrowLeft',shiftKey:true});
    expect(resize.getAttribute('aria-valuenow')).toBe('360');
    for(let i=0;i<8;i++) fireEvent.keyDown(resize,{key:side==='left'?'ArrowLeft':'ArrowRight',shiftKey:true});
    expect(resize.getAttribute('aria-valuenow')).toBe('220');
    fireEvent.keyDown(resize,{key:'Home'});
    expect(resize.getAttribute('aria-valuenow')).toBe('280');
  }
  fireEvent.click(screen.getByRole('button',{name:'Right'}));
  expect(screen.queryByRole('textbox',{name:'Selection name'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Right'}));
  expect((screen.getByRole('textbox',{name:'Selection name'}) as HTMLInputElement).value).toBe('Edited selection');
});

test("optional bars and variable footer content preserve the current workspace", () => {
  render(<ThreeColumnWireframe/>);
  const footer=within(screen.getByRole('contentinfo',{name:'Footer'}));
  fireEvent.click(footer.getByRole('tab',{name:'Document 2'}));
  expect(screen.getByRole('main',{name:'Center'}).textContent).toContain('Document 2');
  fireEvent.change(screen.getByRole('combobox',{name:'Footer content'}),{target:{value:'timeline'}});
  fireEvent.click(screen.getByRole('button',{name:'Play'}));
  expect(screen.getByRole('button',{name:'Pause'})).toBeTruthy();
  for(const label of ['Header','Footer','Top toolbar','Bottom toolbar']) fireEvent.click(screen.getByRole('checkbox',{name:label}));
  expect(screen.queryByRole('banner',{name:'Header'})).toBeNull();
  expect(screen.queryByRole('contentinfo',{name:'Footer'})).toBeNull();
  expect(screen.queryByRole('region',{name:'Top toolbar'})).toBeNull();
  expect(screen.queryByRole('region',{name:'Bottom toolbar'})).toBeNull();
  expect(screen.getByRole('main',{name:'Center'}).textContent).toContain('Document 2');
  fireEvent.click(screen.getByRole('checkbox',{name:'Footer'}));
  expect(screen.getByRole('button',{name:'Pause'})).toBeTruthy();
});

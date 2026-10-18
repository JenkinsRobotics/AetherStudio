// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { ApplicationContextMenu } from './ApplicationContextMenu';
import { useContextCommands } from './context-commands';
import { Menu } from './Menu';
afterEach(cleanup);
function Fixture() {
  const host = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1), [anchor, setAnchor] = useState<{ x:number; y:number } | null>(null);
  useContextCommands([{id:'undo',label:'Undo',disabled:true,run:vi.fn()}]);
  useContextCommands([{id:'zoom',label:'Zoom in',heading:'View',run:() => setZoom(z => z+1)}],host);
  return <><ApplicationContextMenu name="Test app" /><button>Chrome</button><input aria-label="Name" defaultValue="Example" />
    <div ref={host}><output>{zoom}</output><button onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setAnchor({x:e.clientX,y:e.clientY}); }}>Object</button>
    <button onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}>Native canvas</button>
    <Menu open={!!anchor} anchor={anchor} items={[{id:'delete',label:'Delete object'}]} onSelect={() => {}} onClose={() => setAnchor(null)} ariaLabel="Object actions" /></div></>;
}
describe('application context menus', () => {
  it('suppresses native menus, preserves object commands and separates scoped commands', async () => {
    render(<Fixture />);
    expect(fireEvent.contextMenu(screen.getByText('Object'), {clientX:12,clientY:24})).toBe(false);
    await screen.findByRole('menu', {name:'Object actions'});
    expect(screen.getByRole('menuitem', {name:'Delete object'})).toBeTruthy();
    expect(screen.getAllByRole('separator').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('menuitem', {name:'Zoom in'}));
    expect(screen.getByText('2')).toBeTruthy();
    fireEvent.contextMenu(screen.getByText('Chrome'));
    await screen.findByRole('menu', {name:'Aether commands'});
    expect(screen.queryByRole('menuitem', {name:'Zoom in'})).toBeNull();
    expect(screen.getByRole('menuitem', {name:'Test app settings'}).querySelector('svg')).toBeTruthy();
    expect(screen.getByRole('menuitem', {name:'Undo'}).hasAttribute('disabled')).toBe(true);
  });
  it('provides fallback even when a native canvas stops propagation', async () => {
    render(<Fixture />);
    fireEvent.contextMenu(screen.getByText('Native canvas'));
    await screen.findByRole('menu', {name:'Aether commands'});
    expect(screen.getByRole('menuitem', {name:'Zoom in'})).toBeTruthy();
  });
  it('preserves native field menus and keyboard invocation', () => {
    render(<Fixture />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus(); input.setSelectionRange(0,3);
    expect(fireEvent.contextMenu(input)).toBe(true);
    expect(fireEvent.keyDown(input,{key:'F10',shiftKey:true})).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
  });
  it('preserves selected text without triggering a product menu', () => {
    render(<Fixture />);
    const object = screen.getByText('Object');
    const range = document.createRange(); range.selectNodeContents(object);
    const selection = window.getSelection()!;
    selection.removeAllRanges(); selection.addRange(range);
    expect(fireEvent.contextMenu(object)).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
    selection.removeAllRanges();
    expect(fireEvent.contextMenu(object)).toBe(false);
    expect(screen.getByRole('menu', {name:'Object actions'})).toBeTruthy();
  });
  it('preserves contenteditable menus under product handlers', () => {
    const handler = vi.fn(e => e.preventDefault());
    render(<><ApplicationContextMenu name="Editor" /><div onContextMenu={handler}><div contentEditable suppressContentEditableWarning>Editable text</div></div></>);
    expect(fireEvent.contextMenu(screen.getByText('Editable text'))).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });
});

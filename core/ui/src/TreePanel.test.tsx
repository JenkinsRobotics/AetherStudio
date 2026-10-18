import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { TreePanel } from "./TreePanel";

const nodes = [{ id: "a", label: "Visible item", actions: [{ id: "hide", label: "Hide item", icon: "eye" }] },
  { id: "b", label: "Hidden item", dimmed: true, actions: [{ id: "show", label: "Show item", icon: "eye", pinned: true }] }];
test("only state controls live on rows; the header and right-click menu use the selected item", () => {
  const select = vi.fn(), command = vi.fn(), remove = vi.fn(), action = vi.fn();
  render(<TreePanel nodes={nodes} selectedIDs={new Set(["a"])} onSelect={select} onAction={action}
    controls={[{ id: "delete", label: "Delete item", icon: "x", onClick: remove, shortcut: "Delete" }]}
    menuItems={(id) => [{ id: id === "a" ? "hide" : "show", label: id === "a" ? "Hide" : "Show" }]}
    onCommand={command} />);
  const tree = screen.getByRole("tree");
  expect(within(tree).queryByRole("button", { name: "Hide item" })).toBeNull();
  fireEvent.click(within(tree).getByRole("button", { name: "Show item" }));
  expect(action).toHaveBeenCalledWith("b", "show"); expect(select).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "More Tree controls" }));
  fireEvent.click(screen.getByRole("menuitem", { name: /Delete item/ })); expect(remove).toHaveBeenCalledOnce();
  fireEvent.contextMenu(screen.getByText("Hidden item"), { clientX: 50, clientY: 50 });
  expect(select).toHaveBeenCalledWith(["b"], "single");
  fireEvent.click(screen.getByRole("menuitem", { name: "Show" })); expect(command).toHaveBeenCalledWith("b", "show");
});
test("Delete/Backspace applies only to a focused selected row; disabled controls and fields are safe", () => {
  const remove = vi.fn();
  const { rerender } = render(<TreePanel nodes={nodes} selectedIDs={new Set(["a"])} onSelect={() => {}}
    controls={[{ id: "delete", label: "Delete", icon: "x", onClick: remove, shortcut: "Delete" }]} />);
  fireEvent.keyDown(screen.getByText("Visible item").closest('[role="treeitem"]')!, { key: "Backspace" });
  expect(remove).toHaveBeenCalledOnce();
  fireEvent.keyDown(screen.getByText("Hidden item").closest('[role="treeitem"]')!, { key: "Delete" });
  fireEvent.keyDown(screen.getByRole("button", { name: "More Tree controls" }), { key: "Backspace" });
  expect(remove).toHaveBeenCalledOnce();
  rerender(<TreePanel nodes={nodes} selectedIDs={new Set(["a"])} onSelect={() => {}}
    controls={[{ id: "delete", label: "Delete", icon: "x", disabled: true, onClick: remove, shortcut: "Delete" }]} />);
  fireEvent.keyDown(screen.getByText("Visible item").closest('[role="treeitem"]')!, { key: "Delete" }); expect(remove).toHaveBeenCalledOnce();
});
test("keyboard context menu is available and inherited tree navigation still expands/selects", () => {
  const select = vi.fn();
  render(<TreePanel nodes={[{ id: "root", label: "Group", children: nodes }]} selectedIDs={new Set(["a"])} onSelect={select}
    menuItems={() => [{ id: "rename", label: "Rename" }]} />);
  const row = screen.getByText("Visible item").closest('[role="treeitem"]')!;
  fireEvent.keyDown(row, { key: "F10", shiftKey: true }); expect(screen.getByRole("menuitem", { name: "Rename" })).toBeTruthy();
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.keyDown(row, { key: "ArrowDown" }); expect(document.activeElement?.textContent).toContain("Hidden item");
  fireEvent.keyDown(document.activeElement!, { key: "Enter" }); expect(select).toHaveBeenCalledWith(["b"], "single");
});

test("existing row actions automatically remain available from the menu when adopted", () => {
  const action = vi.fn();
  render(<TreePanel nodes={nodes} selectedIDs={new Set()} onSelect={()=>{}} onAction={action}/>);
  fireEvent.contextMenu(screen.getByText('Visible item'),{clientX:20,clientY:20});
  fireEvent.click(screen.getByRole('menuitem',{name:'Hide item'}));
  expect(action).toHaveBeenCalledWith('a','hide');
});

test("inline rename focuses immediately, preserves fast typing and commits only once", () => {
  const commit = vi.fn();
  render(<TreePanel nodes={nodes} selectedIDs={new Set(['a'])} onSelect={()=>{}} renamingID="a" onRename={commit}/>);
  const input = screen.getByRole('textbox',{name:'Rename Visible item'}) as HTMLInputElement;
  expect(document.activeElement).toBe(input);
  fireEvent.change(input,{target:{value:'Renamed item'}});
  fireEvent.keyDown(input,{key:'Enter'});
  fireEvent.blur(input);
  expect(commit).toHaveBeenCalledExactlyOnceWith('a','Renamed item');
});

test('search and type filtering retain ancestors and preserve the original expansion and selection', () => {
  const select = vi.fn(), toggle = vi.fn();
  render(<TreePanel ariaLabel="Items" nodes={[{ id:'folder', label:'Assembly', children:[
    {id:'body', label:'Body 01', category:'body'}, {id:'sketch',label:'Sketch 01',category:'sketch'},
  ] }]} selectedIDs={new Set(['body'])} expandedIDs={new Set()} onSelect={select} onToggle={toggle}
    filterOptions={[{id:'body',label:'Bodies'},{id:'sketch',label:'Sketches'}]} />);
  expect(screen.queryByText('Body 01')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Search Items types'}));
  fireEvent.click(screen.getByRole('menuitemradio',{name:'Bodies'}));
  expect(screen.getByText('Assembly')).toBeTruthy();
  expect(screen.getByText('Body 01').closest('[role="treeitem"]')?.getAttribute('aria-selected')).toBe('true');
  expect(screen.queryByText('Sketch 01')).toBeNull();
  const search=screen.getByRole('searchbox',{name:'Search Items'});
  fireEvent.change(search,{target:{value:'Sketch'}});
  expect(screen.queryByText('Body 01')).toBeNull();
  fireEvent.keyDown(search,{key:'Escape'});
  expect(screen.getByText('Body 01')).toBeTruthy();
  fireEvent.keyDown(search,{key:'ArrowDown',altKey:true});
  expect(screen.getByRole('menuitemradio',{name:'Bodies'}).getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByRole('menuitemradio',{name:'All Items'}));
  expect(screen.queryByText('Body 01')).toBeNull();
  expect(select).not.toHaveBeenCalled(); expect(toggle).not.toHaveBeenCalled();
});

test('the reference header exposes creation and one menu without losing disabled commands', () => {
  const create=vi.fn(), remove=vi.fn();
  render(<TreePanel nodes={nodes} selectedIDs={new Set()} onSelect={()=>{}} controls={[
    {id:'new-folder',label:'New folder',icon:'+',onClick:create},
    {id:'delete',label:'Delete',icon:'x',disabled:true,onClick:remove},
  ]}/>);
  const footer=screen.getByRole('group',{name:'Tree controls'});
  expect(within(footer).getAllByRole('button')).toHaveLength(2);
  fireEvent.click(within(footer).getByRole('button',{name:'New folder'}));expect(create).toHaveBeenCalledOnce();
  fireEvent.click(within(footer).getByRole('button',{name:'More Tree controls'}));
  const disabled=screen.getByRole('menuitem',{name:'Delete'}) as HTMLButtonElement;
  expect(disabled.disabled).toBe(true);fireEvent.click(disabled);expect(remove).not.toHaveBeenCalled();
});

test("the header shows only supported actions, and branches show a disclosure chevron", () => {
  const newFolder = vi.fn();
  // No folder control: do not show a dead button.
  const { rerender } = render(<TreePanel ariaLabel="Layers" nodes={nodes} selectedIDs={new Set()} onSelect={() => {}}
    controls={[{ id: "new", label: "New Surface", icon: "+", onClick: () => {} }]} />);
  expect(screen.queryByRole("button", { name: "New folder" })).toBeNull();
  expect((screen.getByRole("button", { name: "New Surface" }) as HTMLButtonElement).disabled).toBe(false);
  // A folder control claims it, keeps its own label, and stays ahead of the
  // product's own "new" command rather than displacing it.
  rerender(<TreePanel ariaLabel="Items" nodes={[{ id: "root", label: "Assembly 1.step", children: nodes }]}
    selectedIDs={new Set()} onSelect={() => {}}
    controls={[{ id: "new", label: "New Surface", icon: "+", onClick: () => {} },
      { id: "folder", label: "New folder", icon: "f", onClick: newFolder }]} />);
  const footer = screen.getByRole("group", { name: "Tree controls" });
  const buttons = within(footer).getAllByRole("button").map((b) => b.getAttribute("aria-label"));
  expect(buttons).toEqual(["New folder", "New Surface"]);
  fireEvent.click(within(footer).getByRole("button", { name: "New folder" }));
  expect(newFolder).toHaveBeenCalledOnce();
  // The branch row carries a chevron; its leaves do not.
  expect(screen.getByRole("button", { name: "Collapse Assembly 1.step" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /(Collapse|Expand) Visible item/ })).toBeNull();
});


test("header actions cap at two plus More, deduplicate and retain every overflow command", () => {
  const handlers = Array.from({length:5}, () => vi.fn());
  const controls = ["New folder", "Settings", "Import", "Rename", "Delete"].map((label,i) => ({id:String(i),label,icon:"x",onClick:handlers[i]}));
  const {container} = render(<TreePanel title="Features" nodes={nodes} selectedIDs={new Set()} onSelect={() => {}}
    controls={controls} headerControls={controls.slice(0,4)} />);
  const header = container.querySelector('.aui-collection-heading')!;
  expect(within(header as HTMLElement).getAllByRole('button').map(button => button.getAttribute('aria-label')))
    .toEqual(['New folder','Settings','More Tree controls']);
  expect(container.querySelector('.aui-collection-footer')).toBeNull();
  expect(screen.getAllByRole('button',{name:'New folder'})).toHaveLength(1);
  const more = screen.getByRole('button',{name:'More Tree controls'});
  fireEvent.click(more);
  expect(screen.getAllByRole('menuitem')).toHaveLength(3);
  for (const name of ['Import','Rename','Delete']) expect(screen.getByRole('menuitem',{name})).toBeTruthy();
  fireEvent.click(screen.getByRole('menuitem',{name:'Import'}));
  expect(handlers[2]).toHaveBeenCalledOnce();
  expect(more.getAttribute('aria-expanded')).toBe('false');
});

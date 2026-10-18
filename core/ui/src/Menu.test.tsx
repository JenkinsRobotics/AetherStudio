import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { Menu, MenuButton, type MenuItem } from "./Menu";

const items: MenuItem[] = [
  { id: "open", label: "Open", shortcut: "⌘O" },
  { id: "locked", label: "Delete", disabled: true, disabledReason: "Locked" },
  { id: "edges", label: "Show edges", kind: "checkbox", checked: true },
  { id: "solid", label: "Solid", kind: "radio", checked: true },
  { id: "purge", label: "Purge", danger: true },
  {
    id: "export",
    label: "Export",
    separatorBefore: true,
    children: [
      { id: "step", label: "STEP" },
      { id: "mesh", label: "Mesh", danger: true },
    ],
  },
];

function renderMenu(onSelect = vi.fn()) {
  render(
    <MenuButton label="Actions" items={items} onSelect={onSelect}>
      •••
    </MenuButton>,
  );
  fireEvent.click(screen.getByLabelText("Actions"));
  return onSelect;
}

test("selects a command and closes", () => {
  const onSelect = renderMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: /Open/ }));
  expect(onSelect).toHaveBeenCalledWith("open");
  expect(screen.queryByRole("menu")).toBeNull();
});

test("disabled items expose their reason and cannot execute", () => {
  const onSelect = renderMenu();
  const item = screen.getByRole("menuitem", { name: "Delete" });
  expect(item.getAttribute("title")).toBe("Locked");
  fireEvent.click(item);
  expect(onSelect).not.toHaveBeenCalled();
});

test("checkbox state and separators use menu semantics", () => {
  renderMenu();
  expect(
    screen
      .getByRole("menuitemcheckbox", { name: "Show edges" })
      .getAttribute("aria-checked"),
  ).toBe("true");
  expect(
    screen.getByRole("menuitemradio", { name: "Solid" }).getAttribute("aria-checked"),
  ).toBe("true");
  expect(screen.getByRole("menuitem", { name: "Purge" }).className).toContain(
    "aui-menu-item--danger",
  );
  expect(screen.getByRole("separator")).not.toBeNull();
});

test("keyboard navigation skips disabled items and Escape returns focus", () => {
  renderMenu();
  const opener = screen.getByRole("button", { name: "Actions" });
  const open = screen.getByRole("menuitem", { name: /Open/ });
  expect(document.activeElement).toBe(open);
  fireEvent.keyDown(open, { key: "ArrowDown" });
  expect(document.activeElement).toBe(
    screen.getByRole("menuitemcheckbox", { name: "Show edges" }),
  );
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(opener);
});

test("opening waits for the positioned menu to be visible before focusing it", () => {
  const focus = HTMLElement.prototype.focus;
  const attempted: string[] = [];
  const spy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement, options) {
    const menu = this.closest<HTMLElement>('[role="menu"]');
    if (menu) {
      attempted.push(menu.style.visibility);
      // Browsers cannot focus descendants of visibility:hidden. jsdom can.
      if (menu.style.visibility === 'hidden') return;
    }
    focus.call(this, options);
  });
  try {
    renderMenu();
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Open/ }));
    expect(attempted).toEqual(['visible']);
  } finally { spy.mockRestore(); }
});

test("submenus open from keyboard and execute nested commands", async () => {
  const onSelect = renderMenu();
  const exportItem = screen.getByRole("menuitem", { name: "Export" });
  exportItem.focus();
  fireEvent.keyDown(exportItem, { key: "ArrowRight" });
  await Promise.resolve();
  expect(screen.getByRole("menuitem", { name: "STEP" })).not.toBeNull();
  fireEvent.click(screen.getByRole("menuitem", { name: "STEP" }));
  expect(onSelect).toHaveBeenCalledWith("step");
});

test("outside pointer press closes without executing", () => {
  const onSelect = renderMenu();
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("menu")).toBeNull();
  expect(onSelect).not.toHaveBeenCalled();
});

test("an all-disabled menu can still close with Escape", () => {
  render(
    <MenuButton
      label="Unavailable actions"
      items={[{ id: "locked", label: "Locked", disabled: true }]}
      onSelect={vi.fn()}
    >
      •••
    </MenuButton>,
  );
  const opener = screen.getByRole("button", { name: "Unavailable actions" });
  fireEvent.click(opener);
  expect(screen.getByRole("menu")).not.toBeNull();
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(opener);
});

test("supports a pointer-position anchor for context menus", () => {
  render(
    <Menu
      open
      anchor={{ x: 24, y: 36 }}
      items={[{ id: "inspect", label: "Inspect" }]}
      onSelect={vi.fn()}
      onClose={vi.fn()}
      ariaLabel="Context actions"
    />,
  );
  const menu = screen.getByRole("menu", { name: "Context actions" });
  expect(menu.style.left).toBe("24px");
  expect(menu.style.top).toBe("36px");
});


test("a command hands focus to its inline editor without closing it again", () => {
  function RenameCommand() {
    const [editing, setEditing] = useState(false);
    return <><MenuButton label="Layer actions" items={[{ id: "rename", label: "Rename" }]}
      onSelect={() => setEditing(true)}>Actions</MenuButton>
      {editing && <input aria-label="Layer name" autoFocus onBlur={() => setEditing(false)} />}</>;
  }
  render(<RenameCommand />);
  fireEvent.click(screen.getByRole("button", { name: "Layer actions" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Layer name" }));
  expect(screen.queryByRole("menu")).toBeNull();
});

test('hover keeps one submenu branch and leaving collapses it after a grace period', () => {
 vi.useFakeTimers();
 try {
  render(<Menu open anchor={{x:20,y:20}} onClose={vi.fn()} onSelect={vi.fn()} ariaLabel="Branches" items={[
   {id:'new',label:'New',children:[{id:'folder',label:'Folder'}]},
   {id:'view',label:'View',children:[{id:'list',label:'List'}]},
   {id:'refresh',label:'Refresh'},
  ]}/>);
  fireEvent.mouseEnter(screen.getByRole('menuitem',{name:'New'}));
  expect(screen.queryByRole('menuitem',{name:'Folder'})).not.toBeNull();
  fireEvent.mouseEnter(screen.getByRole('menuitem',{name:'View'}));
  expect(screen.queryByRole('menuitem',{name:'Folder'})).toBeNull();
  const list = screen.getByRole('menuitem',{name:'List'});
  fireEvent.mouseLeave(screen.getByRole('menuitem',{name:'View'}).closest('li')!);
  fireEvent.mouseEnter(list);
  act(() => vi.advanceTimersByTime(200));
  expect(screen.queryByRole('menuitem',{name:'List'})).not.toBeNull();
  fireEvent.mouseLeave(screen.getByRole('menuitem',{name:'View'}).closest('li')!);
  act(() => vi.advanceTimersByTime(200));
  expect(screen.queryByRole('menuitem',{name:'List'})).toBeNull();
  fireEvent.mouseEnter(screen.getByRole('menuitem',{name:'New'}));
  fireEvent.mouseEnter(screen.getByRole('menuitem',{name:'Refresh'}));
  expect(screen.queryByRole('menuitem',{name:'Folder'})).toBeNull();
 } finally { vi.useRealTimers(); }
});

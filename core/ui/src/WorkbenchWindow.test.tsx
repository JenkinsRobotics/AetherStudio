import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { WorkbenchWindow } from "./WorkbenchWindow";

test("sidebar collapses without losing drafts, while toolbar and canvas remain available", () => {
  render(<WorkbenchWindow title="Workspace" sidebar={<input aria-label="Draft name" defaultValue="Part"/>} toolbar={<button>Import</button>} statusBar="Ready"><button>Canvas action</button></WorkbenchWindow>);
  fireEvent.change(screen.getByRole("textbox",{name:"Draft name"}),{target:{value:"Renamed part"}});
  fireEvent.click(screen.getByRole("button",{name:"Hide sidebar"}));
  expect(screen.queryByRole("textbox",{name:"Draft name"})).toBeNull();
  expect(screen.getByRole("button",{name:"Import"})).toBeTruthy();
  expect(screen.getByRole("button",{name:"Canvas action"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Show sidebar"}));
  expect((screen.getByRole("textbox",{name:"Draft name"}) as HTMLInputElement).value).toBe("Renamed part");
});

test("keyboard resizes and collapses the sidebar; controlled state stays owner supplied", () => {
  const resize=vi.fn(), collapse=vi.fn();
  const props={title:"Workspace",sidebar:<span>Library</span>,sidebarWidth:265,onSidebarWidthChange:resize,onSidebarCollapsedChange:collapse};
  const {rerender}=render(<WorkbenchWindow {...props} sidebarCollapsed={false}>Content</WorkbenchWindow>);
  const separator=screen.getByRole("separator",{name:"Resize workspace sidebar"});
  fireEvent.keyDown(separator,{key:"ArrowRight"});
  expect(resize).toHaveBeenLastCalledWith(275);
  fireEvent.keyDown(separator,{key:"Home"});
  expect(collapse).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole("button",{name:"Hide sidebar"})).toBeTruthy();
  rerender(<WorkbenchWindow {...props} sidebarCollapsed>Content</WorkbenchWindow>);
  expect(screen.getByRole("button",{name:"Show sidebar"})).toBeTruthy();
});

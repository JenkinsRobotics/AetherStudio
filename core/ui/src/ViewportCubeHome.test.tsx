import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ViewportCubeHome } from "./ViewportCubeHome";

test("left click goes Home; right click opens view options without moving the camera",()=>{
  const onHome=vi.fn(),onSelect=vi.fn();
  render(<ViewportCubeHome onHome={onHome} items={[{id:"home",label:"Home"},{id:"dimetric",label:"Dimetric"}]} onSelect={onSelect}/>);
  const home=screen.getByRole("button",{name:"Home view"});
  fireEvent.click(home);expect(onHome).toHaveBeenCalledTimes(1);
  fireEvent.contextMenu(home);expect(onHome).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("menu",{name:"View and graphics options"})).toBeTruthy();
  fireEvent.click(screen.getByRole("menuitem",{name:"Dimetric"}));expect(onSelect).toHaveBeenCalledWith("dimetric");
  expect(screen.queryByRole("menu")).toBeNull();
});
test("keyboard opens the menu and Escape closes it and restores Home focus",()=>{
  render(<ViewportCubeHome onHome={()=>{}} items={[{id:"home",label:"Home"}]} onSelect={()=>{}}/>);
  const home=screen.getByRole("button",{name:"Home view"});home.focus();
  fireEvent.keyDown(home,{key:"F10",shiftKey:true});
  expect(screen.getByRole("menu")).toBeTruthy();
  fireEvent.keyDown(document,{key:"Escape"});
  expect(screen.queryByRole("menu")).toBeNull();expect(document.activeElement).toBe(home);
});

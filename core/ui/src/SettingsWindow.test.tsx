import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { SettingsWindow } from "./SettingsWindow";
import { ToolIcon } from "./ToolIcon";
import { ToolIconTheme } from "./ToolIconTheme";
import { WorkspaceShell } from "./WorkspaceShell";

test("compact floating settings use modeless macOS window chrome and remain movable", () => {
  const onClose = vi.fn();
  const { container } = render(<SettingsWindow
    open
    title="Aether Animation Studio Settings"
    sections={[{ title: "General", panes: [{ id: "layout", label: "Layout" }] }]}
    activePaneID="layout"
    onSelectPane={() => undefined}
    onClose={onClose}
    presentation="floating"
    size="standard"
  ><p>Layout settings</p></SettingsWindow>);
  const dialog = screen.getByRole("dialog", { name: "Aether Animation Studio Settings" });
  expect(dialog.getAttribute("aria-modal")).toBeNull();
  expect(dialog.classList.contains("aui-settings-window--standard")).toBe(true);
  expect(container.querySelectorAll(".aui-settings-traffic")).toHaveLength(3);
  const titlebar = screen.getByRole("group", { name: "Move Aether Animation Studio Settings" });
  fireEvent.keyDown(titlebar, { key: "ArrowRight" });
  expect((dialog as HTMLElement).style.transform).toBe("translate(10px, 0px)");
  fireEvent.click(screen.getByRole("button", { name: "Close Aether Animation Studio Settings" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("shared workspace spacing updates the shell live and restores standard defaults", () => {
  localStorage.clear();
  const {container} = render(<>
    <WorkspaceShell preset="docked">Workspace</WorkspaceShell>
    <SettingsWindow open title="Settings" sections={[]} activePaneID="" onSelectPane={() => undefined} onClose={() => undefined}>Settings</SettingsWindow>
  </>);
  fireEvent.click(screen.getByRole("button",{name:"Workspace spacing"}));
  const field = screen.getByRole("textbox",{name:"Workspace margin"});
  expect((field as HTMLInputElement).value).toBe("10");
  fireEvent.change(field,{target:{value:"24"}});
  fireEvent.keyDown(field,{key:"Enter"});
  const shell = container.querySelector('.aui-shell') as HTMLElement;
  expect(shell.style.getPropertyValue('--aui-workspace-inset-left')).toBe('24px');
  fireEvent.click(screen.getByRole("button",{name:"Restore Aether UI defaults"}));
  expect(shell.style.getPropertyValue('--aui-workspace-inset-left')).toBe('10px');
  expect(shell.dataset.measureInsets).toBe('true');
  localStorage.clear();
});

test("every settings window includes shared appearance and updates unscoped icons while preserving specimen packs", () => {
  localStorage.clear();
  const { container } = render(<>
    <ToolIcon name="box" />
    <ToolIconTheme pack="classic"><ToolIcon name="box" /></ToolIconTheme>
    <SettingsWindow open title="Product settings" sections={[{title:"Product",panes:[{id:"tools",label:"Tools"}]}]}
      activePaneID="tools" onSelectPane={() => undefined} onClose={() => undefined}><p>Product controls</p></SettingsWindow>
  </>);
  fireEvent.click(screen.getByRole("button", {name:"Appearance & icons"}));
  fireEvent.change(screen.getByRole("combobox", {name:"Tool icon pack"}), {target:{value:"graphite-ribbon"}});
  expect(Array.from(container.querySelectorAll('[data-icon-pack]')).map(el=>el.getAttribute('data-icon-pack')))
    .toEqual(['graphite-ribbon','classic']);
  expect(localStorage.getItem("aether.tool-icon-pack")).toBe("graphite-ribbon");
  fireEvent.change(screen.getByRole("combobox", {name:"Color mode"}), {target:{value:"dark"}});
  expect(document.documentElement.dataset.appearance).toBe("dark");
  fireEvent.click(screen.getByRole("button", {name:"Tools"}));
  expect(screen.getByText("Product controls")).toBeTruthy();
  localStorage.clear();
});

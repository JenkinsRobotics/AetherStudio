import {useState} from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ApplicationFileTable } from "./ApplicationFileTable";

const rows = [
  { id: "one", name: "Wheel", icon: null, location: "My files", date: "Today", owner: "Alex" },
  { id: "two", name: "Axle", icon: null, location: "Team", date: "Yesterday", owner: "Sam" },
];

test("checkbox and action clicks do not change row selection or open a file", () => {
  const onSelect = vi.fn(), onOpen = vi.fn(), onToggle = vi.fn(), onSelectAll = vi.fn(), action = vi.fn();
  render(<ApplicationFileTable rows={rows} selectedIds={new Set(["one"])}
    onSelect={onSelect} onOpen={onOpen} onToggle={onToggle} onSelectAll={onSelectAll}
    renderActions={row => <button onClick={action}>Actions for {row.name}</button>} />);
  expect((screen.getByLabelText("Select all files") as HTMLInputElement).indeterminate).toBe(true);
  fireEvent.click(screen.getByLabelText("Select Axle"));
  expect(onToggle).toHaveBeenCalledWith(rows[1], true);
  fireEvent.click(screen.getByRole("button", {name: "Actions for Wheel"}));
  fireEvent.doubleClick(screen.getByRole("button", {name: "Actions for Wheel"}));
  expect(action).toHaveBeenCalledOnce();
  expect(onSelect).not.toHaveBeenCalled();
  expect(onOpen).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText("Select all files"));
  expect(onSelectAll).toHaveBeenCalledWith(true);
});

test("file names support selection, keyboard open and context commands", () => {
  const onSelect = vi.fn(), onOpen = vi.fn(), onContextMenu = vi.fn();
  render(<ApplicationFileTable rows={rows} selectedIds={new Set()} onSelect={onSelect} onOpen={onOpen} onContextMenu={onContextMenu} />);
  const name = screen.getByRole("button", {name: "Wheel My files"});
  fireEvent.click(name, {ctrlKey: true});
  expect(onSelect).toHaveBeenCalledWith(rows[0], expect.objectContaining({ctrlKey: true}));
  fireEvent.keyDown(name, {key: "Enter"});
  expect(onOpen).toHaveBeenCalledWith(rows[0]);
  fireEvent.contextMenu(name);
  expect(onContextMenu).toHaveBeenCalledWith(rows[0], expect.anything());
});

test("custom metadata headers sort without triggering file commands", () => {
  const onSort = vi.fn(), onOpen = vi.fn(), onSelect = vi.fn();
  render(<ApplicationFileTable rows={rows} selectedIds={new Set()} compact
    onOpen={onOpen} onSelect={onSelect} sort={{id: "modified", ascending: false}} onSort={onSort}
    columns={[
      {id: "modified", label: "Modified", sortable: true, render: row => row.date},
      {id: "sharing", label: "Sharing", secondary: true, render: () => "Private"},
    ]} />);
  expect(screen.getByRole("columnheader", {name: "Modified"}).getAttribute("aria-sort")).toBe("descending");
  fireEvent.click(screen.getByRole("button", {name: "Modified"}));
  expect(onSort).toHaveBeenCalledWith("modified");
  expect(screen.getAllByText("Private")).toHaveLength(2);
  expect(onOpen).not.toHaveBeenCalled();
  expect(onSelect).not.toHaveBeenCalled();
});


test("a double-click selects once and opens once without toggling the row back", () => {
  const onSelect = vi.fn(), onOpen = vi.fn();
  render(<ApplicationFileTable rows={rows} selectedIds={new Set()} onSelect={onSelect} onOpen={onOpen} />);
  const name = screen.getByRole("button", {name: "Wheel My files"});
  fireEvent.click(name, {detail: 1});
  fireEvent.click(name, {detail: 2});
  fireEvent.doubleClick(name);
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onOpen).toHaveBeenCalledExactlyOnceWith(rows[0]);
});

test("shared controlled selection supports range, modifier toggles and select all",()=>{
 function List(){const [ids,setIds]=useState<Set<string>>(new Set());return <ApplicationFileTable rows={rows} selectedIds={ids} onSelectedIdsChange={setIds} onSelect={()=>{}} onOpen={()=>{}}/>;}
 render(<List/>);
 fireEvent.click(screen.getByRole("button",{name:"Wheel My files"}));
 fireEvent.click(screen.getByRole("button",{name:"Axle Team"}),{shiftKey:true});
 expect((screen.getByLabelText("Select all files") as HTMLInputElement).checked).toBe(true);
 fireEvent.click(screen.getByRole("button",{name:"Wheel My files"}),{metaKey:true});
 expect((screen.getByLabelText("Select Wheel") as HTMLInputElement).checked).toBe(false);
 expect((screen.getByLabelText("Select Axle") as HTMLInputElement).checked).toBe(true);
 fireEvent.click(screen.getByLabelText("Select all files"));
 expect((screen.getByLabelText("Select Wheel") as HTMLInputElement).checked).toBe(true);
});

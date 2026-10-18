import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { aetherIconNames } from "./AetherIcon";
import { FILE_TYPES, fileTypeFor } from "./file-types";
import { FileTypeFilters } from "./FileTypeFilters";
import { FileManagerPanel } from "./FileManagerPanel";

test.each([
  ["Wheel.acpart", "file-part"], ["Wheel.CADPART", "file-part"],
  ["Train.acasm", "file-assembly"], ["Layout.acdrw", "file-drawing"],
  ["Project.acad", "file-project"], ["Show.aethermap", "file-show"],
  ["Show.show", "file-show"], ["Robot.anima", "file-character"],
  ["Drawing.aethersketch", "file-sketch"], ["Board.aetherio", "file-circuit"],
  ["Paths.svg", "file-vector"], ["Instructions.DOCX", "file-word"],
  ["BOM.xlsx", "file-spreadsheet"], ["Parts.csv", "file-spreadsheet"],
  ["Review.pptx", "file-presentation"], ["Drawing.pdf", "file-pdf"],
  ["Reference.webp", "file-image"], ["Show.mp4", "file-video"],
  ["Voice.wav", "file-audio"], ["Backup.zip", "file-archive"],
  ["Bracket.step", "file-model"], ["settings.json", "file-code"],
  ["Notes.txt", "file-text"], ["unknown.xyz", "file-generic"],
])("%s keeps the same icon regardless of the workspace", (name, icon) => {
  for (const app of ["drive", "cad", "map", "animation", "io", undefined]) {
    expect(fileTypeFor({name, app, mime:"application/octet-stream"}).icon).toBe(icon);
  }
});

test("folder identity wins over its name, with MIME and extensionless native fallbacks", () => {
  expect(fileTypeFor({name:"Folder.acpart",kind:"folder"}).id).toBe("folder");
  expect(fileTypeFor({name:"Download",mime:"APPLICATION/PDF; charset=binary"}).id).toBe("pdf");
  expect(fileTypeFor({name:"Upload",mime:"image/heic"}).id).toBe("image");
  expect(fileTypeFor({name:"Board",app:"io"}).id).toBe("circuit");
  expect(fileTypeFor({name:"Readme.txt",app:"cad"}).id).toBe("text");
  expect(fileTypeFor({name:"Legacy.aether",app:"cad"}).id).toBe("assembly");
  expect(fileTypeFor({name:"Workspace.aether",app:"animation"}).id).toBe("workspace");
});

test("every registered type has real shared artwork and no ambiguous extension", () => {
  const extensions = FILE_TYPES.flatMap(type => type.extensions);
  expect(new Set(extensions).size).toBe(extensions.length);
  expect(new Set(FILE_TYPES.map(type => type.id)).size).toBe(FILE_TYPES.length);
  for (const type of FILE_TYPES) expect(aetherIconNames).toContain(type.icon);
});

test("quick and More filters use the row identity and emit the actual file type", () => {
  const change=vi.fn();
  render(<FileTypeFilters value="all" onChange={change}/>);
  const parts=screen.getByRole("button",{name:"Parts"});
  expect(parts.querySelector('[data-icon="file-part"]')).toBeTruthy();
  fireEvent.click(parts);
  expect(change).toHaveBeenLastCalledWith("part");
  fireEvent.click(screen.getByRole("button",{name:"More file types"}));
  const sheets=screen.getByRole("menuitemradio",{name:"Spreadsheets"});
  expect(sheets.querySelector('[data-icon="file-spreadsheet"]')).toBeTruthy();
  fireEvent.click(sheets);
  expect(change).toHaveBeenLastCalledWith("spreadsheet");
});

test("embedded library, type menu and selected preview agree on file identity", () => {
  const {container}=render(<FileManagerPanel documentName="Project" activeID="assembly" documentGroups={[
    {id:"parts",label:"Contents",items:[{id:"assembly",name:"Train",kind:"assembly",detail:"Assembly"}]},
  ]} libraryItems={[{id:"pdf",name:"Drawing.pdf",kind:"file",detail:"PDF"}]} onOpen={()=>{}} />);
  expect(container.querySelectorAll('[data-icon="file-assembly"]').length).toBeGreaterThanOrEqual(3);
  expect(container.querySelector('[data-icon="file-pdf"]')).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Filter files by type"}));
  expect(screen.getByRole("menuitemradio",{name:"PDF"}).querySelector('[data-icon="file-pdf"]')).toBeTruthy();
});

test("Shared can promote folders without duplicating file identities", () => {
  const change = vi.fn();
  render(<FileTypeFilters value="folder" onChange={change} quickIDs={["folder", "pdf"]} />);
  expect(screen.getByRole("button", {name: "Folders"}).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", {name: "More file types"}));
  expect(screen.queryByRole("menuitemradio", {name: "Folders"})).toBeNull();
  fireEvent.click(screen.getByRole("menuitemradio", {name: "Parts"}));
  expect(change).toHaveBeenCalledWith("part");
});

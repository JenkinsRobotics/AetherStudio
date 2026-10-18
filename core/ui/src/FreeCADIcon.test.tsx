import packagedAssets0 from "@aether/assets/catalogs/db54f664a13d0d";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { FreeCADIcon, freecadIconCatalog, freecadToolIconMap } from "./FreeCADIcon";
import { toolIconNames, graphiteToolIconNames } from "./ToolIcon";
import { FreeCADIconPack } from "../gallery/FreeCADIconPack";

test("FreeCAD Graphite has a distinct, complete paired workbench catalog", () => {
  expect(freecadIconCatalog).toHaveLength(1731);
  expect(new Set(freecadIconCatalog.map(icon => icon.workbench)).size).toBe(25);
  for (const workbench of ["CAM", "Fem", "BIM", "TechDraw", "Draft", "Application"]) expect(freecadIconCatalog.some(icon => icon.workbench === workbench)).toBe(true);
  expect(new Set(freecadIconCatalog.map(icon => icon.id)).size).toBe(1731);
  const assets = (packagedAssets0 as Record<string, string>);
  for (const entry of freecadIconCatalog) {
    for (const palette of ["light", "dark"] as const) {
      const source = assets[`../../assets/icon-packs/freecad-graphite/${palette}/${entry.id}.svg`];
      expect(source, `${entry.id}/${palette}`).toBeTypeOf("string");
      const doc = new DOMParser().parseFromString(source, "image/svg+xml");
      expect(doc.querySelector("parsererror,image,script,foreignObject")).toBeNull();
      expect(doc.querySelector("desc")?.textContent).toContain(entry.workbench === "Aether" ? "FreeCAD Graphite extension" : "FreeCAD Graphite adaptation");
      expect(doc.documentElement.getAttribute("viewBox")).toBeTruthy();
      // Upstream TechDraw/none is an intentionally blank "no decoration" sentinel.
      if (entry.id !== "TechDraw/none") expect(doc.querySelector("path,rect,circle,ellipse,polygon,polyline,line,use,text"), entry.id).not.toBeNull();
      const ids = new Set([...doc.querySelectorAll("[id]")].map(node => node.id));
      for (const match of source.matchAll(/url\(#([^)]+)\)/g)) expect(ids.has(match[1]), `${entry.id}: ${match[1]}`).toBe(true);
    }
  }
}, 15000);

test("explicit palettes load their own SVG and keep accessible labels on the component", () => {
  const { container, rerender } = render(<FreeCADIcon name="PartDesign/PartDesign_Pad" palette="light" label="Pad" />);
  expect(screen.getByRole("img", { name: "Pad" })).toBeTruthy();
  expect(container.querySelectorAll("img")).toHaveLength(1);
  expect(container.querySelector("img")?.getAttribute("src")).toContain("/light/");
  rerender(<FreeCADIcon name="PartDesign/PartDesign_Pad" palette="dark" />);
  expect(container.querySelector("img")?.getAttribute("src")).toContain("/dark/");
  expect(container.querySelector("span")?.getAttribute("aria-hidden")).toBe("true");
});

test("icon page filters FreeCAD workbenches without duplicating the existing themes or adding a toolbar tray", () => {
  const { container } = render(<FreeCADIconPack />);
  expect(screen.getByRole("status").textContent).toBe("1731 of 1731 icons");
  expect(container.querySelectorAll("img")).toHaveLength(192);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("Page 2 of 19")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Workbench"), { target: { value: "CAM" } });
  expect(screen.getByRole("status").textContent).toBe("123 of 1731 icons");
  expect(screen.getByText("Page 1 of 2")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Workbench"), { target: { value: "Fem" } });
  expect(screen.getByRole("status").textContent).toBe("115 of 1731 icons");
  fireEvent.change(screen.getByLabelText("Workbench"), { target: { value: "PartDesign" } });
  expect(screen.getByRole("status").textContent).toBe("59 of 1731 icons");
  fireEvent.change(screen.getByLabelText("Find an icon"), { target: { value: "Pocket" } });
  expect(screen.getByRole("status").textContent).toBe("1 of 1731 icons");
  expect(container.querySelectorAll("img")).toHaveLength(2);
  expect(container.querySelector("[role=toolbar]")).toBeNull();
  fireEvent.change(screen.getByLabelText("Find an icon"), { target: { value: "xyz-missing" } });
  expect(screen.getAllByText("No matching icons.")).toHaveLength(2);
});


test("every existing illustrated tool has a deliberate FreeCAD equivalent or original Aether extension", () => {
  const names = new Set([...toolIconNames, ...graphiteToolIconNames]);
  expect(Object.keys(freecadToolIconMap).sort()).toEqual([...names].sort());
  const ids = new Set(freecadIconCatalog.map(icon => icon.id));
  for (const id of Object.values(freecadToolIconMap)) expect(ids.has(id)).toBe(true);
  expect(freecadIconCatalog.filter(icon => icon.workbench === "Aether")).toHaveLength(24);
  const { container, rerender } = render(<FreeCADIcon name="extrude" palette="light" />);
  expect(container.querySelector("img")?.getAttribute("src")).toContain("/Part/tools/Part_Extrude.svg");
  rerender(<FreeCADIcon name="transparent-png" palette="dark" />);
  expect(container.querySelector("img")?.getAttribute("src")).toContain("/Aether/transparent-png.svg");
});

test("new Aether additions are discoverable together and upstream aliases are searchable", () => {
  const { container } = render(<FreeCADIconPack />);
  fireEvent.change(screen.getByLabelText("Workbench"), { target: { value: "Aether" } });
  expect(screen.getByRole("status").textContent).toBe("24 of 1731 icons");
  expect(container.querySelectorAll("img")).toHaveLength(48);
  fireEvent.change(screen.getByLabelText("Find an icon"), { target: { value: "transparent png" } });
  expect(screen.getByRole("status").textContent).toBe("1 of 1731 icons");
  fireEvent.change(screen.getByLabelText("Workbench"), { target: { value: "All" } });
  fireEvent.change(screen.getByLabelText("Find an icon"), { target: { value: "hinge" } });
  expect(screen.getByRole("status").textContent).toBe("1 of 1731 icons");
  expect(container.querySelector("img")?.getAttribute("src")).toContain("Assembly_CreateJointRevolute");
});

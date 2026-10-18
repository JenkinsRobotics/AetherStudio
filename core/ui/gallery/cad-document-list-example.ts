import type { DocumentListItem } from "../src/DocumentList";
import crankshaft from "../../assets/showcase/cad-documents/crankshaft.svg";
import rod from "../../assets/showcase/cad-documents/connecting-rod.svg";
import piston from "../../assets/showcase/cad-documents/piston.svg";
import pin from "../../assets/showcase/cad-documents/piston-pin.svg";
import marker from "../../assets/showcase/cad-documents/origin-marker.svg";
import plate from "../../assets/showcase/cad-documents/base-plate.svg";
import bracket from "../../assets/showcase/cad-documents/l-bracket.svg";
import guide from "../../assets/showcase/cad-documents/guide-rod.svg";
import locating from "../../assets/showcase/cad-documents/locating-pin.svg";
import washer from "../../assets/showcase/cad-documents/square-washer.svg";
import screw from "../../assets/showcase/cad-documents/socket-screw.svg";
import nut from "../../assets/showcase/cad-documents/hex-nut.svg";
import assembly from "../../assets/showcase/cad-documents/piston-assembly.svg";
import rodAssembly from "../../assets/showcase/cad-documents/rod-assembly.svg";

export interface CADListExample extends Omit<DocumentListItem, "thumbnail"> { image: string; kind: "Part" | "Assembly"; material: string; notes: string }
export const CAD_LIST_EXAMPLE: readonly CADListExample[] = [
  { id: "piston-assembly", reference: "ENG-2001", name: "Piston assembly", image: assembly, kind: "Assembly", material: "Mixed", version: "v8", revision: "D", notes: "Piston, pin and connecting rod subassembly." },
  { id: "rod-assembly", reference: "ENG-2002", name: "Connecting rod assembly", image: rodAssembly, kind: "Assembly", material: "Mixed", status: { kind: "branch", label: "assembly-build" }, notes: "Assembly-build branch. Check pin clearance before the next version." },
  { id: "crankshaft", reference: "ENG-1001", name: "Crankshaft", image: crankshaft, kind: "Part", material: "Steel", version: "v8", revision: "D", notes: "Balanced three-throw crankshaft." },
  { id: "connecting-rod", reference: "ENG-1002", name: "Connecting rod", image: rod, kind: "Part", material: "Steel", version: "v8", revision: "E", notes: "Verify small-end bushing fit." },
  { id: "piston", reference: "ENG-1003", name: "Piston", image: piston, kind: "Part", material: "Aluminium", version: "v7", revision: "D", notes: "Three ring grooves. Green finish is illustrative." },
  { id: "piston-pin", reference: "ENG-1004", name: "Piston pin", image: pin, kind: "Part", material: "Steel", version: "v8", revision: "E", notes: "Hollow wrist pin." },
  { id: "origin-marker", reference: "ENG-1005", name: "Origin marker", image: marker, kind: "Part", material: "Aluminium", version: "v8", revision: "D", notes: "Assembly reference marker." },
  { id: "base-plate", reference: "BRK-2001", name: "Base plate", image: plate, kind: "Part", material: "Aluminium", version: "v8", revision: "E", notes: "Mounting plate for the bracket group." },
  { id: "l-bracket", reference: "BRK-2002", name: "L-bracket", image: bracket, kind: "Part", material: "Steel", version: "v7", revision: "D", notes: "Right-angle mounting bracket." },
  { id: "guide-rod", reference: "BRK-2003", name: "Guide rod", image: guide, kind: "Part", material: "Steel", version: "v7", revision: "D", revisionStyle: "outline", notes: "Alignment guide, pending revision review." },
  { id: "locating-pin", reference: "BRK-2004", name: "Locating pin", image: locating, kind: "Part", material: "Steel", version: "v4", status: { kind: "draft", label: "draft" }, notes: "Review pin-head clearance." },
  { id: "square-washer", reference: "BRK-2005", name: "Square washer", image: washer, kind: "Part", material: "Steel", version: "v3", status: { kind: "draft", label: "draft" }, notes: "Square load-spreading washer." },
  { id: "socket-screw", reference: "FST-0022", name: "Socket head screw", image: screw, kind: "Part", material: "Steel", version: "v2", revision: "B", notes: "Standard socket fastener." },
  { id: "hex-nut", reference: "FST-0023", name: "Hex nut", image: nut, kind: "Part", material: "Steel", version: "v2", revision: "A", notes: "Hexagonal threaded nut." },
];

export type CADListFilter = "all" | "parts" | "assemblies" | "drafts";
export type CADListSort = "reference" | "name" | "version" | "original";
export function cadListItems(items: readonly CADListExample[], filter: CADListFilter, sort: CADListSort, ascending: boolean) {
  const result = items.filter(item => filter === "all" || filter === "parts" && item.kind === "Part" || filter === "assemblies" && item.kind === "Assembly" || filter === "drafts" && item.status?.kind === "draft");
  if (sort !== "original") result.sort((a,b) => (a[sort] ?? "").localeCompare(b[sort] ?? "", undefined, { numeric: true }) || a.id.localeCompare(b.id));
  return ascending ? result : result.reverse();
}
export function cadMetadataProblem(items: readonly CADListExample[], item: CADListExample) {
  if (!item.name.trim()) return "Enter a document name.";
  if (!item.reference?.trim()) return "Enter a part number.";
  if (items.some(other => other.id !== item.id && other.reference?.toLocaleLowerCase() === item.reference?.trim().toLocaleLowerCase())) return "That part number is already in use.";
  return "";
}

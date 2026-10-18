import type { ReactNode } from "react";
import { AetherIcon } from "./AetherIcon";
import { ToolIcon, type ToolIconName } from "./ToolIcon";
import type { MenuItem } from "./Menu";
import type { TreeMovePosition } from "./Tree";

export type FeatureTreeKind = "reference" | "feature" | "part" | "folder";
/** Presentation of the owning application's entities, never a CAD document/evaluator. */
export interface FeatureTreeItem {
  id: string;
  label: string;
  kind: FeatureTreeKind;
  type: string;
  icon?: ReactNode;
  hidden?: boolean;
  suppressed?: boolean;
  error?: string;
  dimensionsShown?: boolean;
  dynamicSuppression?: boolean;
  children?: readonly FeatureTreeItem[];
}
export type FeatureTreeCommand = "rename" | "edit" | "copy-sketch" | "dimensions" | "add-to-folder" | "new-folder"
  | "visibility" | "hide-other-sketches" | "hide-all-sketches" | "suppress" | "dynamic-suppression"
  | "comment" | "view-normal" | "dependencies" | "rollback" | "move" | "appearance" | "delete";
export interface FeatureTreeRequest {
  command: FeatureTreeCommand;
  ids: readonly string[];
  name?: string;
  value?: boolean;
  /** Number of active history entries, independent of folders or reference rows. */
  index?: number;
  targetID?: string;
  position?: TreeMovePosition;
}
export interface FeatureTreeAction {
  item: MenuItem;
  request: FeatureTreeRequest;
}
export const DEFAULT_FEATURE_GEOMETRY: readonly FeatureTreeItem[] = [
  { id: "origin", label: "Origin", kind: "reference", type: "point" },
  ...["Top", "Front", "Right"].map(label => ({ id: label.toLowerCase(), label, kind: "reference" as const, type: "plane" })),
];
const iconNames: Record<string, ToolIconName> = {
  sketch:"sketch", profile:"sketch", revolve:"revolve", fillet:"fillet", chamfer:"chamfer", extrude:"extrude",
  shell:"shell", sweep:"sweep", loft:"loft", hole:"hole", mirror:"mirror", pattern:"pattern", transform:"move",
  plane:"plane", point:"point", axis:"axis", part:"part", body:"part", boolean:"boolean", draft:"draft",
  "offset-face":"offset", "face-extrude":"extrude", "import-cad":"part", "import-step":"part",
};
export function FeatureTypeIcon({ type }: { type: string }) {
  if(type === "folder") return <AetherIcon name="collection-folder"/>;
  return iconNames[type] ? <ToolIcon name={iconNames[type]}/> : <AetherIcon name={type === "appearance" ? "appearance" : type === "lighting" ? "lighting" : "cube"}/>;
}
export const flattenFeatureItems = (items: readonly FeatureTreeItem[]): FeatureTreeItem[] => items.flatMap(item => [item, ...flattenFeatureItems(item.children ?? [])]);
export const isSketchFeature = (item: FeatureTreeItem) => item.type === "sketch" || item.type === "profile";

/** Shared ordering/labels/state for every feature menu. Apps only provide capability and dispatch. */
export function featureTreeActions(item: FeatureTreeItem, options: {
  selected: readonly FeatureTreeItem[];
  features: readonly FeatureTreeItem[];
  rollbackIndex?: number;
  available: readonly FeatureTreeCommand[];
  canCommand?: (request: FeatureTreeRequest) => boolean | string;
}): FeatureTreeAction[] {
  const { selected, available, canCommand } = options;
  const ids = selected.map(row => row.id), single = ids.length === 1;
  const history = flattenFeatureItems(options.features).filter(row => row.kind === "feature");
  const folders = flattenFeatureItems(options.features).filter(row => row.kind === "folder");
  const index = history.findIndex(row => row.id === item.id);
  const result: FeatureTreeAction[] = [];
  function add(id: string, label: string, command: FeatureTreeCommand, icon: string, payload: Partial<FeatureTreeRequest> = {}, config: Partial<MenuItem> = {}, valid = true) {
    const request = { command, ids, ...payload };
    const allowed = available.includes(command) && valid ? canCommand?.(request) : undefined;
    const reason = !available.includes(command) ? "This application has not connected this action." : !valid ? "Not available for this selection." : typeof allowed === "string" ? allowed : allowed === false ? "The document does not allow this action." : undefined;
    result.push({ request, item: { id, label, icon: <AetherIcon name={icon}/>, ...config, disabled: Boolean(reason), disabledReason: reason } });
  }
  const editable = selected.every(row => row.kind !== "reference");
  add("rename", "Rename", "rename", "pencil", {}, { shortcut:"F2" }, single && editable);
  if(item.kind === "feature") add("edit", "Edit…", "edit", "settings", {}, {}, single);
  if(isSketchFeature(item)) {
    add("copy-sketch", "Copy sketch", "copy-sketch", "copy", {}, {}, single);
    add("dimensions", item.dimensionsShown ? "Hide dimensions" : "Show dimensions", "dimensions", "ruler", { value:!item.dimensionsShown }, {}, single);
  }
  if(item.kind === "feature" || item.kind === "folder") {
    add("new-folder-selection", "Add selection to new folder", "new-folder", "folder-add", {}, {}, selected.every(row=>row.kind === "feature" || row.kind === "folder"));
    for(const folder of folders.filter(folder => !ids.includes(folder.id))) add(`folder:${folder.id}`, `Move to ${folder.label}`, "add-to-folder", "collection-folder", { targetID:folder.id }, {}, selected.every(row=>row.kind === "feature" || row.kind === "folder"));
  }
  add("visibility", selected.every(row => row.hidden) ? "Show" : "Hide", "visibility", item.hidden ? "visible" : "hidden", {value:selected.every(row => row.hidden)}, {separatorBefore:true});
  if(isSketchFeature(item)) {
    add("hide-other-sketches", "Hide other sketches", "hide-other-sketches", "hidden", {}, {}, single);
    add("hide-all-sketches", "Hide all sketches", "hide-all-sketches", "hidden");
  }
  if(item.kind === "feature") {
    add("suppress", selected.every(row => row.suppressed) ? "Unsuppress" : "Suppress", "suppress", "pause", {value:!selected.every(row => row.suppressed)}, {separatorBefore:true}, selected.every(row=>row.kind === "feature"));
    add("dynamic-suppression", "Dynamic suppression…", "dynamic-suppression", "settings", {}, {}, single);
  }
  add("comment", "Add comment", "comment", "comment", {}, {separatorBefore:true});
  if(isSketchFeature(item) || item.type === "plane") add("view-normal", "View normal to", "view-normal", "view", {}, {}, single);
  if(item.kind === "feature") {
    add("dependencies", "Show dependencies…", "dependencies", "nodes", {}, {}, single);
    add("rollback-here", "Roll to here", "rollback", "history", {index:index+1}, {separatorBefore:true}, single && index >= 0);
    add("rollback-before", "Roll before", "rollback", "history", {index}, {}, single && index >= 0);
    add("rollback-end", "Roll to end", "rollback", "history", {index:history.length});
    for(const [step,label] of [[-1,"Move up"],[1,"Move down"]] as const) {
      const target = history[index+step];
      add(step < 0 ? "move-up" : "move-down",label,"move",step < 0 ? "chevron-up":"chevron-down",{targetID:target?.id,position:step < 0 ? "before":"after"},{separatorBefore:step < 0},single && !!target);
    }
  }
  if(isSketchFeature(item) || item.kind === "part") add("appearance", "Edit appearance…", "appearance", "appearance", {}, {separatorBefore:true}, single);
  if(item.kind !== "reference") add("delete", item.kind === "folder" ? "Dissolve folder" : "Delete", "delete", "delete", {}, {separatorBefore:true,danger:true,shortcut:"Delete"},editable);
  return result;
}

/** Folder choices share one submenu regardless of the application or folder count. */
export function featureTreeMenuItems(actions:readonly FeatureTreeAction[]):MenuItem[]{
  const folderActions=actions.filter(action=>action.item.id === "new-folder-selection" || action.item.id.startsWith("folder:"));
  return actions.flatMap(action=>action.item.id.startsWith("folder:")?[]:action.item.id === "new-folder-selection"?[{id:"folder-menu",label:"Add selection to folder…",icon:<AetherIcon name="collection-folder"/>,children:folderActions.map(entry=>entry.item)}]:[action.item]);
}

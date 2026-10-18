/**
 * Pure state for the Aether Animation Mockup shell — Layout.swift, ToolRibbon.swift,
 * the PanelStackState engine from Sidebars.swift and TreeModel.swift, ported
 * as plain data + functions so they test without a DOM and so React hooks are
 * thin wrappers over them.
 */
import { useCallback, useState } from "react";

// MARK: - Layout (Layout.swift)

export type LayoutPreset = "floating" | "docked" | "canvas";

export interface LayoutFlags {
  showLeft: boolean;
  showRight: boolean;
  leftDocked: boolean;
  rightDocked: boolean;
  rightPinned: boolean;
  ribbonDocked: boolean;
  showStatusBar: boolean;
  panelsOnOuterEdge: boolean;
  showZones: boolean;
}

export const LAYOUT_PRESETS: readonly { id: LayoutPreset; label: string; icon: string }[] = [
  { id: "floating", label: "Floating", icon: "windows" },
  { id: "docked", label: "Docked", icon: "columns" },
  { id: "canvas", label: "Canvas", icon: "fit" },
];

export const defaultLayout = (): LayoutFlags => applyPreset({
  showLeft: true, showRight: true, leftDocked: false, rightDocked: false, rightPinned: true,
  ribbonDocked: false, showStatusBar: true, panelsOnOuterEdge: false, showZones: false,
}, "floating");

/** Floating → sidebars shown, undocked; docked → everything docked; canvas → hidden. */
export function applyPreset(flags: LayoutFlags, preset: LayoutPreset): LayoutFlags {
  switch (preset) {
    case "floating":
      return { ...flags, showLeft: true, showRight: true, leftDocked: false, rightDocked: false, rightPinned: true, ribbonDocked: false };
    case "docked":
      return { ...flags, showLeft: true, showRight: true, leftDocked: true, rightDocked: true, rightPinned: true, ribbonDocked: true };
    case "canvas":
      return { ...flags, showLeft: false, showRight: false, leftDocked: false, rightDocked: false, rightPinned: false, ribbonDocked: false };
  }
}

export function detectPreset(f: LayoutFlags): LayoutPreset | null {
  if (!f.showLeft && !f.showRight && !f.ribbonDocked) return "canvas";
  if (f.showLeft && f.showRight && f.leftDocked && f.rightDocked && f.ribbonDocked) return "docked";
  if (f.showLeft && f.showRight && !f.leftDocked && !f.rightDocked && !f.ribbonDocked) return "floating";
  return null;
}

export const nextPreset = (preset: LayoutPreset | null): LayoutPreset =>
  preset === "floating" ? "docked" : preset === "docked" ? "canvas" : "floating";

export const layoutLabel = (f: LayoutFlags) =>
  LAYOUT_PRESETS.find((p) => p.id === detectPreset(f))?.label ?? "Custom";

export const cyclePreset = (f: LayoutFlags) => applyPreset(f, nextPreset(detectPreset(f)));

// MARK: - Tools (ToolRibbon.swift + WorkspaceShell.swift)

export type ToolDensity = "compact" | "standard" | "expanded";

export const TOOL_DENSITIES: readonly { id: ToolDensity; label: string; detail: string; icon: string }[] = [
  { id: "compact", label: "Compact", detail: "Icons only", icon: "grid-3" },
  { id: "standard", label: "Standard", detail: "Grouped, with headings", icon: "rows" },
  { id: "expanded", label: "Expanded", detail: "Grouped, with the workspace", icon: "grid-2" },
];

export type ToolPopupStyle = "list" | "grid";

export interface RibbonTool {
  id: string;
  icon: string;
  label: string;
  /** Shown inline in the group; a non-primary tool is one of the group's "more" tools, listed under MORE in the
   *  group's heading dropdown (Jonathan, 2026-09-24: more tools live in their section, not in the settings dots). */
  primary: boolean;
  /** Optional product-controlled command state; demos may continue to arm tools. */
  active?: boolean;
  /** Remembered choice in a tool family, independent of the currently armed tool. */
  selected?: boolean;
  disabled?: boolean;
  title?: string;
  variants?: readonly RibbonTool[];
}

export interface ToolGroup {
  id: string;
  name: string;
  tools: RibbonTool[];
  /** The category glyph at Compact density; defaults to the first tool's. */
  icon?: string;
  /** The group's colour on the tinted legacy ribbon (the July-19 "Rex" build). */
  tint?: string;
}

export interface ToolCategory { name: string; groups: ToolGroup[] }

/** The group a tool arms into — carries the tint shown in the prompt bar. */
export interface RibbonGroup { name: string; icon: string; tint: string; tools: RibbonTool[] }

let toolSerial = 0;
/** `RibbonTool("cube", "3D Model")` — ids are minted so two "Measure" tools stay distinct. */
export const tool = (icon: string, label: string, primary = true): RibbonTool =>
  ({ id: `tool-${++toolSerial}`, icon, label, primary });
export const group = (name: string, tools: RibbonTool[], icon?: string, tint?: string): ToolGroup =>
  ({ id: `group-${++toolSerial}`, name, tools, icon, tint });

/** The tinted legacy ribbon takes RibbonGroups; a workspace catalog is ToolGroups. */
export const ribbonGroupsOf = (groups: readonly ToolGroup[], fallbackTint: string): RibbonGroup[] =>
  groups.map((g) => ({ name: g.name, icon: categoryIcon(g), tint: g.tint ?? fallbackTint, tools: g.tools }));
export const ribbonGroup = (name: string, icon: string, tint: string, tools: RibbonTool[]): RibbonGroup =>
  ({ name, icon, tint, tools });

export const categoryIcon = (g: ToolGroup) => g.icon ?? g.tools[0]?.icon ?? "grid-2";
export const primaryTools = (g: ToolGroup) => g.tools.filter((t) => t.primary);
export const overflowTools = (g: ToolGroup) => g.tools.filter((t) => !t.primary);

export interface ArmedTool { tool: RibbonTool; groupName: string; tint: string }

export const toolPrompt = (armed: ArmedTool | null) =>
  armed ? `${armed.tool.label} — click in the viewport. Esc to cancel.` : "";

// MARK: - Panel stack (Sidebars.swift PanelStackState)

export type SidebarSide = "left" | "right";
export interface Offset { x: number; y: number }

export interface PanelStack {
  order: string[];
  side: SidebarSide;
  /** Exclusive = opening one panel closes the others (browser idiom). */
  exclusive: boolean;
  enabled: string[];
  floatingOffset: Record<string, Offset>;
}

export const panelStack = (order: string[], defaults: string[] = [], side: SidebarSide = "right", exclusive = true): PanelStack =>
  ({ order, side, exclusive, enabled: exclusive ? defaults.filter(id => order.includes(id)).slice(0, 1) : [...defaults], floatingOffset: {} });

export const isEnabled = (s: PanelStack, id: string) => s.enabled.includes(id);
export const orderedPanels = (s: PanelStack) => s.order.filter((id) => s.enabled.includes(id));
export const isOpen = (s: PanelStack) => s.enabled.length > 0;
export const isFloating = (s: PanelStack, id: string) => id in s.floatingOffset;
export const stackedPanels = (s: PanelStack) => orderedPanels(s).filter((id) => !(id in s.floatingOffset));
export const floatingPanels = (s: PanelStack) => orderedPanels(s).filter((id) => id in s.floatingOffset);

export function togglePanel(s: PanelStack, id: string): PanelStack {
  if (s.enabled.includes(id)) {
    const { [id]: _gone, ...rest } = s.floatingOffset;
    return { ...s, enabled: s.enabled.filter((e) => e !== id), floatingOffset: rest };
  }
  return s.exclusive
    ? { ...s, enabled: [id], floatingOffset: {} }
    : { ...s, enabled: [...s.enabled, id] };
}

/** Move a stacked panel to a new index among the stacked panels. */
export function reorderStacked(s: PanelStack, id: string, index: number): PanelStack {
  const others = stackedPanels(s).filter((p) => p !== id);
  const open = [...others];
  open.splice(Math.min(Math.max(index, 0), others.length), 0, id);
  const closed = s.order.filter((p) => !s.enabled.includes(p));
  return { ...s, order: [...open, ...floatingPanels(s).filter((p) => p !== id), ...closed] };
}

/** Tear off: float the panel at a slot beside the stack, cascading per floating count. */
export function detachPanel(s: PanelStack, id: string, offset?: Offset): PanelStack {
  const n = Object.keys(s.floatingOffset).length;
  const dx = s.side === "left" ? 230 + n * 18 : -230 - n * 18;
  return { ...s, floatingOffset: { ...s.floatingOffset, [id]: offset ?? { x: dx, y: 40 + n * 28 } } };
}

export function restackPanel(s: PanelStack, id: string): PanelStack {
  const { [id]: _gone, ...rest } = s.floatingOffset;
  return { ...s, floatingOffset: rest };
}

export const setFloatingOffset = (s: PanelStack, id: string, offset: Offset): PanelStack =>
  ({ ...s, floatingOffset: { ...s.floatingOffset, [id]: offset } });

/** True when a floating panel has been dragged back over its home edge. */
export const nearHomeEdge = (s: PanelStack, offset: Offset) =>
  s.side === "left" ? offset.x < 110 : offset.x > -110;

export interface PanelStackActions {
  toggle: (id: string) => void;
  reorder: (id: string, index: number) => void;
  detach: (id: string, offset?: Offset) => void;
  restack: (id: string) => void;
  setOffset: (id: string, offset: Offset) => void;
}

export function usePanelStack(initial: () => PanelStack): [PanelStack, PanelStackActions] {
  const [state, set] = useState(initial);
  const actions: PanelStackActions = {
    toggle: useCallback((id) => set((s) => togglePanel(s, id)), []),
    reorder: useCallback((id, index) => set((s) => reorderStacked(s, id, index)), []),
    detach: useCallback((id, offset) => set((s) => detachPanel(s, id, offset)), []),
    restack: useCallback((id) => set((s) => restackPanel(s, id)), []),
    setOffset: useCallback((id, offset) => set((s) => setFloatingOffset(s, id, offset)), []),
  };
  return [state, actions];
}

// MARK: - Tree (TreeModel.swift)

export interface TreeNode {
  id: string;
  name: string;
  icon: string;
  detail?: string;
  isFolder: boolean;
  children: TreeNode[];
  visible: boolean;
  /** Links a leaf back to a real asset (a part id, mate id, …). */
  payload?: string;
}

let nodeSerial = 0;
export const treeNode = (name: string, icon: string, extra: Partial<Omit<TreeNode, "name" | "icon">> = {}): TreeNode =>
  ({ id: `node-${++nodeSerial}`, name, icon, isFolder: false, children: [], visible: true, ...extra });

export interface TreeState {
  nodes: TreeNode[];
  selection: string[];
  expanded: string[];
  renaming: string | null;
}

export const treeState = (nodes: TreeNode[] = []): TreeState => ({ nodes, selection: [], expanded: [], renaming: null });

export function findNode(id: string, nodes: TreeNode[]): TreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = findNode(id, n.children);
    if (hit) return hit;
  }
  return null;
}

export const removingNodes = (ids: readonly string[], nodes: TreeNode[]): TreeNode[] =>
  nodes.filter((n) => !ids.includes(n.id)).map((n) => ({ ...n, children: removingNodes(ids, n.children) }));

/** Nodes matching `ids`, taken from wherever they sit (grouping). */
export function collectNodes(ids: readonly string[], nodes: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = [];
  for (const n of nodes) {
    if (ids.includes(n.id)) out.push(n);
    else out.push(...collectNodes(ids, n.children));
  }
  return out;
}

export function insertBefore(node: TreeNode, target: string, nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  for (const n of nodes) {
    if (n.id === target) result.push(node);
    result.push({ ...n, children: insertBefore(node, target, n.children) });
  }
  return result;
}

export const containsNode = (id: string, nodes: TreeNode[]): boolean =>
  nodes.some((n) => n.id === id || containsNode(id, n.children));

export function isDescendant(id: string, ancestor: string, nodes: TreeNode[]): boolean {
  const a = findNode(ancestor, nodes);
  return a ? containsNode(id, a.children) : false;
}

export const mutateNode = (id: string, nodes: TreeNode[], change: (n: TreeNode) => TreeNode): TreeNode[] =>
  nodes.map((n) => (n.id === id ? change(n) : { ...n, children: mutateNode(id, n.children, change) }));

export function addFolder(s: TreeState, name = "New Folder"): TreeState {
  const folder = treeNode(name, "folder", { isFolder: true });
  return { ...s, nodes: [...s.nodes, folder], expanded: [...s.expanded, folder.id], selection: [folder.id], renaming: folder.id };
}

/** Wrap the current selection in a new folder. */
export function groupSelection(s: TreeState, name = "New Group"): TreeState {
  const picked = collectNodes(s.selection, s.nodes);
  if (picked.length < 1) return s;
  const folder = treeNode(name, "folder", { isFolder: true, children: picked });
  return { ...s, nodes: [...removingNodes(s.selection, s.nodes), folder], expanded: [...s.expanded, folder.id], selection: [folder.id], renaming: folder.id };
}

export const deleteNodes = (s: TreeState, ids: readonly string[]): TreeState => ({
  ...s,
  nodes: removingNodes(ids, s.nodes),
  selection: s.selection.filter((id) => !ids.includes(id)),
  expanded: s.expanded.filter((id) => !ids.includes(id)),
});

export const renameNode = (s: TreeState, id: string, name: string): TreeState =>
  ({ ...s, nodes: mutateNode(id, s.nodes, (n) => ({ ...n, name: name || n.name })), renaming: null });

export const toggleExpanded = (s: TreeState, id: string): TreeState =>
  ({ ...s, expanded: s.expanded.includes(id) ? s.expanded.filter((e) => e !== id) : [...s.expanded, id] });

export const toggleVisible = (s: TreeState, id: string): TreeState =>
  ({ ...s, nodes: mutateNode(id, s.nodes, (n) => ({ ...n, visible: !n.visible })) });

/**
 * Drag-and-drop: move `dragged` before `target` or, if `target` is a folder and
 * `into` is set, inside it. Refuses to drop a folder into its own descendant.
 */
export function moveNode(s: TreeState, dragged: string, target: string, into: boolean): TreeState {
  if (dragged === target || isDescendant(target, dragged, s.nodes)) return s;
  const node = findNode(dragged, s.nodes);
  if (!node) return s;
  let tree = removingNodes([dragged], s.nodes);
  const t = findNode(target, tree);
  let expanded = s.expanded;
  if (into && t?.isFolder) {
    tree = mutateNode(target, tree, (n) => ({ ...n, children: [...n.children, node] }));
    if (!expanded.includes(target)) expanded = [...expanded, target];
  } else {
    tree = insertBefore(node, target, tree);
    if (!containsNode(node.id, tree)) tree = [...tree, node];
  }
  return { ...s, nodes: tree, expanded };
}

/** Drop onto empty space / a folder header → append to that container. */
export function moveIntoFolder(s: TreeState, dragged: string, folderID: string | null): TreeState {
  const node = findNode(dragged, s.nodes);
  if (!node) return s;
  let tree = removingNodes([dragged], s.nodes);
  let expanded = s.expanded;
  if (folderID && folderID !== dragged && !isDescendant(folderID, dragged, s.nodes)) {
    tree = mutateNode(folderID, tree, (n) => ({ ...n, children: [...n.children, node] }));
    if (!expanded.includes(folderID)) expanded = [...expanded, folderID];
  } else {
    tree = [...tree, node];
  }
  return { ...s, nodes: tree, expanded };
}

export const countLeaves = (nodes: TreeNode[]): number =>
  nodes.reduce((n, node) => n + (node.isFolder ? countLeaves(node.children) : 1), 0);

// MARK: - CodexUI WorkspaceStageTabs label modes (WorkspaceCatalog.swift)

export type StageLabelMode = "automatic" | "all" | "selectedOnly" | "iconsOnly";

export const STAGE_LABEL_MODES: readonly { id: StageLabelMode; label: string }[] = [
  { id: "automatic", label: "Automatic" }, { id: "all", label: "All Labels" }, { id: "selectedOnly", label: "Selected Only" }, { id: "iconsOnly", label: "Icons Only" },
];

/** Automatic shows every label when there is room and only the selected one in compact windows. */
export function showsStageLabel(mode: StageLabelMode, isSelected: boolean, compact: boolean): boolean {
  switch (mode) {
    case "automatic": return compact ? isSelected : true;
    case "all": return true;
    case "selectedOnly": return isSelected;
    case "iconsOnly": return false;
  }
}

import { describe, expect, it } from "vitest";
import {
  addFolder, applyPreset, cyclePreset, defaultLayout, deleteNodes, detachPanel, detectPreset,
  groupSelection, layoutLabel, moveIntoFolder, moveNode, nearHomeEdge, panelStack, reorderStacked,
  restackPanel, stackedPanels, floatingPanels, togglePanel, treeNode, treeState, findNode, toggleVisible, showsStageLabel,
} from "./state";

describe("layout presets (Layout.swift)", () => {
  it("cycles floating → docked → canvas → floating", () => {
    let f = defaultLayout();
    expect(detectPreset(f)).toBe("floating");
    f = cyclePreset(f); expect(detectPreset(f)).toBe("docked");
    f = cyclePreset(f); expect(detectPreset(f)).toBe("canvas");
    f = cyclePreset(f); expect(detectPreset(f)).toBe("floating");
  });

  it("docked forces every sidebar docked and the ribbon in-flow", () => {
    const f = applyPreset(defaultLayout(), "docked");
    expect(f).toMatchObject({ showLeft: true, showRight: true, leftDocked: true, rightDocked: true, ribbonDocked: true });
  });

  it("reads a hand-tuned mix as Custom, like the layout button label", () => {
    const f = { ...defaultLayout(), leftDocked: true };
    expect(detectPreset(f)).toBeNull();
    expect(layoutLabel(f)).toBe("Custom");
  });

  it("keeps chrome preferences across presets", () => {
    const f = applyPreset({ ...defaultLayout(), showStatusBar: false, panelsOnOuterEdge: true }, "canvas");
    expect(f.showStatusBar).toBe(false);
    expect(f.panelsOnOuterEdge).toBe(true);
  });
});

describe("panel stack (Sidebars.swift PanelStackState)", () => {
  const stack = () => panelStack(["View", "Environment", "Appearance", "Inspector"], [], "right", false);

  it("stacks only when explicitly requested; the default selects one", () => {
    let s = togglePanel(togglePanel(stack(), "View"), "Inspector");
    expect(stackedPanels(s)).toEqual(["View", "Inspector"]);
    s = togglePanel(panelStack(["A", "B"], ["A", "B"], "left"), "A");
    expect(s.enabled).toEqual([]);
    s = togglePanel(s, "B");
    expect(stackedPanels(s)).toEqual(["B"]);
  });

  it("closing a floating panel forgets where it floated", () => {
    let s = detachPanel(togglePanel(stack(), "View"), "View");
    expect(floatingPanels(s)).toEqual(["View"]);
    s = togglePanel(s, "View");
    expect(s.floatingOffset).toEqual({});
  });

  it("reorders among stacked panels without losing closed or floating ones", () => {
    let s = stack();
    for (const id of ["View", "Environment", "Appearance"]) s = togglePanel(s, id);
    s = detachPanel(s, "Appearance");
    s = reorderStacked(s, "Environment", 0);
    expect(stackedPanels(s)).toEqual(["Environment", "View"]);
    expect(floatingPanels(s)).toEqual(["Appearance"]);
    expect(s.order).toContain("Inspector");
    s = restackPanel(s, "Appearance");
    expect(stackedPanels(s)).toEqual(["Environment", "View", "Appearance"]);
  });

  it("cascades tear-offs away from the home edge and docks back near it", () => {
    let s = togglePanel(togglePanel(stack(), "View"), "Environment");
    s = detachPanel(detachPanel(s, "View"), "Environment");
    expect(s.floatingOffset.View.x).toBeLessThan(0);
    expect(s.floatingOffset.Environment.y).toBeGreaterThan(s.floatingOffset.View.y);
    expect(nearHomeEdge(s, { x: -50, y: 0 })).toBe(true);
    expect(nearHomeEdge(s, { x: -300, y: 0 })).toBe(false);
    expect(nearHomeEdge(panelStack([], [], "left"), { x: 50, y: 0 })).toBe(true);
  });
});

describe("tree model (TreeModel.swift)", () => {
  const seed = () => {
    const a = treeNode("Base", "cube"), b = treeNode("Arm", "cube"), c = treeNode("Gripper", "cube");
    return { a, b, c, s: treeState([a, b, c]) };
  };

  it("groups the selection into a folder that starts renaming", () => {
    const { a, b, s } = seed();
    const g = groupSelection({ ...s, selection: [a.id, b.id] });
    expect(g.nodes).toHaveLength(2);
    const folder = g.nodes[1];
    expect(folder.isFolder).toBe(true);
    expect(folder.children.map((n) => n.name)).toEqual(["Base", "Arm"]);
    expect(g.renaming).toBe(folder.id);
    expect(g.expanded).toContain(folder.id);
  });

  it("moves before a sibling, and into a folder when asked", () => {
    const { a, b, c, s } = seed();
    let t = moveNode(s, c.id, a.id, false);
    expect(t.nodes.map((n) => n.name)).toEqual(["Gripper", "Base", "Arm"]);
    t = addFolder(t, "Hand");
    const folder = t.nodes[t.nodes.length - 1];
    t = moveNode(t, b.id, folder.id, true);
    expect(findNode(folder.id, t.nodes)?.children.map((n) => n.name)).toEqual(["Arm"]);
  });

  it("refuses to drop a folder into its own descendant", () => {
    const { a, s } = seed();
    let t = addFolder(s, "Outer");
    const outer = t.nodes[t.nodes.length - 1];
    t = moveIntoFolder(t, a.id, outer.id);
    const before = t.nodes;
    t = moveNode(t, outer.id, a.id, true);
    expect(t.nodes).toBe(before);
  });

  it("deletes recursively and drops the selection with it", () => {
    const { a, b, s } = seed();
    let t = addFolder(s, "F");
    const f = t.nodes[3];
    t = moveIntoFolder(t, a.id, f.id);
    t = deleteNodes({ ...t, selection: [f.id, b.id] }, [f.id]);
    expect(t.nodes.map((n) => n.name)).toEqual(["Arm", "Gripper"]);
    expect(t.selection).toEqual([b.id]);
    expect(findNode(a.id, t.nodes)).toBeNull();
  });

  it("toggles visibility on the one node, wherever it sits", () => {
    const { a, s } = seed();
    let t = addFolder(s, "F");
    t = moveIntoFolder(t, a.id, t.nodes[3].id);
    t = toggleVisible(t, a.id);
    expect(findNode(a.id, t.nodes)?.visible).toBe(false);
    expect(t.nodes.every((n) => n.visible)).toBe(true);
  });
});

describe("stage tab label modes (CodexUI WorkspaceCatalog)", () => {
  it("automatic keeps every label when wide and only the selected one when compact", () => {
    expect(showsStageLabel("automatic", false, false)).toBe(true);
    expect(showsStageLabel("automatic", false, true)).toBe(false);
    expect(showsStageLabel("automatic", true, true)).toBe(true);
  });
  it("the explicit modes ignore width", () => {
    expect(showsStageLabel("all", false, true)).toBe(true);
    expect(showsStageLabel("selectedOnly", false, false)).toBe(false);
    expect(showsStageLabel("iconsOnly", true, false)).toBe(false);
  });
});

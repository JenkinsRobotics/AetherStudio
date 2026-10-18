/**
 * TreeView.swift — the universal browser tree over a TreeState: folders,
 * drag-and-drop (reorder + move into folders), grouping, delete, rename and
 * visibility, all on TreeRow so every panel matches.
 */
import { useState, type DragEvent } from "react";
import { Menu } from "../Menu";
import { Sym } from "./icons";
import { addFolder, deleteNodes, groupSelection, moveIntoFolder, moveNode, renameNode, toggleExpanded, toggleVisible, treeNode, type TreeNode, type TreeState } from "./state";
import { AD, PanelAction, TreeRow } from "./widgets";

export interface TreeViewProps {
  model: TreeState;
  onChange: (next: TreeState) => void;
  /** Called when a leaf is activated (single selection), e.g. to select the part. */
  onActivate?: (node: TreeNode) => void;
  ariaLabel?: string;
}

export function TreeView({ model, onChange, onActivate, ariaLabel = "Tree" }: TreeViewProps) {
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ node: TreeNode; x: number; y: number } | null>(null);
  const update = (f: (s: TreeState) => TreeState) => onChange(f(model));

  const dragged = (e: DragEvent) => e.dataTransfer.getData("text/animation-node");

  const activate = (node: TreeNode) => {
    onChange({ ...model, selection: [node.id] });
    if (!node.isFolder) onActivate?.(node);
  };

  const rows = (node: TreeNode, depth: number): React.ReactNode => (
    <div key={node.id} role="group">
      {model.renaming === node.id ? (
        <div className="aui-kit-tree-rename" style={{ paddingLeft: depth * 15 + 10 }}>
          <Sym name={node.isFolder ? "folder" : node.icon} size={12} style={{ color: AD.accent2, width: 16 }} />
          <input autoFocus aria-label="Name" defaultValue={node.name}
            onKeyDown={(e) => { if (e.key === "Enter") update((s) => renameNode(s, node.id, e.currentTarget.value)); if (e.key === "Escape") update((s) => ({ ...s, renaming: null })); }}
            onBlur={(e) => update((s) => renameNode(s, node.id, e.currentTarget.value))} />
          <button type="button" className="aui-kit-plain" aria-label="Done" style={{ color: AD.accent }}><Sym name="check" size={10} weight="bold" /></button>
        </div>
      ) : (
        <div className="aui-kit-tree-drop" data-drop={dropTarget === node.id || undefined} draggable
          onDragStart={(e) => { e.dataTransfer.setData("text/animation-node", node.id); e.dataTransfer.effectAllowed = "move"; }}
          onDragOver={(e) => { e.preventDefault(); setDropTarget(node.id); }}
          onDragLeave={() => setDropTarget((t) => (t === node.id ? null : t))}
          onDrop={(e) => { e.preventDefault(); setDropTarget(null); const id = dragged(e); if (id) update((s) => moveNode(s, id, node.id, node.isFolder)); }}
          onContextMenu={(e) => { e.preventDefault(); setMenu({ node, x: e.clientX, y: e.clientY }); }}>
          <TreeRow depth={depth} icon={node.isFolder ? "folder" : node.icon} title={node.name} detail={node.detail} expandable={node.isFolder}
            expanded={model.expanded.includes(node.id)} selected={model.selection.includes(node.id)} bold={node.isFolder}
            visible={node.visible} onToggleVisible={() => update((s) => toggleVisible(s, node.id))}
            onToggleExpand={() => update((s) => toggleExpanded(s, node.id))} onTap={() => activate(node)} />
        </div>
      )}
      {node.isFolder && model.expanded.includes(node.id) && node.children.map((child) => rows(child, depth + 1))}
    </div>
  );

  return (
    <div className="aui-kit-tree" role="tree" aria-label={ariaLabel}>
      {model.nodes.map((node) => rows(node, 0))}
      <div className="aui-kit-tree-tail" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const id = dragged(e); if (id) update((s) => moveIntoFolder(s, id, null)); }} />
      <div className="aui-kit-divider" style={{ marginTop: 2 }} />
      <div className="aui-kit-tree-actions">
        <button type="button" className="aui-kit-plain aui-kit-t2 aui-kit-s115 aui-kit-hstack-5" onClick={() => update((s) => addFolder(s))}><Sym name="folder-add" size={11} />New Folder</button>
        {model.selection.length > 1 && <button type="button" className="aui-kit-plain aui-kit-t2 aui-kit-s115 aui-kit-hstack-5" onClick={() => update((s) => groupSelection(s))}><Sym name="stack-3d" size={11} />Group</button>}
        <span className="aui-kit-spacer" />
        {model.selection.length > 0 && <button type="button" className="aui-kit-plain" aria-label="Delete selection" title="Delete selection" style={{ color: AD.danger }} onClick={() => update((s) => deleteNodes(s, s.selection))}><Sym name="delete" size={12} /></button>}
      </div>
      <Menu open={menu !== null} anchor={menu ? { x: menu.x, y: menu.y } : null} ariaLabel="Tree item" onClose={() => setMenu(null)}
        items={[
          { id: "rename", label: "Rename" },
          ...(menu?.node.isFolder ? [{ id: "folder-inside", label: "New Folder Inside" }] : []),
          ...(model.selection.length > 1 ? [{ id: "group", label: "Group Selection" }] : []),
          { id: "delete", label: "Delete", danger: true, separatorBefore: true },
        ]}
        onSelect={(id) => {
          const node = menu?.node; setMenu(null); if (!node) return;
          if (id === "rename") onChange({ ...model, selection: [node.id], renaming: node.id });
          if (id === "folder-inside") { const folder = treeNode("New Folder", "folder", { isFolder: true }); update((s) => moveIntoFolder({ ...s, nodes: [...s.nodes, folder] }, folder.id, node.id)); }
          if (id === "group") update((s) => groupSelection(s));
          if (id === "delete") update((s) => deleteNodes(s, s.selection.includes(node.id) ? s.selection : [node.id]));
        }} />
    </div>
  );
}

/** A `PanelAction` pair used under trees ("New Folder" · "Group"). */
export const TreeFooter = ({ onAdd, onFolder, addLabel = "Add" }: { onAdd?: () => void; onFolder?: () => void; addLabel?: string }) => (
  <div className="aui-kit-hstack-8" style={{ padding: 10 }}>
    <PanelAction icon="plus" label={addLabel} onClick={onAdd} />
    <PanelAction icon="folder-add" label="Folder" onClick={onFolder} />
  </div>
);

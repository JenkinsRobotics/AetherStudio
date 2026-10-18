import { useMemo, useState, type ReactNode, type RefObject } from "react";
import { CollectionView, CollectionActions } from "./CollectionView";
import { CollectionFilter, type CollectionFilterOption } from "./CollectionFilter";
import { Menu, type MenuItem } from "./Menu";
import { Tree, type TreeNode, type TreeProps } from "./Tree";
import "./TreePanel.css";

export interface TreeControl {
  id: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  separatorBefore?: boolean;
  shortcut?: "Delete" | "F2";
  onClick: () => void;
}

/** Shared commands act on the selection; row controls describe that row's state. */
export function TreeToolbar({ label, controls }: { label: string; controls: readonly TreeControl[] }) {
  return <CollectionActions label={label} controls={controls} />;
}

export interface TreePanelProps extends TreeProps {
  id?: string;
  title?: string;
  headerActions?: ReactNode;
  /** Common tree commands promoted beside the collection heading. */
  headerControls?: readonly TreeControl[];
  showFilter?: boolean;
  /** @deprecated Collection commands now always live in the header. */
  showFooter?: boolean;
  filterOptions?: readonly CollectionFilterOption[];
  /** Reports type filtering so hosts can disable ambiguous ordering commands. */
  onCategoryChange?: (category: string) => void;
  /** Rows the filter is showing, announced beside the field. */
  filterResultCount?: number;
  onFilterChange?: (query: string) => void;
  filterInputRef?: RefObject<HTMLInputElement | null>;
  filterInputID?: string;
  filterLabel?: string;
  controls?: readonly TreeControl[];
  controlsLabel?: string;
  /** Re-evaluated while open so visibility/lock commands always reflect current state. */
  menuItems?: (id: string) => readonly MenuItem[];
  onCommand?: (nodeID: string, commandID: string) => void;
  menuLabel?: string;
  /** A related collection (for example bodies), below the primary tree. */
  secondary?: ReactNode;
}

function stateRows(nodes: readonly TreeNode[]): TreeNode[] {
  return nodes.map((node) => ({ ...node,
    // Commands remain in the header/menu; only explicit state controls stay on rows.
    actions: node.actions?.filter((action) => action.pinned || action.state),
    children: node.children && stateRows(node.children),
  }));
}

/** The suite's authoring-tree panel: one scroll area, state rows, context menu and header commands. */
export function TreePanel({ id, controls = [], controlsLabel = "Tree controls", menuItems, onCommand, filterResultCount,
  menuLabel = "Item options", secondary, className, nodes, onContextMenu, onSelect, selectedIDs,
  title, headerActions, headerControls, showFilter = true, showFooter: _showFooter, filterOptions, onCategoryChange, onFilterChange, filterInputRef, filterInputID, filterLabel, filter,
  ...tree }: TreePanelProps) {
  const [query, setQuery] = useState(""), [category, setCategory] = useState("all");
  const effectiveQuery = onFilterChange ? filter ?? "" : query;
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const itemsFor = (id: string): readonly MenuItem[] => {
    if (menuItems) return menuItems(id);
    const find = (rows: readonly TreeNode[]): TreeNode | undefined => {
      for (const row of rows) { if (row.id === id) return row; const child = row.children && find(row.children); if (child) return child; }
    };
    return find(nodes)?.actions?.map((action) => ({ id: action.id, label: action.label, icon: action.icon })) ?? [];
  };
  const presentation = useMemo(() => stateRows(filterTreeCategory(nodes, category)), [nodes, category]);
  const expanded = category === 'all' ? tree.expandedIDs : new Set(allBranchIDs(presentation));
  return <CollectionView id={id} title={title ?? tree.ariaLabel} headerActions={headerActions} controls={controls} primaryControls={headerControls} controlsLabel={controlsLabel} className={["aui-tree-panel", className].filter(Boolean).join(" ")}
    filter={showFilter && <CollectionFilter query={effectiveQuery} onQueryChange={onFilterChange ?? setQuery} options={filterOptions} resultCount={filterResultCount}
      value={category} onChange={value => { setCategory(value); onCategoryChange?.(value); }} ariaLabel={filterLabel ?? `Search ${tree.ariaLabel ?? 'Items'}`} inputRef={filterInputRef} inputID={filterInputID} />}
    onKeyDown={(event) => {
    if (event.defaultPrevented) return;
    // Inputs, menus, footer buttons and unfocused selections own their own keys.
    if (!(event.target instanceof HTMLElement) || !event.target.matches('[role="treeitem"][aria-selected="true"]')) return;
    const key = event.key === "Backspace" ? "Delete" : event.key;
    const control = controls.find((entry) => entry.shortcut === key && !entry.disabled);
    if (control && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault(); event.stopPropagation(); control.onClick();
    }
  }}>
    <div className="aui-tree-panel-content">
      <Tree {...tree} rootInset={tree.rootInset ?? 7} rowHeight={tree.rowHeight ?? 24} expandedIDs={expanded} filter={effectiveQuery || filter} nodes={presentation} selectedIDs={selectedIDs} onSelect={onSelect}
        onContextMenu={(id, x, y) => {
          if (!selectedIDs.has(id)) onSelect([id], "single");
          if (itemsFor(id).length) setMenu({ id, x, y });
          onContextMenu?.(id, x, y);
        }} />
    </div>
    {secondary && <div className="aui-tree-panel-secondary">{secondary}</div>}
    {menu && <Menu className="aui-collection-popup" open anchor={{ x: menu.x, y: menu.y }} ariaLabel={menuLabel}
      items={itemsFor(menu.id)} onClose={() => setMenu(null)}
      onSelect={(id) => { (onCommand ?? tree.onAction)?.(menu.id, id); setMenu(null); }} />}
  </CollectionView>;
}

function allBranchIDs(nodes: readonly TreeNode[]): string[] {
  return nodes.flatMap(n => n.children?.length ? [n.id, ...allBranchIDs(n.children)] : []);
}
/** Type filters retain ancestors, so search results never imply a different hierarchy. */
export function filterTreeCategory(nodes: readonly TreeNode[], category: string): TreeNode[] {
  if (category === 'all') return [...nodes];
  return nodes.flatMap(node => {
    const children = node.children && filterTreeCategory(node.children, category);
    return node.category === category || children?.length ? [{ ...node, children }] : [];
  });
}

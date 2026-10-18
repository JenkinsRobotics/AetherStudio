import { TreeRename } from "./TreeRename";
import { AetherIcon } from "./AetherIcon";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  DragEvent,
  KeyboardEvent,
  ReactNode,
  UIEvent,
} from "react";

export interface TreeNode {
  id: string;
  label: string;
  /** Product-defined type used by the shared collection picker. */
  category?: string;
  /** Additional type keywords included in text filtering. */
  searchText?: string;
  icon?: ReactNode;
  /** Counts or other short metadata. Use status icons for state. */
  badge?: string;
  status?: readonly { id: string; label: string; icon: ReactNode }[];
  /** Row cannot be focused, selected, renamed, or dragged. */
  disabled?: boolean;
  /** Protect fixed reference/collection rows from drag gestures. */
  draggable?: boolean;
  /** Ordered leaves split their whole row into before/after drop targets. */
  dropMode?: "hierarchy" | "reorder";
  /** Visually de-emphasized (for example suppressed/hidden entities). */
  dimmed?: boolean;
  /** Extra class on the row element for application-specific presentation. */
  className?: string;
  /** Row presentation variant. "divider" renders a slim draggable rule
   * (feature-history rollback lines) instead of a normal row. */
  variant?: "divider";
  /** Semantic row tone; "error" marks failing entities. */
  tone?: "error";
  /** Hover-revealed trailing actions; clicks never change selection; `pinned` keeps one visible without hover. */
  actions?: readonly { id: string; label: string; icon: ReactNode; pinned?: boolean; state?: boolean }[];
  children?: readonly TreeNode[];
  /** Shows a live child status row while an expanded branch resolves. */
  childrenLoading?: boolean;
  /** Shows a recoverable child error row while the branch is expanded. */
  childrenError?: ReactNode;
}

export type TreeMovePosition = "before" | "inside" | "after";

export interface TreeProps {
  nodes: readonly TreeNode[];
  selectedIDs: ReadonlySet<string>;
  onSelect: (
    ids: readonly string[],
    mode: "single" | "toggle" | "range"
  ) => void;
  ariaLabel?: string;
  /** Double-click, or Enter on an already-selected row. */
  onActivate?: (id: string) => void;
  onContextMenu?: (id: string, x: number, y: number) => void;
  onAction?: (nodeID: string, actionID: string) => void;
  /** Controlled expansion; omit for internal state. */
  expandedIDs?: ReadonlySet<string>;
  onToggle?: (id: string, expanded: boolean) => void;
  defaultCollapsedIDs?: readonly string[];
  /** Reveal ancestors of the controlled selection without forgetting their collapsed state. */
  revealSelection?: boolean;
  /** Case-insensitive filter that keeps matching rows and ancestors. */
  filter?: string;
  emptyState?: ReactNode;
  /** Controlled rename. The application decides when a row enters this mode. */
  renamingID?: string | null;
  onRename?: (id: string, label: string) => void;
  onCancelRename?: (id: string) => void;
  /** Native drag signal; the application remains owner of hierarchy mutation. */
  onMove?: (
    sourceID: string,
    targetID: string,
    position: TreeMovePosition
  ) => void;
  canMove?: (
    sourceID: string,
    targetID: string,
    position: TreeMovePosition
  ) => boolean;
  onRetryChildren?: (id: string) => void;
  /** Visible rows at or above this count use fixed-row windowing. */
  virtualizeThreshold?: number;
  height?: number;
  rowHeight?: number;
  /** Inset before root rows; descendants add the normal hierarchy indentation. */
  rootInset?: number;
  overscan?: number;
  className?: string;
  style?: CSSProperties;
}

interface FlatRow {
  node: TreeNode;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

interface StatusRow {
  kind: "loading" | "error";
  parentID: string;
  depth: number;
  content: ReactNode;
}

type VisualRow =
  | { kind: "node"; row: FlatRow; nodeIndex: number }
  | StatusRow;

function dropPosition(event: DragEvent<HTMLElement>): TreeMovePosition {
  const rect = event.currentTarget.getBoundingClientRect();
  if (rect.height <= 0) return "inside";
  const ratio = (event.clientY - rect.top) / rect.height;
  if (ratio < 0.25) return "before";
  if (ratio > 0.75) return "after";
  return "inside";
}

/** The definitive hierarchical collection for all Aether products. */
export function Tree({
  nodes,
  selectedIDs,
  onSelect,
  ariaLabel,
  onActivate,
  onContextMenu,
  onAction,
  expandedIDs,
  onToggle,
  defaultCollapsedIDs,
  revealSelection = false,
  filter,
  emptyState,
  renamingID,
  onRename,
  onCancelRename,
  onMove,
  canMove,
  onRetryChildren,
  virtualizeThreshold = 1000,
  height = 320,
  rowHeight = 28,
  rootInset = 7,
  overscan = 5,
  className,
  style,
}: TreeProps) {
  const [internalCollapsed, setInternalCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(defaultCollapsedIDs ?? [])
  );
  const [focusedID, setFocusedID] = useState<string | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [dragTarget, setDragTarget] = useState<{
    id: string;
    position: TreeMovePosition;
  } | null>(null);
  const anchorRef = useRef<string | null>(null);
  const dragSourceRef = useRef<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const scrollerRef = useRef<HTMLDivElement>(null);
  const selectionKey = JSON.stringify([...selectedIDs].sort());
  const [revealOverride, setRevealOverride] = useState<{ selection: string; closed: ReadonlySet<string> }>(
    () => ({ selection: selectionKey, closed: new Set() }),
  );
  useEffect(() => {
    setRevealOverride(current => current.selection === selectionKey ? current : { selection: selectionKey, closed: new Set() });
  }, [selectionKey]);

  const isExpanded = useCallback(
    (id: string) =>
      expandedIDs ? expandedIDs.has(id) : !internalCollapsed.has(id),
    [expandedIDs, internalCollapsed]
  );
  const toggle = useCallback(
    (id: string, currentlyExpanded: boolean) => {
      setRevealOverride(current => {
        const closed = new Set(current.selection === selectionKey ? current.closed : []);
        if (currentlyExpanded) closed.add(id); else closed.delete(id);
        return { selection: selectionKey, closed };
      });
      onToggle?.(id, !currentlyExpanded);
      if (!expandedIDs) {
        setInternalCollapsed((current) => {
          const next = new Set(current);
          if (currentlyExpanded) next.add(id);
          else next.delete(id);
          return next;
        });
      }
    },
    [expandedIDs, onToggle, selectionKey]
  );

  const filterText = (filter ?? "").trim().toLocaleLowerCase();
  const matchesFilter = useCallback(
    function matches(node: TreeNode): boolean {
      if (node.label.toLocaleLowerCase().includes(filterText) || node.searchText?.toLocaleLowerCase().includes(filterText)) return true;
      return (node.children ?? []).some(matches);
    },
    [filterText]
  );

  // Keep a controlled selection visible through collapsed ancestors. Moving a
  // layer into a collapsed scene should reveal where it landed; when selection
  // leaves that subtree, the user's original collapsed state applies again.
  const containsSelection = useCallback(
    function contains(node: TreeNode): boolean {
      return selectedIDs.has(node.id) || (node.children ?? []).some(contains);
    },
    [selectedIDs]
  );

  const rows = useMemo<FlatRow[]>(() => {
    const output: FlatRow[] = [];
    const walk = (level: readonly TreeNode[], depth: number) => {
      for (const node of level) {
        if (filterText && !matchesFilter(node)) continue;
        const hasChildren =
          (node.children?.length ?? 0) > 0 ||
          Boolean(node.childrenLoading) ||
          node.childrenError !== undefined;
        const expanded = hasChildren && (filterText ? true
          : isExpanded(node.id) || (revealSelection
            && !(revealOverride.selection === selectionKey && revealOverride.closed.has(node.id))
            && (node.children ?? []).some(containsSelection)));
        output.push({ node, depth, hasChildren, expanded });
        if (expanded && node.children?.length) walk(node.children, depth + 1);
      }
    };
    walk(nodes, 0);
    return output;
  }, [containsSelection, filterText, isExpanded, matchesFilter, nodes, revealSelection, revealOverride, selectionKey]);

  const visualRows = useMemo<VisualRow[]>(() => {
    const output: VisualRow[] = [];
    rows.forEach((row, nodeIndex) => {
      output.push({ kind: "node", row, nodeIndex });
      if (!row.expanded) return;
      if (row.node.childrenLoading) {
        output.push({
          kind: "loading",
          parentID: row.node.id,
          depth: row.depth + 1,
          content: "Loading…",
        });
      } else if (row.node.childrenError !== undefined) {
        output.push({
          kind: "error",
          parentID: row.node.id,
          depth: row.depth + 1,
          content: row.node.childrenError,
        });
      }
    });
    return output;
  }, [rows]);

  const virtualized = visualRows.length >= virtualizeThreshold;
  const visibleRows = useMemo(() => {
    if (!virtualized) return visualRows.map((row, visualIndex) => ({ row, visualIndex }));
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const end = Math.min(
      visualRows.length,
      Math.ceil((scrollTop + height) / rowHeight) + overscan
    );
    return visualRows.slice(start, end).map((row, offset) => ({
      row,
      visualIndex: start + offset,
    }));
  }, [height, overscan, rowHeight, scrollTop, virtualized, visualRows]);

  const applySelect = useCallback(
    (
      row: FlatRow,
      event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }
    ) => {
      if (row.node.disabled || renamingID === row.node.id) return;
      if (event.shiftKey && anchorRef.current) {
        const from = rows.findIndex((entry) => entry.node.id === anchorRef.current);
        const to = rows.findIndex((entry) => entry.node.id === row.node.id);
        if (from >= 0 && to >= 0) {
          const [start, end] = from < to ? [from, to] : [to, from];
          onSelect(
            rows
              .slice(start, end + 1)
              .filter((entry) => !entry.node.disabled)
              .map((entry) => entry.node.id),
            "range"
          );
          return;
        }
      }
      anchorRef.current = row.node.id;
      onSelect(
        [row.node.id],
        event.metaKey || event.ctrlKey ? "toggle" : "single"
      );
    },
    [onSelect, renamingID, rows]
  );

  const focusRow = useCallback(
    (id: string) => {
      setFocusedID(id);
      const element = rowRefs.current.get(id);
      if (element) {
        element.focus();
        return;
      }
      if (!virtualized) return;
      const visualIndex = visualRows.findIndex(
        (entry) => entry.kind === "node" && entry.row.node.id === id
      );
      if (visualIndex < 0) return;
      scrollerRef.current?.scrollTo({
        top: Math.max(0, visualIndex * rowHeight - (height - rowHeight) / 2),
      });
      requestAnimationFrame(() => rowRefs.current.get(id)?.focus());
    },
    [height, rowHeight, virtualized, visualRows]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, row: FlatRow, index: number) => {
      if (event.target !== event.currentTarget) return;
      const enabled = rows.filter((entry) => !entry.node.disabled);
      const enabledIndex = enabled.findIndex((entry) => entry.node.id === row.node.id);
      const move = (target: FlatRow | undefined) => target && focusRow(target.node.id);
      if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
        if (onContextMenu) {
          const box = event.currentTarget.getBoundingClientRect();
          event.preventDefault(); event.stopPropagation(); onContextMenu(row.node.id, box.left + 24, box.bottom);
        }
        return;
      }
      switch (event.key) {
        case "ArrowDown":
          move(enabled[enabledIndex + 1]);
          break;
        case "ArrowUp":
          move(enabled[enabledIndex - 1]);
          break;
        case "ArrowRight":
          if (row.hasChildren && !row.expanded) toggle(row.node.id, false);
          else if (row.hasChildren) move(rows[index + 1]);
          break;
        case "ArrowLeft":
          if (row.hasChildren && row.expanded) {
            toggle(row.node.id, true);
          } else {
            for (let previous = index - 1; previous >= 0; previous--) {
              if (rows[previous].depth < row.depth) {
                move(rows[previous]);
                break;
              }
            }
          }
          break;
        case "Home":
          move(enabled[0]);
          break;
        case "End":
          move(enabled[enabled.length - 1]);
          break;
        case "Enter":
        case " ":
          if (event.key === "Enter" && selectedIDs.has(row.node.id)) {
            onActivate?.(row.node.id);
          } else {
            applySelect(row, event);
          }
          break;
        default:
          return;
      }
      event.preventDefault();
    },
    [applySelect, focusRow, onActivate, onContextMenu, rows, selectedIDs, toggle]
  );

  const handleDragOver = (event: DragEvent<HTMLDivElement>, targetID: string) => {
    const sourceID = dragSourceRef.current;
    if (!sourceID || sourceID === targetID) return;
    let position = dropPosition(event);
    if (position === "inside" && rows.find(row=>row.node.id === targetID)?.node.dropMode === "reorder") {
      const rect=event.currentTarget.getBoundingClientRect();
      position=event.clientY < rect.top + rect.height/2 ? "before" : "after";
    }
    if (canMove && !canMove(sourceID, targetID, position)) { setDragTarget(null); return; }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragTarget({ id: targetID, position });
  };

  const classes = ["aui-tree", className].filter(Boolean).join(" ");
  if (rows.length === 0) {
    return (
      <div className={classes} role="tree" aria-label={ariaLabel} style={style}>
        <div className="aui-tree-empty">{emptyState ?? "empty"}</div>
      </div>
    );
  }

  const tabbableID = rows.find((entry) => !entry.node.disabled && entry.node.id === focusedID)?.node.id
    ?? rows.find((entry) => !entry.node.disabled && selectedIDs.has(entry.node.id))?.node.id
    ?? rows.find((entry) => !entry.node.disabled)?.node.id;

  const renderVisualRow = (visual: VisualRow, visualIndex: number) => {
    const virtualStyle: CSSProperties | undefined = virtualized
      ? {
          position: "absolute",
          top: visualIndex * rowHeight,
          left: 0,
          right: 0,
          height: rowHeight,
        }
      : undefined;
    if (visual.kind !== "node") {
      return (
        <div
          key={`${visual.kind}-${visual.parentID}`}
          className={`aui-tree-child-state aui-tree-child-state--${visual.kind}`}
          role={visual.kind === "error" ? "alert" : "status"}
          style={{ ...virtualStyle, paddingLeft: rootInset + visual.depth * 16 }}
        >
          <AetherIcon name={visual.kind === "loading" ? "history" : "status-error"} />
          <span>{visual.content}</span>
          {visual.kind === "error" && onRetryChildren ? (
            <button type="button" onClick={() => onRetryChildren(visual.parentID)}>
              Retry
            </button>
          ) : null}
        </div>
      );
    }

    const { row, nodeIndex } = visual;
    const { node } = row;
    const selected = selectedIDs.has(node.id);
    const rowClasses = ["aui-tree-row"];
    if (selected) rowClasses.push("aui-tree-row--selected");
    if (node.dimmed) rowClasses.push("aui-tree-row--dimmed");
    if (node.disabled) rowClasses.push("aui-tree-row--disabled");
    if (node.variant === "divider") rowClasses.push("aui-tree-row--divider");
    if (node.tone === "error") rowClasses.push("aui-tree-row--error");
    if (node.className) rowClasses.push(node.className);
    if (dragTarget?.id === node.id) {
      rowClasses.push(`aui-tree-row--drop-${dragTarget.position}`);
    }
    const isRenaming = renamingID === node.id;
    return (
      <div
        key={node.id}
        ref={(element) => {
          if (element) rowRefs.current.set(node.id, element);
          else rowRefs.current.delete(node.id);
        }}
        role="treeitem"
        aria-selected={selected}
        aria-expanded={row.hasChildren ? row.expanded : undefined}
        aria-level={row.depth + 1}
        aria-disabled={node.disabled || undefined}
        className={rowClasses.join(" ")}
        style={{ ...virtualStyle, paddingLeft: rootInset + row.depth * 16 }}
        tabIndex={!node.disabled && tabbableID === node.id ? 0 : -1}
        draggable={Boolean(onMove && node.draggable !== false && !node.disabled && !isRenaming)}
        onFocus={() => setFocusedID(node.id)}
        onClick={(event) => applySelect(row, event)}
        onDoubleClick={() => !node.disabled && !isRenaming && onActivate?.(node.id)}
        onContextMenu={(event) => {
          if (!onContextMenu || node.disabled) return;
          event.preventDefault();
          event.currentTarget.focus();
          onContextMenu(node.id, event.clientX, event.clientY);
        }}
        onKeyDown={(event) => onKeyDown(event, row, nodeIndex)}
        onDragStart={(event) => {
          dragSourceRef.current = node.id;
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", node.id);
        }}
        onDragOver={(event) => handleDragOver(event, node.id)}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDragTarget(null);
          }
        }}
        onDrop={(event) => {
          const sourceID = dragSourceRef.current;
          const target = dragTarget;
          event.preventDefault();
          if (sourceID && target?.id === node.id && (!canMove || canMove(sourceID,node.id,target.position))) {
            onMove?.(sourceID, node.id, target.position);
          }
          dragSourceRef.current = null;
          setDragTarget(null);
        }}
        onDragEnd={() => {
          dragSourceRef.current = null;
          setDragTarget(null);
        }}
      >
        {row.hasChildren ? (
          <button
            type="button"
            className="aui-tree-disclosure"
            aria-label={`${row.expanded ? "Collapse" : "Expand"} ${node.label}`}
            tabIndex={-1}
            disabled={node.disabled}
            onClick={(event) => {
              event.stopPropagation();
              toggle(node.id, row.expanded);
            }}
          >
            <AetherIcon name="chevron" width={14} height={14} style={{ transform: row.expanded ? "rotate(90deg)" : undefined }} />
          </button>
        ) : (
          <span className="aui-tree-disclosure" aria-hidden="true" />
        )}
        <span className="aui-tree-icon" aria-hidden="true">{node.icon ?? ""}</span>
        {isRenaming ? (
          <TreeRename key={node.id} label={node.label}
            onCommit={(value) => { onRename?.(node.id, value); focusRow(node.id); }}
            onCancel={() => { onCancelRename?.(node.id); focusRow(node.id); }} />
        ) : (
          <span className="aui-tree-label" title={node.label}>{node.label}</span>
        )}
        {node.badge || node.status?.length ? <span className="aui-tree-badge">
          {node.badge}
          {node.status?.map((status) => <span className="aui-tree-status" key={status.id} role="img" title={status.label} aria-label={status.label}>{status.icon}</span>)}
        </span> : <span />}
        {node.actions?.length ? (
          <span className="aui-tree-actions">
            {node.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                title={action.label}
                aria-label={action.label}
                className={action.pinned ? "aui-tree-action aui-tree-action--pinned" : "aui-tree-action"}
                tabIndex={-1}
                disabled={node.disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  onAction?.(node.id, action.id);
                }}
              >
                {action.icon}
              </button>
            ))}
          </span>
        ) : null}
      </div>
    );
  };

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    if (virtualized) setScrollTop(event.currentTarget.scrollTop);
  };

  return (
    <div
      ref={scrollerRef}
      className={classes}
      role="tree"
      aria-label={ariaLabel}
      style={{
        ...style,
        ...(virtualized ? { height, overflowY: "auto" } : null),
      }}
      onScroll={handleScroll}
    >
      <div
        className={virtualized ? "aui-tree-window" : undefined}
        style={virtualized ? { height: visualRows.length * rowHeight } : undefined}
      >
        {visibleRows.map(({ row, visualIndex }) => renderVisualRow(row, visualIndex))}
      </div>
    </div>
  );
}

import { useRegisterWorkspaceControls } from './workspace-controls';
import "./WorkspaceShellPlacement.css";
import { useInitialLayoutReady } from "./useInitialLayoutReady";
import "./WorkspaceSafeArea.css";
import "./WorkspaceToolbarFrame.css";
import { WorkspaceLayoutContext } from "./WorkspaceLayoutContext";
import { useClosingPanels, useWorkspaceInsets, WORKSPACE_PANEL_DURATION_MS } from "./WorkspaceShellMotion";
import { Fragment, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { singlePanelPerSide } from "./workspace-panel-selection";
import { Inspector } from "./Inspector";
import { CollectionHost } from "./CollectionView";
import { AetherIcon } from "./AetherIcon";
import { createPortal } from "react-dom";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  Ref,
} from "react";
import { Rail, RailButton } from "./Rail";
import { PanelResizeHandle } from "./PanelResizeHandle";
import { useSidebarSizes } from "./useSidebarSizes";
import { TabbedSidebar } from "./TabbedSidebar";
import type { PanelPlacement } from "./PanelPlacementMenu";
import { DEFAULT_WORKSPACE_CHROME, useWorkspaceChrome, type SidebarAttachment } from "./WorkspaceChromePreferences";

/**
 * The app-window chrome, ported from the Swift `StudioWorkspaceScaffold`:
 * three layout presets — DOCKED (sidebars in flow), FLOATING (chrome
 * floats over the canvas), CANVAS (chrome hidden; edge hot-zones reveal
 * it on hover) — with per-side panel stacks toggled from icon rails and
 * tear-off floating panels that drag anywhere and restack near their
 * home edge. Spec lives in WIDGETS.md ("WorkspaceShell").
 */
export type LayoutPreset = "docked" | "floating" | "canvas";

export interface WorkspacePanel {
  /** Floating combined card height; defaults to fill on the left, content on the right. */
  floatingHeight?: "fill" | "content" | number;
  id: string;
  title: string;
  icon: ReactNode;
  content: ReactNode;
  /** Right-side property panels use the shared inspector. Custom canvases/browsers may opt out. */
  contentLayout?: "inspector" | "custom";
  /** Command entries open an overlay without changing sidebar selection or size. */
  command?: (onClose: () => void) => ReactNode;
  /** Docked presentation renders no title/float/close header; the panel content owns its heading. Rail toggle still closes it. */
  chromeless?: boolean;
  /** A collection owns its header and receives docking commands in its footer menu. */
  collection?: boolean;
  /** Draw a divider above this panel's rail button, to group the rail. */
  separatorBefore?: boolean;
}

const PRESET_ORDER: readonly LayoutPreset[] = ["floating", "docked", "canvas"];
const PRESET_GLYPH: Record<LayoutPreset, string> = {
  floating: "❏",
  docked: "▥",
  canvas: "⛶",
};
const LEFT_PANEL_WIDTH = 232;
const RIGHT_PANEL_WIDTH = 320;
const RESTACK_DISTANCE = 110;

export function nextLayoutPreset(preset: LayoutPreset): LayoutPreset {
  return PRESET_ORDER[(PRESET_ORDER.indexOf(preset) + 1) % PRESET_ORDER.length];
}

/** The studio layout button: cycles Floating → Docked → Canvas. */
export function LayoutPresetButton({
  preset,
  onChange,
}: {
  preset: LayoutPreset;
  onChange: (preset: LayoutPreset) => void;
}) {
  const next = nextLayoutPreset(preset);
  return (
    <button
      type="button"
      className="aui-icon-button"
      title={`Layout: ${preset} — click for ${next}`}
      aria-label={`Layout ${preset}, switch to ${next}`}
      onClick={() => onChange(next)}
    >
      {PRESET_GLYPH[preset]}
    </button>
  );
}

export interface FloatingPanelProps {
  shellSide?: "left" | "right";
  closing?: boolean;
  title: string;
  x: number;
  y: number;
  width?: number;
  onMove: (x: number, y: number) => void;
  onDragEnd?: (x: number, y: number) => void;
  onDock?: () => void;
  onClose?: () => void;
  children: ReactNode;
}

/** A draggable floating panel (drag by header). Also used standalone for
 *  short-lived tools that must stay visible above the workspace. */
export function FloatingPanel(props: FloatingPanelProps) {
  const { title, x, y, width = LEFT_PANEL_WIDTH } = props;
  const drag = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const pos = useRef({ x, y });
  pos.current = { x, y };

  const onPointerDown = (event: ReactPointerEvent) => {
    if ((event.target as HTMLElement).closest("button")) return;
    drag.current = { startX: event.clientX, startY: event.clientY, baseX: x, baseY: y };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent) => {
    if (!drag.current) return;
    props.onMove(
      drag.current.baseX + event.clientX - drag.current.startX,
      drag.current.baseY + event.clientY - drag.current.startY
    );
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    props.onDragEnd?.(pos.current.x, pos.current.y);
  };

  return (
    <div className="aui-float-panel" data-shell-side={props.shellSide} data-closing={props.closing || undefined} aria-hidden={props.closing || undefined} inert={props.closing || undefined} style={{ left: x, top: y, width }}>
      <div
        className="aui-float-panel-header"
        tabIndex={0}
        role="group"
        aria-label={`Move ${title}`}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 40 : 10;
          const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
          if (!delta || event.target !== event.currentTarget) return;
          event.preventDefault();
          props.onMove(x + delta[0], y + delta[1]);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span className="aui-float-panel-title">{title}</span>
        <span className="aui-float-panel-actions">
          {props.onDock ? (
            <button
              type="button"
              className="aui-float-panel-action"
              title="Dock panel"
              aria-label={`Dock ${title}`}
              onClick={props.onDock}
            >
              <AetherIcon name="mode-docked" />
            </button>
          ) : null}
          {props.onClose ? (
            <button
              type="button"
              className="aui-float-panel-action"
              title="Close panel"
              aria-label={`Close ${title}`}
              onClick={props.onClose}
            >
              <AetherIcon name="close" />
            </button>
          ) : null}
        </span>
      </div>
      <div className="aui-float-panel-body">{props.children}</div>
    </div>
  );
}

export interface WorkspaceShellHandle {
  /** Reveal a panel without toggling it closed or remounting its editor. */
  showPanel: (id: string) => void;
}

export interface WorkspaceShellProps {
  /** Approved Model Studio frame; the standard variant remains available for existing specimens. */
  design?: "standard" | "studio";
  controllerRef?: Ref<WorkspaceShellHandle>;
  /** Shared default: animate opening/closing while retaining editor hosts. Set false for immediate transitions. */
  animatePanels?: boolean;
  /** @deprecated Safe areas are now always measured and applied by the shell. */
  measureContentInsets?: boolean;
  preset: LayoutPreset;
  /** Put panel cards at the window edge and icon rails beside the workspace in all layouts. */
  panelsOnOuterEdge?: boolean;
  /** Defaults true: preserve panel DOM, drafts and editor bindings across layout/visibility changes. */
  preservePanelContent?: boolean;
  /** One active panel per side by default. Explicitly opt into stacked panels. */
  panelSelection?: "single" | "multiple";
  /** Additive full-height sidebar variant, with horizontal top/bottom tabs.
   * All standard sidebars share one frame; multiple-panel rails retain tear-off windows. */
  sidebarVariant?: "rail" | "tabs-top" | "tabs-bottom";
  sidebarAttachment?: SidebarAttachment;
  /** Gallery specimens may pin their local design for side-by-side comparisons. */
  inheritChromePreferences?: boolean;
  /** Versioned device-local layouts, remembered independently per preset. */
  storageKey?: string;
  /** Usually a <Ribbon>; docked above the canvas or floating top-center. */
  toolbar?: ReactNode;
  /** Docked toolbar spans the window by default; center keeps sidebars full-height. */
  toolbarSpan?: "window" | "center";
  /** Optional shared app-layout bounds. Existing workspace defaults are retained when omitted. */
  sidebarSizing?: { width: number; minWidth: number; maxWidth: number; minCenterWidth: number };
  /** Panels that keep their own column beside the canvas (Onshape's feature
   *  list): exempt from one-panel-per-side, so the rail's other panels open
   *  in a column between the rail and these instead of replacing them.
   *  Docked layout only. */
  pinnedPanels?: readonly string[];
  /** Widgets that belong to a side's column, above and below its sidebar
   *  (CAD: the view cube on top, the selection filter at the bottom). In
   *  the floating layout they stack in that column; docked, the sidebar owns
   *  the full-height column, and in canvas the column is hidden, so they sit
   *  at that edge of the canvas. */
  sideTop?: { left?: ReactNode; right?: ReactNode };
  sideBottom?: { left?: ReactNode; right?: ReactNode };
  /** Auto (default) recognizes shared toolbars that already own their frame. */
  frameToolbar?: boolean | "auto";
  leftPanels?: readonly WorkspacePanel[];
  rightPanels?: readonly WorkspacePanel[];
  defaultOpenLeft?: readonly string[];
  defaultOpenRight?: readonly string[];
  /** Controlled stable-ID panel presentation. Omit for shell-owned state. */
  panelState?: WorkspacePanelState;
  /** Additional initial state used only when `panelState` is uncontrolled. */
  defaultPanelState?: WorkspacePanelState;
  /** Emits a complete state snapshot after any visibility or position change. */
  onPanelStateChange?: (state: WorkspacePanelState) => void;
  /** Bottom editor strip under the canvas (dope sheet, curves, log). */
  bottom?: ReactNode;
  /** A shared bottom dock inside the center column; follows this shell’s preset. */
  centerBottom?: ReactNode;
  statusBar?: ReactNode;
  style?: CSSProperties;
  /** Framed documents clear surrounding chrome. Continuous canvases extend
   * behind floating chrome; use the measured inset variables for their HUDs. */
  contentPresentation?: "framed" | "canvas";
  /** The center canvas/viewport. */
  children: ReactNode;
}

export interface WorkspaceFloatingPosition {
  x: number;
  y: number;
}

export interface WorkspacePanelPresentation {
  placement: PanelPlacement;
  position?: Readonly<WorkspaceFloatingPosition>;
}

export type WorkspacePanelState = Readonly<
  Record<string, Readonly<WorkspacePanelPresentation>>
>;

function readPanelLayout(key: string, preset: LayoutPreset, fallback: WorkspacePanelState): WorkspacePanelState {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null");
    if (saved?.version !== 1 || !saved.layouts?.[preset]) return fallback;
    const result: Record<string, WorkspacePanelPresentation> = { ...fallback };
    for (const [id, value] of Object.entries(saved.layouts[preset])) {
      const entry = value as WorkspacePanelPresentation;
      if (!entry || !["docked", "floating", "hidden"].includes(entry.placement)) return fallback;
      if (entry.position && (!Number.isFinite(entry.position.x) || !Number.isFinite(entry.position.y))) return fallback;
      result[id] = entry;
    }
    return result;
  } catch { return fallback; }
}

type Edge = "top" | "left" | "right";

export function WorkspaceShell(props: WorkspaceShellProps) {
  const initialLayoutReady = useInitialLayoutReady();
  const studio = props.design === "studio";
  const {
    preset, toolbar, frameToolbar = "auto", preservePanelContent = true, bottom, statusBar, style, children,
    leftPanels = [], rightPanels = [], sidebarVariant: appSidebarVariant = "rail",
  } = props;
  const sharedChrome = useWorkspaceChrome();
  const chrome = props.inheritChromePreferences === false ? DEFAULT_WORKSPACE_CHROME : sharedChrome;
  const sidebarVariant = studio ? "tabs-top" : chrome.sidebarDesign === "app" ? appSidebarVariant : chrome.sidebarDesign;
  const panelsOnOuterEdge = chrome.sidebarOpening === "app" ? props.panelsOnOuterEdge : chrome.sidebarOpening === "outside";
  const animatePanels = chrome.panelMotion === "none" ? false : props.animatePanels ?? true;
  const panelSelection = sidebarVariant === "rail" ? props.panelSelection ?? "single" : "single";
  const unifiedSidebar = panelSelection === "single";
  const sidebarTabs = sidebarVariant === "rail" ? undefined : sidebarVariant === "tabs-top" ? "top" : "bottom";
  const bodyRef = useRef<HTMLDivElement>(null);
  const { sizes: sidebarSizes, update: resizeSidebar, availableWidth } = useSidebarSizes(props.storageKey, bodyRef);
  const panelHosts = useRef(new Map<string, HTMLDivElement>());
  const allPanels = [...leftPanels, ...rightPanels];
  const [commandID, setCommandID] = useState<string | null>(null);
  const closeCommand = useCallback(() => setCommandID(null), []);
  // Stable portal destinations preserve editor state while chrome is rearranged.
  // SSR renders inline; browser slots relocate the same host element.
  if (preservePanelContent && typeof document !== "undefined") {
    for (const panel of allPanels) {
      if (!panelHosts.current.has(panel.id)) {
        const host = document.createElement("div");
        // Named so the docked height chain reaches the app's own panel: an
        // unclassed div here left every panel content-height.
        host.className = "aui-shell-panel-host";
        panelHosts.current.set(panel.id, host);
      }
    }
  }
  const panelContent = (panel: WorkspacePanel) => {
    const host = preservePanelContent ? panelHosts.current.get(panel.id) : undefined;
    return host ? <div className="aui-shell-panel-slot" ref={(slot) => {
      if (slot && host.parentElement !== slot) slot.appendChild(host);
    }} /> : collectionContent(panel);
  };
  const [uncontrolledPanelState, setUncontrolledPanelState] =
    useState<WorkspacePanelState>(() => {
      const initial: Record<string, WorkspacePanelPresentation> = {
        ...(props.defaultPanelState ?? {}),
      };
      for (const id of props.defaultOpenLeft ?? []) {
        initial[id] ??= { placement: "docked" };
      }
      for (const id of props.defaultOpenRight ?? []) {
        initial[id] ??= { placement: "docked" };
      }
      return props.storageKey ? readPanelLayout(props.storageKey, preset, initial) : initial;
    });
  const previousPreset = useRef(preset);
  const initialPanelState = useRef<WorkspacePanelState>({
    ...Object.fromEntries([...(props.defaultOpenLeft ?? []), ...(props.defaultOpenRight ?? [])].map((id) => [id, { placement: "docked" as const }])),
    ...(props.defaultPanelState ?? {}),
  });
  useEffect(() => {
    if (!props.storageKey || props.panelState !== undefined) return;
    if (previousPreset.current !== preset) {
      previousPreset.current = preset;
      setUncontrolledPanelState(readPanelLayout(props.storageKey, preset, initialPanelState.current));
      return;
    }
    try {
      let saved;
      try { saved = JSON.parse(localStorage.getItem(props.storageKey) ?? "null"); } catch { saved = null; }
      const layouts = saved?.version === 1 ? saved.layouts ?? {} : {};
      localStorage.setItem(props.storageKey, JSON.stringify({ version: 1, layouts: { ...layouts, [preset]: uncontrolledPanelState } }));
    } catch { /* Preferences never block editing. */ }
  }, [preset, uncontrolledPanelState, props.storageKey, props.panelState]);
  const rawPanelState = props.panelState ?? uncontrolledPanelState;
  const previousPanelState = useRef<{ input: WorkspacePanelState; selection: WorkspacePanelState } | undefined>(undefined);
  // Studio keeps the primary document tree visible beside its auxiliary card.
  const pinned = new Set(preset === "docked" || studio ? props.pinnedPanels ?? [] : []);
  const sideIDs = [leftPanels.filter(panel => !panel.command && !pinned.has(panel.id)).map(panel => panel.id), rightPanels.filter(panel => !panel.command && !pinned.has(panel.id)).map(panel => panel.id)];
  const commandKey = allPanels.filter(panel => panel.command).map(panel => panel.id).join("|");
  const sideKey = JSON.stringify(sideIDs);
  const panelState = useMemo(() => {
    let state = rawPanelState;
    for (const panels of [leftPanels, rightPanels]) {
      const openCommand = panels.some(panel => panel.command && state[panel.id] && state[panel.id].placement !== "hidden");
      for (const panel of panels) if (panel.command && state[panel.id]?.placement !== "hidden") state = {...state, [panel.id]: {placement:"hidden"}};
      // Old saved layouts may have selected Create version as a panel.
      if (openCommand && !panels.some(panel => !panel.command && state[panel.id] && state[panel.id].placement !== "hidden")) {
        const first = panels.find(panel => !panel.command);
        if (first) state = {...state, [first.id]: {placement:"docked"}};
      }
    }
    // Tabbed sidebars own their full-height panel; old detached windows return
    // to their sidebar rather than keeping unavailable window controls alive.
    if (unifiedSidebar) {
      for (const id of [...sideIDs.flat(), ...pinned]) {
        if (state[id]?.placement === "floating") state = { ...state, [id]: { placement: "docked" } };
      }
    }
    return panelSelection === "single"
      ? singlePanelPerSide(state, sideIDs, previousPanelState.current?.input, undefined, previousPanelState.current?.selection)
      : state;
  }, [rawPanelState, sideKey, commandKey, panelSelection, unifiedSidebar, JSON.stringify([...pinned])]);
  useEffect(() => {
    previousPanelState.current = { input: rawPanelState, selection: panelState };
    // Apply the standard to old saved layouts and externally opened panels too.
    if (panelState !== rawPanelState) {
      if (props.panelState === undefined) setUncontrolledPanelState(panelState);
      props.onPanelStateChange?.(panelState);
    }
  }, [panelState, rawPanelState, props.panelState, props.onPanelStateChange]);
  const closingPanels = useClosingPanels(panelState, animatePanels, preset, [leftPanels.map(panel => panel.id), rightPanels.map(panel => panel.id)]);
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const next = { ...panelState };
      let changed = false;
      for (const panel of allPanels) {
        const entry = next[panel.id];
        if (entry?.placement !== "floating" || !entry.position) continue;
        const width = leftPanels.includes(panel) ? LEFT_PANEL_WIDTH : RIGHT_PANEL_WIDTH;
        const position = {
          x: Math.max(8, Math.min(entry.position.x, body.clientWidth - width - 8)),
          y: Math.max(8, Math.min(entry.position.y, body.clientHeight - 48)),
        };
        if (position.x !== entry.position.x || position.y !== entry.position.y) {
          next[panel.id] = { ...entry, position };
          changed = true;
        }
      }
      if (changed) {
        if (props.panelState === undefined) setUncontrolledPanelState(next);
        props.onPanelStateChange?.(next);
      }
    });
    observer.observe(body);
    return () => observer.disconnect();
  }, [panelState, props.onPanelStateChange]);
  const [revealed, setRevealed] = useState<ReadonlySet<Edge>>(new Set());
  const contentInsets = useWorkspaceInsets(bodyRef, true, preset, [panelState, revealed, toolbar, panelsOnOuterEdge, sidebarVariant, chrome.sidebarAttachment, chrome.tabSize, chrome.tabLabels]);
  const hideTimers = useRef(new Map<Edge, ReturnType<typeof setTimeout>>());

  const reveal = useCallback((edge: Edge) => {
    const timer = hideTimers.current.get(edge);
    if (timer) clearTimeout(timer);
    setRevealed((current) => {
      if (current.has(edge)) return current;
      return new Set(current).add(edge);
    });
  }, []);
  const scheduleHide = useCallback((edge: Edge) => {
    const timer = hideTimers.current.get(edge);
    if (timer) clearTimeout(timer);
    hideTimers.current.set(
      edge,
      setTimeout(() => {
        setRevealed((current) => {
          const next = new Set(current);
          next.delete(edge);
          return next;
        });
      }, 160)
    );
  }, []);

  const panelsFor = (side: "left" | "right") =>
    side === "left" ? leftPanels : rightPanels;
  const minimumSidebarWidth = props.sidebarSizing?.minWidth ?? 180;
  const defaultWidth = (side: "left" | "right") => props.sidebarSizing?.width ?? (side === "left" ? LEFT_PANEL_WIDTH : RIGHT_PANEL_WIDTH);
  const maxSidebarWidth = (side: "left" | "right") => {
    const other = side === "left" ? "right" : "left";
    const otherWidth = Math.max(minimumSidebarWidth, Math.min(props.sidebarSizing?.maxWidth ?? Infinity, sidebarSizes[other]?.width ?? defaultWidth(other)));
    return Math.max(minimumSidebarWidth, Math.min(props.sidebarSizing?.maxWidth ?? Infinity,
      availableWidth - otherWidth - (props.sidebarSizing?.minCenterWidth ?? 120)));
  };
  const widthFor = (side: "left" | "right") => sidebarSizes[side]?.width === undefined ? defaultWidth(side)
    : Math.min(maxSidebarWidth(side), Math.max(minimumSidebarWidth, sidebarSizes[side]!.width!));

  const presentationFor = (id: string): WorkspacePanelPresentation =>
    panelState[id] ?? { placement: "hidden" };

  const renderedPresentationFor = (id: string) => presentationFor(id).placement === "hidden" ? closingPanels[id] ?? presentationFor(id) : presentationFor(id);
  const isClosing = (id: string) => !!closingPanels[id] && presentationFor(id).placement === "hidden";
  const stackProps = (side: "left" | "right") => ({
    "data-closing": !panelsFor(side).some(panel => presentationFor(panel.id).placement === "docked") || undefined,
    style: { "--aui-stack-width": `${widthFor(side)}px` } as CSSProperties,
  });

  const updatePanel = (id: string, next: WorkspacePanelPresentation) => {
    const candidate: WorkspacePanelState = { ...panelState, [id]: next };
    const updated = panelSelection === "single" ? singlePanelPerSide(candidate, sideIDs, panelState, id) : candidate;
    if (props.panelState === undefined) setUncontrolledPanelState(updated);
    props.onPanelStateChange?.(updated);
  };

  const togglePanel = (_side: "left" | "right", id: string) => {
    if (allPanels.find(panel => panel.id === id)?.command) { setCommandID(id); return; }
    const current = presentationFor(id);
    updatePanel(
      id,
      current.placement === "hidden"
        ? { placement: "docked" }
        : { placement: "hidden" },
    );
  };

  useImperativeHandle(props.controllerRef, () => ({
    showPanel(id) {
      const panel = allPanels.find(entry => entry.id === id);
      if (!panel) return;
      if (panel.command) { setCommandID(id); return; }
      const current = presentationFor(id);
      updatePanel(id, current.placement === "hidden" ? { placement: "docked" } : current);
      reveal(leftPanels.includes(panel) ? "left" : "right");
    },
  }));

  const detachPanel = (side: "left" | "right", id: string) => {
    const body = bodyRef.current;
    const count = panelsFor(side).filter(
      (panel) => presentationFor(panel.id).placement === "floating",
    ).length;
    const width = widthFor(side);
    const x =
      side === "left"
        ? 64 + count * 18
        : Math.max(64, (body?.clientWidth ?? 900) - 64 - width - count * 18);
    updatePanel(id, {
      placement: "floating",
      position: { x, y: 56 + count * 28 },
    });
  };

  const restackPanel = (_side: "left" | "right", id: string) => {
    updatePanel(id, { placement: "docked" });
  };

  const movePanel = (side: "left" | "right", id: string, x: number, y: number) => {
    const body = bodyRef.current;
    const width = widthFor(side);
    const maxX = (body?.clientWidth ?? 1200) - width - 8;
    const maxY = (body?.clientHeight ?? 700) - 48;
    const clamped = {
      x: Math.min(Math.max(x, 8), Math.max(8, maxX)),
      y: Math.min(Math.max(y, 8), Math.max(8, maxY)),
    };
    updatePanel(id, { placement: "floating", position: clamped });
  };

  const maybeRestack = (side: "left" | "right", id: string, x: number) => {
    const bodyWidth = bodyRef.current?.clientWidth ?? 1200;
    const nearHome =
      side === "left"
        ? x < RESTACK_DISTANCE
        : bodyWidth - (x + widthFor(side)) < RESTACK_DISTANCE;
    if (nearHome) restackPanel(side, id);
  };

  const rail = (side: "left" | "right") => (
    <Rail>
      {panelsFor(side).map((panel) => (
        <Fragment key={panel.id}>
          {panel.separatorBefore ? <span className="aui-rail-separator" role="separator" /> : null}
          <RailButton
            label={panel.title}
            active={panel.command ? undefined : presentationFor(panel.id).placement !== "hidden"}
            aria-haspopup={panel.command ? "dialog" : undefined}
            onClick={() => togglePanel(side, panel.id)}
          >
            {panel.icon}
          </RailButton>
        </Fragment>
      ))}
    </Rail>
  );

  const collectionContent = (panel: WorkspacePanel) => {
    if (!panel.collection) {
      const inspector = panel.contentLayout === "inspector" || (panel.contentLayout !== "custom" && rightPanels.includes(panel));
      return inspector ? <Inspector>{panel.content}</Inspector> : panel.content;
    }
    const side = leftPanels.includes(panel) ? "left" : "right";
    const floating = presentationFor(panel.id).placement === "floating";
    return <CollectionHost.Provider value={{ title: panel.title, controls: unifiedSidebar ? [] : [
      { id: "panel-placement", label: `${floating ? "Dock" : "Float"} ${panel.title}`, icon: <AetherIcon name="layout" />, separatorBefore: true,
        onClick: () => floating ? restackPanel(side, panel.id) : detachPanel(side, panel.id) },
      { id: "panel-close", label: `Close ${panel.title}`, icon: <AetherIcon name="close" />, onClick: () => togglePanel(side, panel.id) },
    ] }}>{panel.content}</CollectionHost.Provider>;
  };

  const stackedCard = (side: "left" | "right", panel: WorkspacePanel) => (
    <div key={panel.id} className="aui-shell-panel" data-closing={isClosing(panel.id) || undefined} aria-hidden={isClosing(panel.id) || undefined} inert={isClosing(panel.id) || undefined} style={{ width: unifiedSidebar ? "100%" : widthFor(side) }}>
      {unifiedSidebar || panel.chromeless || panel.collection ? null : <div className="aui-shell-panel-header">
        <span>{panel.title}</span>
        <span className="aui-float-panel-actions">
          <button
            type="button"
            className="aui-float-panel-action"
            title="Float panel"
            aria-label={`Float ${panel.title}`}
            onClick={() => detachPanel(side, panel.id)}
          >
            <AetherIcon name="mode-floating" />
          </button>
          <button
            type="button"
            className="aui-float-panel-action"
            title="Close panel"
            aria-label={`Close ${panel.title}`}
            onClick={() => togglePanel(side, panel.id)}
          >
            <AetherIcon name="close" />
          </button>
        </span>
      </div>}
      <div className="aui-shell-panel-body">{panelContent(panel)}</div>
    </div>
  );

  const stackedIDs = (side: "left" | "right") => {
    return panelsFor(side)
      .filter((panel) => renderedPresentationFor(panel.id).placement === "docked")
      .map((panel) => panel.id);
  };

  const tornLayer = (side: "left" | "right") => {
    return panelsFor(side)
      .filter((panel) => renderedPresentationFor(panel.id).placement === "floating")
      .map((panel) => {
        const position = renderedPresentationFor(panel.id).position ?? { x: 64, y: 56 };
        return (
          <FloatingPanel
            shellSide={side}
            closing={isClosing(panel.id)}
            key={panel.id}
            title={panel.title}
            x={position.x}
            y={position.y}
            width={widthFor(side)}
            onMove={(x, y) => movePanel(side, panel.id, x, y)}
            onDragEnd={(x) => maybeRestack(side, panel.id, x)}
            onDock={() => restackPanel(side, panel.id)}
            onClose={() => togglePanel(side, panel.id)}
          >
            {panelContent(panel)}
          </FloatingPanel>
        );
      });
  };

  const tabsFor = (side: "left" | "right") => studio ? side === "left" ? "bottom" : "top" : sidebarTabs;
  const trayPosition = (side: "left" | "right") => {
    const anchor = tabsFor(side) ?? side;
    return panelsOnOuterEdge ? ({ left: "right", right: "left", top: "bottom", bottom: "top" } as const)[anchor] : anchor;
  };
  const sidebarPlacement = (side: "left" | "right") => ({
    "data-sidebar-tabs": tabsFor(side) ?? "side",
    "data-sidebar-anchor": tabsFor(side) ?? side,
    "data-sidebar-opening": panelsOnOuterEdge ? "outside" : "inside",
    "data-tray-position": trayPosition(side),
    style: { "--aui-sidebar-expanded-width": `${widthFor(side)}px` } as CSSProperties,
  });
  const floatingStack = (side: "left" | "right", accessories = true) => {
    const ids = stackedIDs(side);
    const panelsFirst = panelsOnOuterEdge ? side === "left" : side === "right";
    const pinnedIDs = studio ? ids.filter(id => pinned.has(id)) : [];
    if (unifiedSidebar && studio && side === "left" && panelsFor(side).some(panel => pinned.has(panel.id))) return <div className="aui-shell-fledge aui-shell-fledge--left" data-studio-pinned="true" {...sidebarPlacement(side)}>
      {pinnedIDs.length > 0 && <div className="aui-studio-pinned">
        {panelsFor(side).filter(panel => pinnedIDs.includes(panel.id)).map(panel => stackedCard(side, panel))}
        <PanelResizeHandle edge="right" label="Resize features sidebar width" value={widthFor(side)} min={minimumSidebarWidth} max={maxSidebarWidth(side)} onChange={width => resizeSidebar(side, {width})} onReset={() => resizeSidebar(side, {width: undefined})}/>
      </div>}
      {tabbedSidebar(side, ids.filter(id => !pinned.has(id)), true)}
    </div>;
    if (unifiedSidebar) return <div className={`aui-shell-fledge aui-shell-fledge--${side}`} {...sidebarPlacement(side)}>
      {accessories && props.sideTop?.[side] ? <div className="aui-shell-side-accessory aui-shell-side-accessory--top">{props.sideTop[side]}</div> : null}
      {tabbedSidebar(side, ids, true)}
      {accessories && props.sideBottom?.[side] ? <div className="aui-shell-side-accessory aui-shell-side-accessory--bottom">{props.sideBottom[side]}</div> : null}
    </div>;
    return (
      <div
        className={`aui-shell-fledge aui-shell-fledge--${side}`}
        data-panels-first={panelsFirst || undefined}
      >
        {panelsFirst && ids.length > 0 ? floatingCards(side, ids) : null}
        <div className="aui-float">{rail(side)}</div>
        {!panelsFirst && ids.length > 0 ? floatingCards(side, ids) : null}
      </div>
    );
  };

  const tabbedSidebar = (side: "left" | "right", ids: readonly string[], floating = false) => {
    const panels = panelsFor(side);
    const activeTab = panels.find(panel => !pinned.has(panel.id) && presentationFor(panel.id).placement !== "hidden")?.id ?? null;
    return <TabbedSidebar variant={studio ? "slim" : "standard"} floating={floating} heightPolicy={sidebarSizes[side]?.height ?? panels.find(panel => panel.id === activeTab)?.floatingHeight ?? (side === "left" || studio ? "fill" : "content")} ariaLabel={`${side === "left" ? "Left" : "Right"} sidebar`}
      tabs={panels.map(panel => ({ id: panel.id, label: panel.title, icon: panel.icon, separatorBefore: panel.separatorBefore, command: !!panel.command }))}
      activeTab={activeTab} activeTabs={studio ? panels.filter(panel => presentationFor(panel.id).placement !== "hidden").map(panel => panel.id) : undefined}
      onTabToggle={studio ? id => togglePanel(side, id) : undefined} tabPosition={trayPosition(side)} anchor={tabsFor(side) ?? side} expanded={ids.length > 0}
      resize={{ side, width: widthFor(side), minWidth: minimumSidebarWidth, maxWidth: maxSidebarWidth(side),
        onWidthChange: width => resizeSidebar(side, {width}),
        onHeightChange: height => resizeSidebar(side, {height}),
        onResetWidth: () => resizeSidebar(side, {width: undefined}),
        onResetHeight: () => resizeSidebar(side, {height: undefined}) }}
      attachment={props.sidebarAttachment ?? chrome.sidebarAttachment} animate={animatePanels}
      style={{ "--aui-sidebar-expanded-width": `${widthFor(side)}px` } as CSSProperties}
      onTabChange={id => { if (id ?? activeTab) togglePanel(side, (id ?? activeTab)!); }}>
      {panels.filter(panel => ids.includes(panel.id)).map(panel => stackedCard(side, panel))}
    </TabbedSidebar>;
  };

  const floatingCards = (side: "left" | "right", ids: readonly string[]) => (
    <div className="aui-shell-flstack" {...stackProps(side)}>
      {panelsFor(side)
        .filter((panel) => ids.includes(panel.id))
        .map((panel) => (
          <div key={panel.id} className="aui-float">
            {stackedCard(side, panel)}
          </div>
        ))}
    </div>
  );

  const canvasEdge = (edge: Edge, content: ReactNode) => (
    <div
      className={`aui-shell-edge aui-shell-edge--${edge}`}
      onMouseEnter={() => reveal(edge)}
      onMouseLeave={() => scheduleHide(edge)}
    >
      {revealed.has(edge) ? (
        content
      ) : (
        <div className={`aui-shell-handle aui-shell-handle--${edge}`} />
      )}
    </div>
  );

  const overlayChrome = (canvasMode: boolean) => {
    const top = toolbar ? (
      <div className="aui-shell-fltoolbar" data-toolbar-frame={frameToolbar}>
        {frameToolbar ? <div className="aui-float">{toolbar}</div> : toolbar}
      </div>
    ) : null;
    // Canvas reveals sidebars on hover; their column widgets stay on screen at the edge instead.
    const leftChrome = leftPanels.length ? floatingStack("left", !canvasMode) : null;
    const rightChrome = rightPanels.length ? floatingStack("right", !canvasMode) : null;
    if (!canvasMode) {
      return (
        <>
          {top}
          {leftChrome}
          {rightChrome}
        </>
      );
    }
    return (
      <>
        {top ? canvasEdge("top", top) : null}
        {leftChrome ? canvasEdge("left", leftChrome) : null}
        {rightChrome ? canvasEdge("right", rightChrome) : null}
      </>
    );
  };

  const dockedSide = (side: "left" | "right") => {
    const panels = panelsFor(side);
    const ids = stackedIDs(side);
    const isRight = side === "right";
    const panelsFirst = panelsOnOuterEdge ? !isRight : isRight;
    const visible = preset === "docked" && panels.length > 0;
    if (unifiedSidebar) {
      const pinnedColumn = visible ? panels.filter(panel => pinned.has(panel.id) && ids.includes(panel.id)).map(panel =>
        <div key={panel.id} className="aui-shell-pinned" style={{ width: defaultWidth(side) }}>{stackedCard(side, panel)}</div>) : null;
      return <div className={`aui-shell-side${isRight ? " aui-shell-side--right" : ""}`} hidden={!visible} {...sidebarPlacement(side)}>
        {isRight ? pinnedColumn : null}
        {visible ? tabbedSidebar(side, ids.filter(id => !pinned.has(id))) : null}
        {isRight ? null : pinnedColumn}
      </div>;
    }
    return (
      <div
        className={`aui-shell-side${isRight ? " aui-shell-side--right" : ""}`}
        hidden={!visible}
        data-panels-first={panelsFirst || undefined}
      >
        {visible && panelsFirst && ids.length > 0 ? (
          <div className="aui-shell-stack" {...stackProps(side)}>
            {panels
              .filter((panel) => ids.includes(panel.id))
              .map((panel) => stackedCard(side, panel))}
          </div>
        ) : null}
        {visible ? rail(side) : null}
        {visible && !panelsFirst && ids.length > 0 ? (
          <div className="aui-shell-stack" {...stackProps(side)}>
            {panels
              .filter((panel) => ids.includes(panel.id))
              .map((panel) => stackedCard(side, panel))}
          </div>
        ) : null}
      </div>
    );
  };

  useRegisterWorkspaceControls(bodyRef, {
    panels: allPanels.filter(panel=>!panel.command).map(panel=>({id:panel.id,label:panel.title,side:leftPanels.includes(panel)?'left':'right',placement:presentationFor(panel.id).placement})),
    show: id => { const panel=allPanels.find(panel=>panel.id===id);if(!panel)return;if(panel.command){setCommandID(id);return;}updatePanel(id,{placement:'docked'});reveal(leftPanels.includes(panel)?'left':'right'); },
    place: (id,placement) => {const side=leftPanels.some(panel=>panel.id===id)?'left':'right';if(placement==='floating')detachPanel(side,id);else updatePanel(id,{placement});},
    reset: () => {const next=Object.fromEntries(allPanels.map(panel=>[panel.id,initialPanelState.current[panel.id]??{placement:'hidden' as const}]));if(props.panelState===undefined)setUncontrolledPanelState(next);props.onPanelStateChange?.(next);},
  });

  return (
    <WorkspaceLayoutContext.Provider value={preset}>
    <div
      className={`aui-shell${panelsOnOuterEdge ? " aui-shell--panels-outer-edge" : ""}`}
      data-design={props.design ?? "standard"}
      data-layout-ready={initialLayoutReady}
      data-animate-panels={animatePanels}
      data-measure-insets="true"
      data-content-presentation={props.contentPresentation ?? "canvas"}
      data-layout={preset}
      data-panel-selection={panelSelection}
      data-sidebar-variant={sidebarVariant}
      data-panel-relationship={preset === "docked" ? "push" : "overlay"}
      style={{ "--aui-shell-motion-duration": `${WORKSPACE_PANEL_DURATION_MS}ms`, ...contentInsets, ...style } as CSSProperties}
    >
      <div className="aui-shell-body">
        {props.toolbarSpan !== "center" && <div
          className="aui-shell-toolbar"
          hidden={preset !== "docked" || !toolbar}
        >
          {preset === "docked" ? toolbar : null}
        </div>}
        <div className="aui-shell-area" ref={bodyRef}>
          {dockedSide("left")}
          <div className="aui-shell-main">
            {props.toolbarSpan === "center" && <div className="aui-shell-toolbar" hidden={preset !== "docked" || !toolbar}>
              {preset === "docked" ? toolbar : null}
            </div>}
            <div className="aui-shell-center" data-has-bottom-dock={Boolean(props.centerBottom) || undefined}>
              {props.centerBottom ? <div className="aui-shell-center-canvas">{props.contentPresentation === "framed" ? <div className="aui-shell-content">{children}</div> : children}</div>
                : props.contentPresentation === "framed" ? <div className="aui-shell-content">{children}</div> : children}
              {props.centerBottom}
              {preset !== "floating" ? (["left", "right"] as const).flatMap(side => [
                props.sideTop?.[side] ? <div key={`${side}-top`} className={`aui-shell-edge-accessory aui-shell-edge-accessory--${side} aui-shell-edge-accessory--top`}>{props.sideTop[side]}</div> : null,
                props.sideBottom?.[side] ? <div key={`${side}-bottom`} className={`aui-shell-edge-accessory aui-shell-edge-accessory--${side} aui-shell-edge-accessory--bottom`}>{props.sideBottom[side]}</div> : null,
              ]) : null}
            </div>
          </div>
          {dockedSide("right")}
          {preset !== "docked" ? overlayChrome(preset === "canvas") : null}
          {tornLayer("left")}
          {tornLayer("right")}
          {preservePanelContent ? <div hidden>
            {allPanels.filter((panel) => renderedPresentationFor(panel.id).placement === "hidden" || (preset === "canvas" && presentationFor(panel.id).placement === "docked" && !revealed.has(leftPanels.includes(panel) ? "left" : "right")))
              .map((panel) => <div key={panel.id}>{panelContent(panel)}</div>)}
          </div> : null}
          {preservePanelContent ? allPanels.map((panel) => {
            const host = panelHosts.current.get(panel.id);
            return host ? createPortal(collectionContent(panel), host, panel.id) : null;
          }) : null}
        </div>
        {bottom}
      </div>
      {statusBar}
      {commandID && allPanels.find(panel => panel.id === commandID)?.command?.(closeCommand)}
    </div>
    </WorkspaceLayoutContext.Provider>
  );
}

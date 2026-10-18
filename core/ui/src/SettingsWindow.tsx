import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { SharedWorkspaceSettings } from "./SharedWorkspaceSettings";
import { SharedAppearanceSettings } from "./SharedAppearanceSettings";
import { SharedChromeSettings } from "./SharedChromeSettings";
import { SharedHeaderSettings } from "./SharedHeaderSettings";
import { AetherIcon } from "./AetherIcon";

export interface SettingsPane {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SettingsSection {
  title: string;
  panes: SettingsPane[];
}

export interface SettingsWindowProps {
  open: boolean;
  title: string;
  sections: SettingsSection[];
  activePaneID: string;
  onSelectPane: (id: string) => void;
  onClose: () => void;
  /** Native settings open as a modeless utility window. Modal remains
   * available for flows that intentionally block their workspace. */
  presentation?: "floating" | "modal";
  /** The archived Aether settings window is compact; CAD keeps the larger
   * editing surface. */
  size?: "standard" | "large";
  /** Select the mounted app whose header icons are configured. */
  headerAppID?: string;
  /** Content of the active pane. */
  children: ReactNode;
}

/** The suite-standard per-app settings window: macOS anatomy — traffic-light
 *  close, grouped sidebar (General / Viewport / Advanced …), card-based
 *  content pane. Products supply sections and pane content; disabled panes
 *  render greyed out as placeholders. */
export function SettingsWindow(props: SettingsWindowProps) {
  const {
    open,
    title,
    sections,
    activePaneID,
    onSelectPane,
    onClose,
    presentation = "modal",
    size = "large",
  } = props;
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [sharedPane, setSharedPane] = useState<"appearance" | "spacing" | "chrome" | "header" | null>(sections.length === 0 ? "appearance" : null);
  useEffect(() => { if (!open) setSharedPane(sections.length === 0 ? "appearance" : null); }, [open, sections.length]);
  const offsetRef = useRef(offset);
  const drag = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  offsetRef.current = offset;
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, onClose]);
  if (!open) return null;
  const moveBy = (x: number, y: number) => setOffset({ x, y });
  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    drag.current = { startX: event.clientX, startY: event.clientY, ...offsetRef.current };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    moveBy(
      drag.current.x + event.clientX - drag.current.startX,
      drag.current.y + event.clientY - drag.current.startY,
    );
  };
  const onPointerUp = () => { drag.current = null; };
  return (
    <div
      className={`aui-settings-scrim aui-settings-scrim--${presentation}`}
      data-presentation={presentation}
      onClick={presentation === "modal" ? onClose : undefined}
    >
      <div
        className={`aui-settings-window aui-settings-window--${size}`}
        role="dialog"
        aria-label={title}
        aria-modal={presentation === "modal" || undefined}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        onClick={(event) => event.stopPropagation()}
      >
        <header
          className="aui-settings-titlebar"
          tabIndex={0}
          role="group"
          aria-label={`Move ${title}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 40 : 10;
            const delta = {
              ArrowLeft: [-step, 0], ArrowRight: [step, 0],
              ArrowUp: [0, -step], ArrowDown: [0, step],
            }[event.key];
            if (!delta || event.target !== event.currentTarget) return;
            event.preventDefault();
            moveBy(offset.x + delta[0], offset.y + delta[1]);
          }}
        >
          <span className="aui-settings-traffic-lights">
            <button type="button" className="aui-settings-traffic aui-settings-traffic--close" aria-label={`Close ${title}`} onClick={onClose} />
            <span className="aui-settings-traffic aui-settings-traffic--minimize" aria-hidden />
            <span className="aui-settings-traffic aui-settings-traffic--zoom" aria-hidden />
          </span>
          <strong>{title}</strong>
        </header>
        <aside className="aui-settings-sidebar">
          {sections.map((section) => (
            <div key={section.title} className="aui-settings-section">
              <span className="aui-settings-section-title">{section.title}</span>
              {section.panes.map((pane) => (
                <button
                  key={pane.id}
                  type="button"
                  disabled={pane.disabled}
                  aria-current={!sharedPane && pane.id === activePaneID ? "page" : undefined}
                  className={
                    "aui-settings-item" + (!sharedPane && pane.id === activePaneID ? " active" : "")
                  }
                  onClick={() => { setSharedPane(null); onSelectPane(pane.id); }}
                >
                  {pane.icon}
                  <span>{pane.label}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="aui-settings-section">
            <span className="aui-settings-section-title">Aether Studio</span>
            <button type="button" className={`aui-settings-item${sharedPane === "header" ? " active" : ""}`} aria-current={sharedPane === "header" ? "page" : undefined} onClick={() => setSharedPane("header")}><AetherIcon name="pin"/><span>Header</span></button>
            <button type="button" className={`aui-settings-item${sharedPane === "chrome" ? " active" : ""}`}
              aria-current={sharedPane === "chrome" ? "page" : undefined} onClick={() => setSharedPane("chrome")}>
              <AetherIcon name="layout" /><span>Toolbars &amp; tabs</span>
            </button>
            <button type="button" className={`aui-settings-item${sharedPane === "appearance" ? " active" : ""}`}
              aria-current={sharedPane === "appearance" ? "page" : undefined}
              onClick={() => setSharedPane("appearance")}>
              <AetherIcon name="palette" /><span>Appearance &amp; icons</span>
            </button>
            <button type="button" className={`aui-settings-item${sharedPane === "spacing" ? " active" : ""}`}
              aria-current={sharedPane === "spacing" ? "page" : undefined} onClick={() => setSharedPane("spacing")}>
              <AetherIcon name="windows" /><span>Workspace spacing</span>
            </button>
          </div>
        </aside>
        <div className="aui-settings-content">
          <div className="aui-settings-pane">{sharedPane === "header" ? <SharedHeaderSettings appID={props.headerAppID}/> : sharedPane === "chrome" ? <SharedChromeSettings /> : sharedPane === "spacing" ? <SharedWorkspaceSettings /> : sharedPane === "appearance" ? <SharedAppearanceSettings /> : props.children}</div>
        </div>
      </div>
    </div>
  );
}

/** Rounded settings card with the Aether Animation Studio section header: accent icon,
 *  bold title, muted caption. `tone="notice"` renders the accent info card. */
export function SettingsCard(props: {
  title?: ReactNode;
  caption?: ReactNode;
  icon?: ReactNode;
  tone?: "notice";
  children?: ReactNode;
}) {
  return (
    <section className={"aui-settings-card" + (props.tone ? ` ${props.tone}` : "")}>
      {props.title ? (
        <span className="aui-settings-card-header">
          {props.icon ? <span className="aui-settings-card-icon">{props.icon}</span> : null}
          <strong className="aui-settings-card-title">{props.title}</strong>
        </span>
      ) : null}
      {props.caption ? <p className="aui-settings-card-caption">{props.caption}</p> : null}
      {props.children}
    </section>
  );
}

/** Settings row. Default: label left, control right. `stacked` puts the
 *  control full-width under the label line with `value` right-aligned —
 *  the Aether Animation Studio slider row. */
export function SettingsRow(props: {
  label: ReactNode;
  icon?: ReactNode;
  value?: ReactNode;
  caption?: ReactNode;
  disabled?: boolean;
  stacked?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={"aui-settings-row" + (props.disabled ? " disabled" : "") + (props.stacked ? " stacked" : "")}>
      <div className="aui-settings-row-main">
        {props.icon ? <span className="aui-settings-row-icon">{props.icon}</span> : null}
        <span className="aui-settings-row-label">{props.label}</span>
        {props.value !== undefined ? <span className="aui-settings-row-value">{props.value}</span> : null}
        {!props.stacked ? <span className="aui-settings-row-control">{props.children}</span> : null}
      </div>
      {props.stacked ? <div className="aui-settings-row-wide">{props.children}</div> : null}
      {props.caption ? <p className="aui-settings-row-caption">{props.caption}</p> : null}
    </div>
  );
}

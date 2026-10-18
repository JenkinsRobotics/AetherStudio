/**
 * The Aether Animation Mockup widget kit — Design.swift, Widgets.swift,
 * PanelWidgets.swift, NodeWidgets.swift (inputs) and App.swift chrome, ported
 * one struct to one component. Names, props and measurements follow the Swift
 * source so the two can be compared side by side; styling lives in widgets.css
 * under the `aui-kit-` prefix.
 */
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { Sym, ToolGlyph } from "./icons";
import { showsStageLabel, type StageLabelMode } from "./state";

/** The UI.* colour tokens as CSS values, for `tint` props. */
export const AD = {
  accent: "var(--aether-color-accent)",
  accent2: "var(--aether-color-part)",
  warn: "var(--aether-color-warn)",
  danger: "var(--aether-color-error)",
  ok: "var(--aether-color-ok)",
  text: "var(--aether-color-text)",
  text2: "var(--aether-color-text-dim)",
  text3: "var(--aether-color-text-faint)",
  panel: "var(--aether-color-bg-panel)",
  panelHi: "var(--aether-color-bg-control)",
  purple: "var(--aether-color-joint)",
  pink: "var(--aether-color-error)",
  teal: "var(--aether-color-part)",
  blue: "var(--aether-color-accent)",
} as const;

export const tintStyle = (tint?: string, extra?: CSSProperties): CSSProperties =>
  ({ ...(tint ? { "--tint": tint } : {}), ...extra }) as CSSProperties;

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

// MARK: - Design.swift

/** Pill button used in toolbars / palettes. */
export function Pill({ icon, label, active = false, tint = AD.accent, onClick }: {
  icon?: string; label: string; active?: boolean; tint?: string; onClick?: () => void;
}) {
  return (
    <button type="button" className="aui-kit-pill" data-active={active || undefined} style={tintStyle(tint)} onClick={onClick}>
      {icon && <Sym name={icon} size={11} weight="semibold" />}
      <span>{label}</span>
    </button>
  );
}

/** A titled panel container. */
export function Panel({ title, systemImage, accessory, children, className, style }: {
  title?: string; systemImage?: string; accessory?: ReactNode; children: ReactNode; className?: string; style?: CSSProperties;
}) {
  return (
    <div className={cx("aui-kit-panel", className)} style={style}>
      {title && (
        <>
          <div className="aui-kit-panel-head">
            {systemImage && <Sym name={systemImage} size={11} weight="semibold" />}
            <span className="aui-kit-panel-title">{title}</span>
            <span className="aui-kit-spacer" />
            {accessory}
          </div>
          <div className="aui-kit-divider" />
        </>
      )}
      {children}
    </div>
  );
}

/** A tree/list row (Onshape-style). `controls` adds visibility + lock toggles. */
export function Row({ icon, label, detail, indent = 0, tint = AD.text2, selected = false, badge, controls = false, onClick }: {
  icon: string; label: string; detail?: string; indent?: number; tint?: string; selected?: boolean; badge?: string; controls?: boolean; onClick?: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  const [locked, setLocked] = useState(false);
  return (
    <div className="aui-kit-row" data-selected={selected || undefined} data-hidden={hidden || undefined}
      style={tintStyle(tint, { paddingLeft: 10 + indent })} onClick={onClick} role={onClick ? "button" : undefined}>
      <Sym name={icon} size={12} className="aui-kit-row-icon" />
      <span className="aui-kit-row-label">{label}</span>
      <span className="aui-kit-spacer" />
      {badge && <span className="aui-kit-row-badge">{badge}</span>}
      {detail && <span className="aui-kit-row-detail">{detail}</span>}
      {controls && (
        <>
          <button type="button" className="aui-kit-plain" aria-label={locked ? "Unlock" : "Lock"} aria-pressed={locked}
            onClick={(e) => { e.stopPropagation(); setLocked(!locked); }} style={{ color: locked ? AD.accent : AD.text3 }}>
            <Sym name={locked ? "lock" : "unlock"} size={10.5} />
          </button>
          <button type="button" className="aui-kit-plain" aria-label={hidden ? "Show" : "Hide"} aria-pressed={hidden}
            onClick={(e) => { e.stopPropagation(); setHidden(!hidden); }} style={{ color: hidden ? AD.text3 : AD.text2 }}>
            <Sym name={hidden ? "hidden" : "visible"} size={10.5} />
          </button>
        </>
      )}
    </div>
  );
}

/** Small labeled field for inspectors. */
export function Field({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="aui-kit-field">
      <span className="aui-kit-field-label">{label}</span>
      <span className="aui-kit-field-value"><span>{value}</span>{unit && <small>{unit}</small>}</span>
    </div>
  );
}

// MARK: - Widgets.swift

/** Status badge — text in a tinted capsule. */
export const Badge = ({ text, tint = AD.text3 }: { text: string; tint?: string }) =>
  <span className="aui-kit-badge" style={tintStyle(tint)}>{text}</span>;

/** KPI / metric card — label, big value, caption. */
export const MetricCard = ({ title, value, caption, tint = AD.accent }: { title: string; value: string; caption?: string; tint?: string }) => (
  <div className="aui-kit-metric" style={tintStyle(tint)}>
    <span className="aui-kit-metric-title">{title}</span>
    <span className="aui-kit-metric-value">{value}</span>
    {caption && <span className="aui-kit-metric-caption">{caption}</span>}
  </div>
);

/** Plain range input, styled once for every slider in the kit. */
export function Range({ value, onChange, min = 0, max = 1, step = 0.01, ariaLabel, tint, gradient, style }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; ariaLabel: string; tint?: string;
  /** Paints the whole track with these stops instead of a fill-to-value (the native UIDevMaterialSlider: hue, roughness, metallic ramps). */ gradient?: string[]; style?: CSSProperties;
}) {
  const pct = ((value - min) / (max - min || 1)) * 100;
  const vars = { "--pct": `${pct}%`, ...(gradient ? { "--gradient": `linear-gradient(to right, ${gradient.join(", ")})` } : {}), ...style } as CSSProperties;
  return (
    <input type="range" className={gradient ? "aui-kit-range aui-kit-range-gradient" : "aui-kit-range"} aria-label={ariaLabel} min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))} style={tintStyle(tint, vars)} />
  );
}

/** Labeled slider row — label + slider + monospaced readout. */
export function LabeledSlider({ label, value, onChange, min = 0, max = 1, unit = "", tint, readout }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; unit?: string; /** Track colour (CodexUI pose sliders tint per channel). */ tint?: string; /** Replaces the numeric readout, e.g. "+22°". */ readout?: string;
}) {
  return (
    <div className="aui-kit-labeled-slider">
      <div className="aui-kit-between"><span className="aui-kit-t2 aui-kit-s11">{label}</span><span className="aui-kit-mono aui-kit-t3 aui-kit-s10">{readout ?? `${value.toFixed(2)}${unit}`}</span></div>
      <Range value={value} onChange={onChange} min={min} max={max} ariaLabel={label} tint={tint} />
    </div>
  );
}

/** Segmented icon control — theme-styled, single select. */
export function SegmentedIcons({ items, selection, onChange }: {
  items: readonly { icon: string; help: string }[]; selection: number; onChange: (i: number) => void;
}) {
  return (
    <div className="aui-kit-segmented-icons" role="radiogroup">
      {items.map((item, i) => (
        <button key={item.help} type="button" role="radio" aria-checked={selection === i} aria-label={item.help} title={item.help}
          className="aui-kit-segmented-icon" data-active={selection === i || undefined} onClick={() => onChange(i)}>
          <Sym name={item.icon} size={12} weight="medium" />
        </button>
      ))}
    </div>
  );
}

/** Icon tool cluster — vertical/horizontal group of labeled tool buttons. */
export function ToolCluster({ tools, axis = "vertical", solid = false }: {
  /** `tint` colours the active state per tool (CodexUI's selection rail: Cue/Trigger warn, Monitor/Hardware ok, Stop danger). */
  tools: readonly { icon: string; label: string; tint?: string }[]; axis?: "vertical" | "horizontal"; /** Fill the active tool with its tint and white glyph, CodexUI-style. */ solid?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  return (
    <div className="aui-kit-tool-cluster" data-axis={axis} data-solid={solid || undefined} role="radiogroup">
      {tools.map((t, i) => (
        <button key={t.label} type="button" role="radio" aria-checked={selected === i} title={t.label} style={tintStyle(t.tint ?? AD.accent)}
          className="aui-kit-tool-cluster-item" data-active={selected === i || undefined} onClick={() => setSelected(i)}>
          <ToolGlyph name={t.icon} size={14} weight="medium" />
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Inline notification / toast banner. */
export const Toast = ({ icon = "info", message, tint = AD.accent }: { icon?: string; message: string; tint?: string }) => (
  <div className="aui-kit-toast" role="status" style={tintStyle(tint)}>
    <Sym name={icon} size={12} /><span>{message}</span>
  </div>
);

/** Info callout box — icon + title + message. */
export const Callout = ({ icon = "lightbulb", title, message, tint = AD.accent2 }: { icon?: string; title: string; message: string; tint?: string }) => (
  <div className="aui-kit-callout" style={tintStyle(tint)}>
    <Sym name={icon === "lightbulb" ? "lighting" : icon} size={13} />
    <div><strong>{title}</strong><p>{message}</p></div>
  </div>
);

/** macOS-style switch. */
export function Switch({ checked, onChange, label, size = "small" }: { checked: boolean; onChange: (v: boolean) => void; label: string; size?: "mini" | "small" }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="aui-kit-switch" data-size={size}
      onClick={() => onChange(!checked)}><span /></button>
  );
}

/** Labeled toggle row. */
export const ToggleRow = ({ label, isOn, onChange }: { label: string; isOn: boolean; onChange: (v: boolean) => void }) => (
  <div className="aui-kit-between aui-kit-toggle-row">
    <span className="aui-kit-t2 aui-kit-s115">{label}</span>
    <Switch checked={isOn} onChange={onChange} label={label} />
  </div>
);

/** A `Toggle(label)` with the label on the left, as SwiftUI lays it out in a panel. */
export const ToggleLine = ({ label, isOn, onChange, size = "mini" }: { label: string; isOn: boolean; onChange: (v: boolean) => void; size?: "mini" | "small" }) => (
  <label className="aui-kit-toggle-line">
    <span>{label}</span><span className="aui-kit-spacer" /><Switch checked={isOn} onChange={onChange} label={label} size={size} />
  </label>
);

/** Determinate progress bar. */
export const ProgressBar = ({ value, tint = AD.accent }: { value: number; tint?: string }) => (
  <div className="aui-kit-progress" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} style={tintStyle(tint)}>
    <span style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
  </div>
);

/** Boxed numeric property field — label + value + unit in a bordered box. */
export const PropertyField = ({ label, value, unit }: { label: string; value: string; unit?: string }) => (
  <div className="aui-kit-property">
    <span className="aui-kit-property-label">{label}</span>
    <span className="aui-kit-property-box"><span>{value}</span>{unit && <small>{unit}</small>}</span>
  </div>
);

/** Icon command button with an active state. */
export const CommandButton = ({ icon, active = false, onClick, label }: { icon: string; active?: boolean; onClick?: () => void; label?: string }) => (
  <button type="button" className="aui-kit-command" data-active={active || undefined} aria-pressed={active} aria-label={label ?? icon} title={label} onClick={onClick}>
    <Sym name={icon} size={12} />
  </button>
);

/** Rich non-blocking notification — icon, title, message, action + timestamp, dismiss. */
export function NotificationCard({ icon = "status-ok", title, message, action, timestamp = "Just now", tint = AD.ok, onDismiss }: {
  icon?: string; title: string; message: string; action?: string; timestamp?: string; tint?: string; onDismiss?: () => void;
}) {
  return (
    <div className="aui-kit-notification" style={tintStyle(tint)}>
      <div className="aui-kit-notification-head">
        <Sym name={icon} size={13} className="aui-kit-tinted" />
        <div><strong>{title}</strong><p>{message}</p></div>
        <button type="button" className="aui-kit-plain aui-kit-t3" aria-label="Dismiss" onClick={onDismiss}><Sym name="close" size={9} weight="bold" /></button>
      </div>
      <div className="aui-kit-divider" />
      <div className="aui-kit-between">
        {action ? <span className="aui-kit-notification-action">{action}</span> : <span />}
        <span className="aui-kit-t3" style={{ fontSize: 8.5 }}>{timestamp}</span>
      </div>
    </div>
  );
}

/** Modal dialog card — header, content, and Cancel/Confirm actions. */
export function DialogCard({ title, subtitle, icon, confirmLabel = "Create", onCancel, onConfirm, children }: {
  title: string; subtitle?: string; icon?: string; confirmLabel?: string; onCancel?: () => void; onConfirm?: () => void; children: ReactNode;
}) {
  return (
    <div className="aui-kit-dialog-card" role="dialog" aria-label={title}>
      <div className="aui-kit-dialog-head">
        {icon && <Sym name={icon} size={12} weight="semibold" style={{ color: AD.accent }} />}
        <div><strong>{title}</strong>{subtitle && <span>{subtitle}</span>}</div>
      </div>
      <div className="aui-kit-divider" />
      <div className="aui-kit-dialog-body">{children}</div>
      <div className="aui-kit-divider" />
      <div className="aui-kit-dialog-actions">
        <button type="button" className="aui-kit-capsule-btn" onClick={onCancel}>Cancel</button>
        <button type="button" className="aui-kit-capsule-btn" data-primary onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </div>
  );
}

/** Closable document tab strip with an active underline. */
export function DocumentTabs({ tabs, selection, onChange }: { tabs: readonly string[]; selection: number; onChange: (i: number) => void }) {
  return (
    <div className="aui-kit-doc-tabs" role="tablist">
      {tabs.map((t, i) => (
        <button key={t} type="button" role="tab" aria-selected={selection === i} className="aui-kit-doc-tab" data-active={selection === i || undefined} onClick={() => onChange(i)}>
          <span>{t}</span><Sym name="close" size={8} weight="bold" className="aui-kit-t3" />
        </button>
      ))}
    </div>
  );
}

/** Segmented value chip strip — quick-pick options (e.g. FPS, units). */
export const ChipPicker = ({ options, selection, onChange }: { options: readonly string[]; selection: string; onChange: (v: string) => void }) => (
  <div className="aui-kit-chips" role="radiogroup">
    {options.map((opt) => (
      <button key={opt} type="button" role="radio" aria-checked={selection === opt} className="aui-kit-chip" data-active={selection === opt || undefined} onClick={() => onChange(opt)}>{opt}</button>
    ))}
  </div>
);

export const Spinner = ({ size = 28 }: { size?: number }) => <span className="aui-kit-spinner" style={{ width: size, height: size }} aria-hidden />;

/** Busy card for long operations (STEP import). */
export function ProgressCard({ title, detail = "", progress, countText }: { title: string; detail?: string; progress?: number | null; countText?: string }) {
  return (
    <div className="aui-kit-progress-card" role="status">
      <Spinner />
      <div><strong>{title}</strong>{detail && <span>{detail}</span>}</div>
      {progress != null && (
        <div className="aui-kit-progress-card-bar">
          <ProgressBar value={progress} />
          {countText && <span className="aui-kit-mono aui-kit-t3" style={{ fontSize: 9.5 }}>{countText}</span>}
        </div>
      )}
    </div>
  );
}

// MARK: - PanelWidgets.swift

/** Panel with an icon badge, subtitle, and overflow menu. */
export function PanelCard({ title, subtitle, icon, tint = AD.accent, onMenu, children, className, style, contentOnly = false }: {
  title: string; subtitle?: string; icon?: string; tint?: string; onMenu?: () => void; children: ReactNode; className?: string; style?: CSSProperties; contentOnly?: boolean;
}) {
  return (
    <div className={cx("aui-kit-panel aui-kit-panel-card", className)} data-content-only={contentOnly || undefined} style={tintStyle(tint, style)}>
      <div className="aui-kit-panel-card-head" data-subtitle={subtitle ? "" : undefined}>
        {icon && <span className="aui-kit-icon-badge"><Sym name={icon} size={11} weight="semibold" /></span>}
        <div className="aui-kit-panel-card-titles"><strong>{title}</strong>{subtitle && <span>{subtitle}</span>}</div>
        <span className="aui-kit-spacer" />
        <button type="button" className="aui-kit-panel-card-menu" aria-label={`${title} menu`} onClick={onMenu}><Sym name="more" size={11} weight="semibold" /></button>
      </div>
      <div className="aui-kit-divider" />
      {children}
    </div>
  );
}

/** List row with solid-accent selection, optional indent, trailing detail and status dot. */
export function ListRow({ icon, title, detail, level = 0, selected = false, statusColor, onClick }: {
  icon: string; title: string; detail?: string; level?: number; selected?: boolean; statusColor?: string; onClick?: () => void;
}) {
  return (
    <div className="aui-kit-list-row" data-selected={selected || undefined} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      onClick={onClick} onKeyDown={(e) => { if (onClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(); } }}>
      {level > 0 && <span style={{ width: level * 13, flexShrink: 0 }} />}
      <Sym name={icon} size={10.5} weight="medium" className="aui-kit-list-row-icon" />
      <span className="aui-kit-list-row-title">{title}</span>
      <span className="aui-kit-spacer" />
      {detail && <span className="aui-kit-list-row-detail">{detail}</span>}
      {statusColor && <span className="aui-kit-dot" style={{ background: statusColor }} />}
    </div>
  );
}

/** Small footer action button used under panel lists ("+ Clip", duplicate…). */
export const PanelAction = ({ icon, label, onClick }: { icon?: string; label?: string; onClick?: () => void }) => (
  <button type="button" className="aui-kit-panel-action" aria-label={label ?? icon} title={label} onClick={onClick}>
    {icon && <Sym name={icon} size={10.5} weight="semibold" />}
    {label && <span>{label}</span>}
  </button>
);

// MARK: - TreeRow.swift

/** One canonical row for every file-tree / browser panel (Fusion-browser layout). */
export function TreeRow({ depth = 0, icon, title, count, detail, expandable = false, expanded = false, selected = false, muted = false, bold = false,
  visible = true, onToggleVisible, onToggleExpand, onTap, trailing, dragHandleProps }: {
  depth?: number; icon: string; title: string; count?: number; detail?: string; expandable?: boolean; expanded?: boolean; selected?: boolean;
  muted?: boolean; bold?: boolean; visible?: boolean; onToggleVisible?: () => void; onToggleExpand?: () => void; onTap?: () => void; trailing?: ReactNode;
  dragHandleProps?: Record<string, unknown>;
}) {
  return (
    <div className="aui-kit-tree-row" role={onTap ? "treeitem" : undefined} aria-selected={onTap ? selected : undefined} aria-expanded={expandable ? expanded : undefined}
      aria-level={depth + 1} tabIndex={onTap ? 0 : undefined} data-selected={selected || undefined} data-muted={muted || undefined} data-bold={bold || undefined}
      data-visible={visible ? undefined : "false"} style={{ paddingLeft: depth * 15 + 10 }} onClick={onTap}
      onKeyDown={(e) => { if (onTap && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onTap(); } }} {...dragHandleProps}>
      <span className="aui-kit-tree-disclosure">
        {expandable && (
          <button type="button" className="aui-kit-plain" aria-label={expanded ? "Collapse" : "Expand"} onClick={(e) => { e.stopPropagation(); (onToggleExpand ?? onTap)?.(); }}>
            <Sym name="chevron-right" size={9} weight="semibold" style={{ transform: expanded ? "rotate(90deg)" : undefined, transition: "transform .16s" }} />
          </button>
        )}
      </span>
      {onToggleVisible && (
        <button type="button" className="aui-kit-plain aui-kit-tree-eye" aria-label={visible ? "Hide" : "Show"} aria-pressed={!visible} onClick={(e) => { e.stopPropagation(); onToggleVisible(); }}>
          <Sym name={visible ? "visible" : "hidden"} size={10} />
        </button>
      )}
      <Sym name={icon} size={12} className="aui-kit-tree-icon" />
      <span className="aui-kit-tree-title">{title}</span>
      <span className="aui-kit-spacer" />
      {count != null ? <span className="aui-kit-tree-count">{count}</span> : detail ? <span className="aui-kit-tree-detail">{detail}</span> : null}
      {trailing}
    </div>
  );
}

// MARK: - NodeWidgets.swift (inputs)

/** Search / filter input. */
export function SearchField({ placeholder = "Filter items", text, onChange }: { placeholder?: string; text: string; onChange: (v: string) => void }) {
  return (
    <div className="aui-kit-search">
      <Sym name="search" size={11} className="aui-kit-t3" />
      <input type="search" value={text} placeholder={placeholder} aria-label={placeholder} onChange={(e) => onChange(e.target.value)} />
      {text && <button type="button" className="aui-kit-plain aui-kit-t3" aria-label="Clear" onClick={() => onChange("")}><Sym name="close-circle" size={11} /></button>}
    </div>
  );
}

/** Numeric field with −/+ steppers. */
export function StepperField({ label, value, onChange, step = 1, unit = "" }: { label: string; value: number; onChange: (v: number) => void; step?: number; unit?: string }) {
  return (
    <div className="aui-kit-stepper">
      <span className="aui-kit-property-label">{label}</span>
      <div className="aui-kit-stepper-box" role="group" aria-label={label}>
        <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(value - step)}><Sym name="minus" size={9} weight="bold" /></button>
        <span className="aui-kit-stepper-value"><span>{value.toFixed(1)}</span>{unit && <small>{unit}</small>}</span>
        <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(value + step)}><Sym name="plus" size={9} weight="bold" /></button>
      </div>
    </div>
  );
}

/** Simple segmented text tabs for inspectors (Properties · Appearance · Output). */
export const InspectorTabs = ({ tabs, selection, onChange }: { tabs: readonly (string | { label: string; icon: string })[]; selection: number; onChange: (i: number) => void }) => (
  <div className="aui-kit-inspector-tabs" role="tablist">
    {tabs.map((t, i) => {
      const tab = typeof t === "string" ? { label: t } : t;
      return (
        <button key={tab.label} type="button" role="tab" aria-selected={selection === i} data-active={selection === i || undefined} onClick={() => onChange(i)}>
          {"icon" in tab && tab.icon && <Sym name={tab.icon} size={10} />}{tab.label}
        </button>
      );
    })}
  </div>
);

/** A `Picker(.segmented)` — text or icon segments. */
export function Segmented<T extends string>({ options, value, onChange, ariaLabel, size = "small" }: {
  options: readonly { id: T; label?: string; icon?: string }[]; value: T; onChange: (v: T) => void; ariaLabel: string; size?: "mini" | "small" | "regular";
}) {
  return (
    <div className="aui-kit-segmented" role="radiogroup" aria-label={ariaLabel} data-size={size}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} aria-label={o.label ?? o.id} data-active={value === o.id || undefined} onClick={() => onChange(o.id)}>
          {o.icon ? <Sym name={o.icon} size={12} /> : o.label}
        </button>
      ))}
    </div>
  );
}

// MARK: - App.swift chrome

export interface StageDef { id: string; name: string; icon: string }

/** One pipeline tab in the top bar. */
export const StageChip = ({ stage, active, compact = false, showLabel = !compact, onClick }: { stage: StageDef; active: boolean; compact?: boolean; /** Overrides the label rule (CodexUI's label modes). */ showLabel?: boolean; onClick?: () => void }) => (
  <button type="button" role="tab" aria-selected={active} className="aui-kit-stage-chip" data-active={active || undefined} data-compact={!showLabel || undefined} data-small={compact || undefined} title={stage.name} onClick={onClick}>
    <Sym name={stage.icon} size={12} weight="medium" /><span>{stage.name}</span>
  </button>
);

/** The 24pt footer strip. */
export function StatusBar({ workspace, model, engine = "RealityKit", themeName = "Studio Blue", kernel = "OCCT 7.8" }: {
  workspace: string; model?: { name: string; triangles: number } | null; engine?: string; themeName?: string; kernel?: string;
}) {
  return (
    <footer className="aui-kit-status-bar" aria-label="Status">
      <span className="aui-kit-status-dot" />
      <strong>Aether Animation Studio</strong>
      <span className="aui-kit-hair" />
      <span>{workspace}</span>
      {model && (<><span className="aui-kit-hair" /><Sym name="cube" size={9} /><span>{model.name} · {model.triangles.toLocaleString()} tris</span></>)}
      <span className="aui-kit-spacer" />
      <Sym name="cpu" size={9} /><span>{engine}</span>
      <span className="aui-kit-hair" />
      <span>{themeName}</span>
      <span className="aui-kit-hair" />
      <span>{kernel}</span>
    </footer>
  );
}

export interface SystemOutput { icon: string; name: string; detail: string; status: string; tint: string; statusTint: string }

const SYSTEM_OUTPUTS: readonly SystemOutput[] = [
  { icon: "cpu", name: "Servo bus", detail: "PCA9685 · 6ch", status: "Armed", tint: AD.accent2, statusTint: AD.ok },
  { icon: "audio", name: "Audio", detail: "Built-in · L/R", status: "Ready", tint: AD.warn, statusTint: AD.ok },
  { icon: "screen-play", name: "Video wall", detail: "HDMI-1", status: "Ready", tint: AD.warn, statusTint: AD.ok },
  { icon: "lighting", name: "DMX lights", detail: "8 fixtures", status: "Offline", tint: AD.text3, statusTint: AD.text3 },
];

/** The Live popover — outputs and media the show is bound to. */
export function SystemStatusView({ outputs = SYSTEM_OUTPUTS, media = [{ name: "hello.wav", icon: "waveform" }, { name: "eyes.mov", icon: "film-stack" }] }: {
  outputs?: readonly SystemOutput[]; media?: readonly { name: string; icon: string }[];
}) {
  return (
    <div className="aui-kit-system-status">
      <span className="aui-kit-caption">OUTPUTS</span>
      {outputs.map((o) => (
        <div key={o.name} className="aui-kit-binding-row">
          <Sym name={o.icon} size={14} style={{ color: o.tint, width: 20 }} />
          <div><span>{o.name}</span><small>{o.detail}</small></div>
          <span className="aui-kit-spacer" />
          <span className="aui-kit-status-capsule" style={tintStyle(o.statusTint)}>{o.status}</span>
        </div>
      ))}
      <div className="aui-kit-divider" style={{ margin: "6px 0" }} />
      <span className="aui-kit-caption">MEDIA</span>
      <div className="aui-kit-media-chips">
        {media.map((m) => <span key={m.name} className="aui-kit-media-chip"><Sym name={m.icon} size={11} style={{ color: AD.warn }} />{m.name}</span>)}
      </div>
    </div>
  );
}

/** 28×24 icon button from the home header / file cluster. */
export const HeaderIcon = ({ icon, label, onClick, active = false, tint }: { icon: string; label: string; onClick?: () => void; active?: boolean; tint?: string }) => (
  <button type="button" className="aui-kit-header-icon" aria-label={label} title={label} data-active={active || undefined} style={tintStyle(tint)} onClick={onClick}>
    <Sym name={icon} size={12} />
  </button>
);

/** Section caption: 9.5pt semibold, tracked, text3. */
export const Caption = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => <span className="aui-kit-caption" style={style}>{children}</span>;

export const Divider = ({ vertical = false, height, style }: { vertical?: boolean; height?: number; style?: CSSProperties }) =>
  <span className={vertical ? "aui-kit-vdivider" : "aui-kit-divider"} style={{ height: vertical ? height : undefined, ...style }} />;

/** Shapes from the kit. */
export const Diamond = ({ size = 22, fill = AD.accent, className, style }: { size?: number; fill?: string; className?: string; style?: CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" className={className} style={style} aria-hidden><path d="M5 0 10 5 5 10 0 5z" fill={fill} /></svg>
);
export const Triangle = ({ size = 22, fill = AD.accent2 }: { size?: number; fill?: string }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden><path d="M5 0 10 10H0z" fill={fill} /></svg>
);

/** Accessible name plumbing for labelled controls. */
export const useLabelId = () => useId();

// MARK: - CodexUI (the archived Atlas demo, removed 2026-09-23) — widgets the Aether demo kit lacked

/** The centred workspace navigator: authoring stages, a divider, then the utilities (WorkspaceStageTabs.swift). */
export function WorkspaceStageTabs({ stages, activeID, onSelect, compact = false, labelMode = "automatic", utilityStartID }: {
  stages: readonly StageDef[]; activeID: string; onSelect?: (id: string) => void; compact?: boolean; labelMode?: StageLabelMode; /** The first utility stage; a hairline sits before it. */ utilityStartID?: string;
}) {
  return (
    <div className="aui-kit-stage-tabs" role="tablist" aria-label="Workspaces" data-compact={compact || undefined}>
      {stages.map((stage) => (
        <span key={stage.id} style={{ display: "contents" }}>
          {stage.id === utilityStartID && <span className="aui-kit-vdivider" style={{ height: 22, margin: "0 3px", alignSelf: "center" }} />}
          <StageChip stage={stage} active={stage.id === activeID} compact={compact} showLabel={showsStageLabel(labelMode, stage.id === activeID, compact)} onClick={() => onSelect?.(stage.id)} />
        </span>
      ))}
    </div>
  );
}

/** The guided-tour bar over the workspace: stage icon, progress, purpose, previous / Next / close (CodexUIShell.swift). */
export function WalkthroughCard({ icon, progress, purpose, onPrevious, onNext, onClose }: {
  icon: string; progress: string; purpose: string; onPrevious?: () => void; onNext?: () => void; onClose?: () => void;
}) {
  return (
    <div className="aui-kit-walkthrough" role="status">
      <Sym name={icon} size={17} weight="semibold" style={{ color: AD.accent }} />
      <div className="aui-kit-stack-1" style={{ minWidth: 0 }}><span className="aui-kit-walkthrough-kicker">WORKSPACE WALKTHROUGH · {progress}</span><span className="aui-kit-walkthrough-purpose">{purpose}</span></div>
      <span className="aui-kit-vdivider" style={{ height: 26 }} />
      <CommandButton icon="chevron-left" label="Previous workspace" onClick={onPrevious} />
      <button type="button" className="aui-kit-capsule-btn" data-primary style={{ padding: "5px 12px" }} onClick={onNext}>Next</button>
      <CommandButton icon="close" label="Close walkthrough" onClick={onClose} />
    </div>
  );
}

/** Dashed file target with a foot line (AssetsPrototype "Load 3D Assembly"). */
export function DropZone({ icon = "document-download", title = "Drop model files here", detail = "or click to choose files", footLeft, footRight, onPick }: {
  icon?: string; title?: string; detail?: string; footLeft?: ReactNode; footRight?: ReactNode; onPick?: () => void;
}) {
  return (
    <div className="aui-kit-stack-8" style={{ width: "100%" }}>
      <button type="button" className="aui-kit-dropzone" onClick={onPick}>
        <Sym name={icon} size={24} style={{ color: AD.accent }} /><strong>{title}</strong><span>{detail}</span>
      </button>
      {(footLeft || footRight) && <div className="aui-kit-between aui-kit-t3" style={{ fontSize: 8.5 }}><span className="aui-kit-hstack-5">{footLeft}</span><span>{footRight}</span></div>}
    </div>
  );
}

/** A mate connector slot: caption, target glyph, the picked entity, and a swap affordance (RigPrototype). */
export const ConnectorField = ({ label, value, onSwap }: { label: string; value: string; onSwap?: () => void }) => (
  <div className="aui-kit-stack-3" style={{ width: "100%" }}>
    <span className="aui-kit-caption" style={{ fontSize: 8, letterSpacing: 0.5 }}>{label}</span>
    <div className="aui-kit-connector">
      <Sym name="target" size={11} style={{ color: AD.accent }} /><span>{value}</span><span className="aui-kit-spacer" />
      <button type="button" className="aui-kit-plain aui-kit-t2" aria-label={`Swap ${label}`} onClick={onSwap}><Sym name="refresh" size={11} /></button>
    </div>
  </div>
);

export interface ContextAction { id: string; label: string; icon: string; danger?: boolean }

/** The selection-adaptive actions card beside the selection rail (SpatialSelectionToolsSpecimen). */
export function ContextActionsCard({ icon = "cursor-rays", title, kind, actions, activeID, onSelect, width = 186 }: {
  icon?: string; title: string; kind: string; actions: readonly ContextAction[]; activeID?: string; onSelect?: (id: string) => void; width?: number;
}) {
  return (
    <div className="aui-kit-context-card" style={{ width }}>
      <div className="aui-kit-context-card-head">
        <Sym name={icon} size={13} style={{ color: AD.accent2 }} />
        <div className="aui-kit-stack-1"><strong>{title}</strong><span>{kind}</span></div>
        <span className="aui-kit-spacer" /><Sym name="more" size={11} className="aui-kit-t3" />
      </div>
      <div className="aui-kit-divider" />
      <div className="aui-kit-context-card-actions" role="menu">
        {actions.map((a) => (
          <button key={a.id} type="button" role="menuitem" data-active={a.id === activeID || undefined} onClick={() => onSelect?.(a.id)}>
            <Sym name={a.icon} size={11} style={{ color: a.danger ? AD.warn : AD.accent2, width: 15 }} /><span>{a.label}</span><span className="aui-kit-spacer" /><Sym name="chevron-right" size={7} className="aui-kit-t3" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** One device with its transport, checked when it answers (SpatialContextStackSpecimen, HardwarePrototype). */
export const DeviceStatusRow = ({ name, route, ok = true }: { name: string; route: string; ok?: boolean }) => (
  <div className="aui-kit-device-row">
    <Sym name={ok ? "status-ok" : "status-error"} size={11} style={{ color: ok ? AD.ok : AD.warn }} />
    <span>{name}</span><span className="aui-kit-spacer" /><small>{route}</small>
  </div>
);

export interface SafetyRow { label: string; value: string; tint?: string }

/** The authoritative device-layer safety panel body: shield status, enforced limits, the E-Stop (HardwarePrototype). */
export function SafetyStatus({ healthy = true, title = "System healthy", detail = "Heartbeat received 18 ms ago", rows, onStop, stopLabel = "EMERGENCY STOP" }: {
  healthy?: boolean; title?: string; detail?: string; rows: readonly SafetyRow[]; onStop?: () => void; stopLabel?: string;
}) {
  return (
    <div className="aui-kit-stack-8" style={{ width: "100%" }}>
      <div className="aui-kit-hstack-8" style={{ gap: 10 }}>
        <Sym name={healthy ? "shield-check" : "status-error"} size={27} style={{ color: healthy ? AD.ok : AD.danger }} />
        <div className="aui-kit-stack-1"><strong className="aui-kit-s12">{title}</strong><span className="aui-kit-t3" style={{ fontSize: 9 }}>{detail}</span></div>
      </div>
      {rows.map((r) => <div key={r.label} className="aui-kit-between" style={{ fontSize: 10 }}><span className="aui-kit-hstack-6"><span className="aui-kit-dot" style={{ background: r.tint ?? AD.ok, width: 7, height: 7 }} />{r.label}</span><span className="aui-kit-t3" style={{ fontSize: 9 }}>{r.value}</span></div>)}
      <button type="button" className="aui-kit-estop" onClick={onStop}>{stopLabel}</button>
    </div>
  );
}

/** A live-value capsule: the channel's position within its range (HardwarePrototype channel map). */
export const LiveBar = ({ fraction, tint = AD.accent, width = 52 }: { fraction: number; tint?: string; width?: number }) => (
  <span className="aui-kit-live-bar" style={tintStyle(tint, { width })}><span style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }} /></span>
);

// MARK: - July-19 "Rex Animatronic" revision — elements the later demo dropped

/** A stat chip: uppercase key over a monospaced value (the old Assets `importStat`). */
export const StatChip = ({ label, value, tint }: { label: string; value: string; tint?: string }) => (
  <span className="aui-kit-stat-chip"><small>{label}</small><strong style={{ color: tint }}>{value}</strong></span>
);

/** A project tile: tinted gradient thumb, name, kind, meta (the old Home RECENT grid). */
export const ProjectCard = ({ name, kind, meta, tint = AD.accent, icon = "cube-transparent", onClick }: { name: string; kind: string; meta: string; tint?: string; icon?: string; onClick?: () => void }) => (
  <button type="button" className="aui-kit-project-card" onClick={onClick} style={tintStyle(tint)}>
    <span className="aui-kit-project-thumb"><Sym name={icon} size={30} /></span>
    <span className="aui-kit-project-text"><strong>{name}</strong><span>{kind}</span><small>{meta}</small></span>
  </button>
);

/** A device's identity: tinted circle badge, name, transport/port (the old Hardware controller inspector head). */
export const DeviceIdentity = ({ icon = "cpu", name, detail, tint = AD.ok }: { icon?: string; name: string; detail: string; tint?: string }) => (
  <div className="aui-kit-device-identity" style={tintStyle(tint)}>
    <span className="aui-kit-device-identity-badge"><Sym name={icon} size={14} /></span>
    <span className="aui-kit-stack-1"><strong>{name}</strong><small>{detail}</small></span>
  </div>
);

/** The servo range bar: the mapped span within the pulse range, marker ticks, µs labels (the old `calibBar`). */
export function CalibrationRangeBar({ start = 0.1, end = 0.7, minLabel = "980µs", maxLabel = "2000µs", tint = AD.accent2 }: {
  start?: number; end?: number; minLabel?: string; maxLabel?: string; tint?: string;
}) {
  return (
    <div className="aui-kit-calib" style={tintStyle(tint)}>
      <div className="aui-kit-calib-track">
        <span className="aui-kit-calib-span" style={{ left: `${start * 100}%`, width: `${(end - start) * 100}%` }} />
        <i style={{ left: `${start * 100}%` }} /><i style={{ left: `${end * 100}%` }} />
      </div>
      <div className="aui-kit-between aui-kit-t3" style={{ fontSize: 9 }}><span>{minLabel}</span><span>{maxLabel}</span></div>
    </div>
  );
}

// MARK: - Native Aether Animation Studio (aether-animation/archive/swift-app) — widgets the archive had and the kit lacked

/** MouseControlDiagram.swift — the navigation settings' code-drawn mouse legend: L / wheel / R with the profile's orbit, pan, zoom and special mappings. */
export function MouseControlDiagram({ profile, orbit, pan, zoom, special, style }: { profile: string; orbit: string; pan: string; zoom: string; special: string; style?: CSSProperties }) {
  const rightDetail = /right/i.test(orbit) ? "Orbit" : "Menu";
  const button = (label: string, detail: string) => (
    <div className="aui-kit-mouse-button" data-button={label} data-orbit={detail === "Orbit"}>
      <span className="aui-kit-mouse-key">{label}</span>
      <span className="aui-kit-mouse-detail">{detail}</span>
    </div>
  );
  const row = (title: string, detail: string, icon: string) => (
    <div className="aui-kit-mouse-row"><Sym name={icon} size={12} style={{ color: "var(--aether-color-accent)", width: 18 }} /><div><strong>{title}</strong><span>{detail}</span></div></div>
  );
  return (
    <div className="aui-kit-mouse-diagram" role="img" aria-label={`Mouse mapping for ${profile}`} style={style}>
      <div className="aui-kit-mouse-body">
        {button("L", "Select")}
        <div className="aui-kit-mouse-button"><span className="aui-kit-mouse-wheel"><Sym name="arrows-vertical" size={8} weight="bold" /></span><span className="aui-kit-mouse-detail">Wheel</span></div>
        {button("R", rightDetail)}
      </div>
      <div className="aui-kit-mouse-rows">{row("Orbit", orbit, "rotate-3d")}{row("Pan", pan, "move")}{row("Zoom", zoom, "zoom-in")}{row("Special", special, "sparkles")}</div>
    </div>
  );
}

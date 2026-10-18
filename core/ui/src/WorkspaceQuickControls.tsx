import { createPortal } from "react-dom";
import { useOverlayHost } from "./OverlayScope";
import { Children, Fragment, isValidElement, useEffect, useId, useState, type ReactNode } from "react";
import { useWorkspaceControls } from "./workspace-controls";
import { WorkspaceLayoutControl } from "./WorkspaceLayoutControl";
import { AetherIcon } from "./AetherIcon";
import { AppLauncher, type LaunchableApp } from "./AppLauncher";
import { AppearanceToggle, StudioModeButton, WorkspaceWindowMenu } from "./StudioChrome";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { TextField } from "./TextField";
import { Popover } from "./Popover";
import { SettingsWindow } from "./SettingsWindow";
import { DEFAULT_HEADER_PINS, registerHeaderControls, useHeaderPins } from "./header-controls";
import "./WorkspaceQuickControls.css";

/** Unwrap layout-only groups while retaining each application's actual controls. */
function controls(nodes: ReactNode): ReactNode[] {
  return Children.toArray(nodes).flatMap(node => isValidElement<{children?: ReactNode}>(node) && (node.type === Fragment || node.type === "div") ? controls(node.props.children) : [node]);
}
function controlLabel(node: ReactNode) {
  const props = isValidElement<Record<string, unknown>>(node) ? node.props : {};
  return String(props["aria-label"] ?? props.label ?? props.title ?? "Workspace control");
}
export function WorkspaceQuickControls({ appID, appName = appID, apps, viewControls, onShare, onSettings, account, defaultPinnedIDs = DEFAULT_HEADER_PINS, compact = false }: {
  appID: string; appName?: string; apps: readonly LaunchableApp[]; viewControls?: ReactNode; onShare?: () => void; onSettings?: () => void; account?: ReactNode; defaultPinnedIDs?: readonly string[]; compact?: boolean;
}) {
  const workspace = useWorkspaceControls(), owner = useId(), overlayHost = useOverlayHost();
  const pinned = useHeaderPins(appID, defaultPinnedIDs);
  const [pluginsOpen, setPluginsOpen] = useState(false), [settingsOpen, setSettingsOpen] = useState(false);
  const [sharing, setSharing] = useState(false), [copyStatus, setCopyStatus] = useState("");
  const [shareAnchor, setShareAnchor] = useState<HTMLElement | null>(null);
  const productControls = controls(viewControls), labels = productControls.map(controlLabel);
  const sharedIDs: Record<string, string> = { "Workspace layout": "layout", Comments: "comments", Reminders: "reminders", Plugins: "plugins", Notifications: "notifications", Help: "help" };
  const support = workspace ? [
    ...(!labels.includes("Workspace layout") ? [{ id: "layout", label: "Workspace layout", icon: "layout", node: <WorkspaceLayoutControl controls={workspace}/> }] : []),
    ...(["comments", "reminders"] as const).filter(id => workspace.panels.some(panel => panel.id === id) && !labels.includes(id === "comments" ? "Comments" : "Reminders")).map(id => ({ id, label: id === "comments" ? "Comments" : "Reminders", icon: id === "comments" ? "comment" : "stopwatch", node: <button type="button" className="aui-icon-button" aria-label={id === "comments" ? "Comments" : "Reminders"} onClick={() => workspace.show(id)}><AetherIcon name={id === "comments" ? "comment" : "stopwatch"}/></button> })),
  ] : [];
  const entries = [
    { id: "theme", label: "Light / dark mode", icon: "appearance-system", node: <AppearanceToggle/> },
    { id: "share", label: "Share", icon: "link", node: <button type="button" className="aui-icon-button" aria-label="Share" title="Share" onClick={event => { setShareAnchor(event.currentTarget); if (onShare) onShare(); else { setCopyStatus(""); setSharing(true); } }}><AetherIcon name="link"/></button> },
    { id: "apps", label: "App tray", icon: "apps", node: <AppLauncher apps={apps} currentID={appID}/> },
    ...productControls.map((node, index) => {
      const type = isValidElement(node) ? node.type : null;
      const props = isValidElement<{children?: ReactNode}>(node) ? node.props : {};
      const child = Children.toArray(props.children).find(child => isValidElement(child) && child.type === AetherIcon);
      const label = controlLabel(node);
      return { icon: type === StudioModeButton ? "mode-floating" : isValidElement<{name: string}>(child) ? child.props.name : "windows", id: type === StudioModeButton ? "mode" : type === WorkspaceWindowMenu ? "tabs" : sharedIDs[label] ?? `${appID}-control-${index}`, label: type === StudioModeButton ? "Workspace mode" : type === WorkspaceWindowMenu ? "Windows and tabs" : label, node };
    }),
    ...support,
    ...(!labels.includes("Plugins") && apps.length ? [{ id: "plugins", label: "Plugins", icon: "grid-2", node: <button type="button" className="aui-icon-button" aria-label="Plugins" onClick={() => setPluginsOpen(true)}><AetherIcon name="grid-2"/></button> }] : []),
  ];
  const registration = JSON.stringify({ appID, name: appName, controls: entries.map(({ id, label, icon }) => ({ id, label, icon })), defaults: defaultPinnedIDs });
  useEffect(() => registerHeaderControls(owner, JSON.parse(registration)), [owner, registration]);
  function openSettings() {
    if (onSettings) onSettings();
    else if (document.dispatchEvent(new CustomEvent("aether-open-settings", { cancelable: true }))) setSettingsOpen(true);
  }
  const settingsButton = <button type="button" className="aui-icon-button" aria-label="Settings" title="Settings" onClick={openSettings}><AetherIcon name="settings"/></button>;
  return <div className={`aui-workspace-quick-controls${compact ? " aui-workspace-quick-controls--compact" : ""}`}>
    {compact && settingsButton}
    <div className="aui-quick-control-bar" role="group" aria-label="User bar">
      {pinned.map(id => entries.find(entry => entry.id === id)).filter(entry => !!entry).map(entry => <div key={entry.id} className="aui-quick-control">{entry.node}</div>)}
    </div>
    {!compact && settingsButton}
    <Popover open={sharing} anchor={shareAnchor} onClose={() => setSharing(false)} ariaLabel="Share document" placement="bottom-end" className="aui-quick-controls-menu">
      <strong>Share document link</strong><p>Recipients need existing access to this document.</p>
      <TextField aria-label="Document link" readOnly value={typeof location === "undefined" ? "" : location.href} onFocus={event => event.currentTarget.select()}/>
      <Button onClick={async () => { try { await navigator.clipboard.writeText(location.href); setCopyStatus("Link copied"); } catch { setCopyStatus("Select and copy the link above."); } }}>Copy link</Button><span role="status">{copyStatus}</span>
    </Popover>
    {settingsOpen && typeof document !== "undefined" && createPortal(<SettingsWindow open={settingsOpen} title={`${appName} settings`} headerAppID={appID} sections={[]} activePaneID="" onSelectPane={() => {}} onClose={() => setSettingsOpen(false)}>{null}</SettingsWindow>, overlayHost ?? document.body)}
    <Dialog open={pluginsOpen} title="Plugins" onClose={() => setPluginsOpen(false)}><iframe title={`${appID} plugins`} src={pluginsOpen ? `/?pluginApp=${encodeURIComponent(appID)}` : undefined} style={{ width: "min(1000px,80vw)", height: "70vh", border: 0 }}/></Dialog>
    <div className="aui-application-account">{account === undefined ? <div data-aether-account=""/> : account}</div>
  </div>;
}

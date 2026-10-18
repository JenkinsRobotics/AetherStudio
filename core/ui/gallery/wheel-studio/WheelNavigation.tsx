import { AetherIcon, ApplicationSidebar, MenuButton, SidebarLabel, ToolIcon, type ToolIconName } from "../../src";

const workspaces: { label: string; icon: ToolIconName }[] = [
  { label: "Design", icon: "part" }, { label: "Sketch", icon: "sketch" },
  { label: "Surface", icon: "loft" }, { label: "Sheet Metal", icon: "sheet" },
  { label: "Assembly", icon: "assembly" }, { label: "Drawing", icon: "document" },
  { label: "Rendering", icon: "part" }, { label: "Simulation", icon: "rotate" },
  { label: "Manufacture", icon: "export" },
];

/** App-owned navigation content inside the approved collapsible sidebar. */
export function WheelNavigation({ mode, onMode, onDialog, onReset, onCopyLink, onExit }: {
  mode: string; onMode(mode: string): void; onDialog(dialog: string): void;
  onReset(): void; onCopyLink(): void; onExit?: () => void;
}) {
  return <ApplicationSidebar id="wheel-navigation-concept" name="Aether CAD" variant="captioned"
    className="wn-navigation" defaultCollapsed app="cad"
    sections={[
      { id: "workspaces", items: workspaces.map(item => ({
        id: item.label, label: item.label, icon: <ToolIcon name={item.icon} />,
        current: mode === item.label, onSelect: () => onMode(item.label),
      })) },
      { id: "resources", items: [
        { id: "files", label: "Files", icon: "folder", onSelect: () => onDialog("documents") },
        { id: "teams", label: "Teams", icon: "people", onSelect: () => onDialog("teams") },
        { id: "learn", label: "Learn", icon: "help", onSelect: () => onDialog("about") },
      ] },
    ]}
    footerTools={<div className="wn-document-context">
      <MenuButton label="Navigation document menu" placement="top-start" items={[
        { id: "documents", label: "Open documents" }, { id: "versions", label: "Main · local session" },
        { id: "copy", label: "Copy concept link" }, { id: "reset", label: "Reset wheel study", separatorBefore: true },
        ...(onExit ? [{ id: "apps", label: "Demo apps" }] : []),
      ]} onSelect={id => id === "reset" ? onReset() : id === "copy" ? onCopyLink() : id === "apps" ? onExit?.() : onDialog(id)}>
        <ToolIcon name="assembly" /><SidebarLabel><strong>Train Cart Wheel</strong><small>Main <AetherIcon name="chevron-down" /></small></SidebarLabel>
      </MenuButton>
      <div className="wn-local-status" title="Edits stay in this browser session"><AetherIcon name="save" /><SidebarLabel>Local session<small>Live model preview</small></SidebarLabel></div>
    </div>}
  />;
}

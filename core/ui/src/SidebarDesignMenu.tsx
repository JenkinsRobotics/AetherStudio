import { AetherIcon } from "./AetherIcon";
import { MenuButton } from "./Menu";
import type { WorkspaceShellProps } from "./WorkspaceShell";
import { setWorkspaceChrome, useWorkspaceChrome } from "./WorkspaceChromePreferences";

export type SidebarDesign = NonNullable<WorkspaceShellProps["sidebarVariant"]>;
export const sidebarDesignOptions: readonly { id: SidebarDesign; label: string }[] = [
  { id: "rail", label: "Side rail" },
  { id: "tabs-top", label: "Top tabs" },
  { id: "tabs-bottom", label: "Bottom tabs" },
];

/** Presentation only; the owning application chooses where preferences live. */
export function SidebarDesignMenu({ value: appValue, onChange }: { value: SidebarDesign; onChange: (value: SidebarDesign) => void }) {
  const chrome = useWorkspaceChrome();
  const value = chrome.sidebarDesign === "app" ? appValue : chrome.sidebarDesign;
  return <MenuButton label={`Sidebar design: ${sidebarDesignOptions.find(option => option.id === value)?.label}`}
    className="aui-icon-button" placement="bottom-end"
    items={sidebarDesignOptions.map(option => ({ ...option, kind: "radio", checked: option.id === value }))}
    onSelect={id => {
      if (chrome.sidebarDesign !== "app") setWorkspaceChrome({ sidebarDesign: id as SidebarDesign });
      onChange(id as SidebarDesign);
    }}>
    <AetherIcon name="layout" />
  </MenuButton>;
}

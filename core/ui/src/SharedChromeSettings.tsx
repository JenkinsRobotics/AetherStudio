import { SettingsCard, SettingsRow } from "./SettingsWindow";
import { SelectField } from "./SelectField";
import { Button } from "./Button";
import { SharedWorkspaceSettings } from "./SharedWorkspaceSettings";
import { DEFAULT_WORKSPACE_CHROME, setWorkspaceChrome, useWorkspaceChrome, type WorkspaceChromePreferences } from "./WorkspaceChromePreferences";

/** Suite-wide chrome controls, automatically included by every SettingsWindow. */
export function SharedChromeSettings() {
  const prefs = useWorkspaceChrome();
  const field = (key: keyof WorkspaceChromePreferences, label: string, choices: readonly (readonly [string, string])[]) =>
    <SelectField aria-label={label} value={prefs[key]} options={choices.map(([value, text]) => ({ value, label: text }))}
      onChange={event => setWorkspaceChrome({ [key]: event.target.value })} />;
  return <>
    <SettingsCard title="Sidebar tabs" caption="Shared across Aether apps in this browser. App default preserves each app’s existing layout choice.">
      <SettingsRow label="Tab placement">
        {field("sidebarDesign", "Sidebar tab placement", [["app", "App default"], ["rail", "Side rail"], ["tabs-top", "Top tabs"], ["tabs-bottom", "Bottom tabs"]])}
      </SettingsRow>
      <SettingsRow label="Opening direction" caption="Inside places the tabs at the outer edge. Outside places the editor between the tabs and that edge. Both collapse to the selected workspace edge.">
        {field("sidebarOpening", "Sidebar opening direction", [["app", "App default"], ["inside", "Inside · toward workspace"], ["outside", "Outside · toward window edge"]])}
      </SettingsRow>
      <SettingsRow label="Container" caption="Combined is the standard at every window size: one continuous background and border around icons and content. Detached is an optional secondary design.">
        {field("sidebarAttachment", "Sidebar container", [["attached", "Combined card · default"], ["detached", "Detached tray · secondary"]])}
      </SettingsRow>
      <SettingsRow label="Tab size" caption="Automatic uses 36 px cells with 20 px icons. Compact uses 30 px cells with 18 px icons; Touch uses 44 px cells with 26 px icons. Attached and detached trays always match.">
        {field("tabSize", "Sidebar tab size", [["auto", "Automatic"], ["compact", "Compact"], ["touch", "Touch"]])}
      </SettingsRow>
      <SettingsRow label="Tab labels">
        {field("tabLabels", "Sidebar tab labels", [["icons", "Icons only"], ["labels", "Icons and labels"]])}
      </SettingsRow>
    </SettingsCard>
    <SettingsCard title="Toolbars" caption="Density applies to both shared toolbar families. Ribbon appearance and workspace selector apply to WorkspaceRibbon; popup layout applies to the ToolSidebar family.">
      <SettingsRow label="Density" caption="Compact opens groups from icons. Standard and Expanded expose the grouped tools; Expanded also exposes the workspace in ToolSidebar.">
        {field("toolbarDensity", "Toolbar density", [["app", "App default"], ["compact", "Compact"], ["standard", "Standard"], ["expanded", "Expanded"]])}
      </SettingsRow>
      <SettingsRow label="Ribbon appearance">
        {field("ribbonAppearance", "Ribbon appearance", [["app", "App default"], ["glass", "Glass"], ["panel", "Panel"]])}
      </SettingsRow>
      <SettingsRow label="Workspace selector">
        {field("workspaceSelector", "Workspace selector", [["app", "App default"], ["column", "Leading column"], ["strip", "Tab strip"]])}
      </SettingsRow>
      <SettingsRow label="Tool group popup">
        {field("toolPopup", "Tool group popup", [["app", "App default"], ["list", "List"], ["grid", "Grid"]])}
      </SettingsRow>
    </SettingsCard>
    <SettingsCard title="Panel behavior" caption="Standard sidebars open one panel per side. Click the active tab again to collapse it. Docked panels reserve workspace space; Floating panels overlay it. Change docking mode in the app’s layout controls.">
      <SettingsRow label="Opening and closing" caption="Automatic follows the system’s reduced-motion preference.">
        {field("panelMotion", "Panel animation", [["auto", "Animate · respect reduced motion"], ["none", "No animation"]])}
      </SettingsRow>
      <Button onClick={() => setWorkspaceChrome(DEFAULT_WORKSPACE_CHROME)}>Restore toolbar and sidebar defaults</Button>
    </SettingsCard>
    <SharedWorkspaceSettings />
  </>;
}

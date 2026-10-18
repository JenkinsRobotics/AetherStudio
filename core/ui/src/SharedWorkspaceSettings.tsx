import { SettingsCard, SettingsRow } from "./SettingsWindow";
import { NumberField } from "./NumberField";
import { Button } from "./Button";
import { DEFAULT_WORKSPACE_SPACING, setWorkspaceSpacing, useWorkspaceSpacing } from "./WorkspaceSpacing";

export function SharedWorkspaceSettings() {
  const spacing = useWorkspaceSpacing();
  return <SettingsCard title="Workspace spacing" caption="Safe areas are always active. Aether UI defaults apply automatically; custom spacing is shared across apps in this browser.">
    <SettingsRow label="Workspace margin" caption="Space around framed content and canvas controls when an edge is clear. Default: 10 px.">
      <NumberField aria-label="Workspace margin" unit="px" min={0} max={64} precision={0} value={spacing.margin}
        onCommit={margin => setWorkspaceSpacing({margin})} />
    </SettingsRow>
    <SettingsRow label="Floating control clearance" caption="Extra space between content or canvas controls and floating toolbars or panels. Default: 22 px.">
      <NumberField aria-label="Floating control clearance" unit="px" min={0} max={64} precision={0} value={spacing.clearance}
        onCommit={clearance => setWorkspaceSpacing({clearance})} />
    </SettingsRow>
    <Button onClick={() => setWorkspaceSpacing(DEFAULT_WORKSPACE_SPACING)}>Restore Aether UI defaults</Button>
  </SettingsCard>;
}

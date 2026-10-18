import { Button, SettingsCard, SettingsRow, SettingsWindow } from "@aether/ui";

/** Drive-specific settings; shared appearance and interface controls come from SettingsWindow. */
export function DriveSettings({ open, onClose, onSync }: {
  open: boolean;
  onClose: () => void;
  onSync: () => void;
}) {
  return <SettingsWindow open={open} title="Aether Drive settings"
    sections={[{ title: "Aether Drive", panes: [{ id: "sync", label: "Desktop sync" }] }]}
    activePaneID="sync" onSelectPane={() => {}} onClose={onClose}>
    <SettingsCard title="Desktop sync" caption="Keep a local folder synchronized with your files in Aether Drive.">
      <SettingsRow label="Sync companion" caption="Setup uses the current Drive location. The companion must be running to transfer changes.">
        <Button onClick={onSync}>Set up desktop sync</Button>
      </SettingsRow>
      <p>Requires Python and an Aether Studio installation. Files On-Demand placeholders are not available yet.</p>
    </SettingsCard>
  </SettingsWindow>;
}

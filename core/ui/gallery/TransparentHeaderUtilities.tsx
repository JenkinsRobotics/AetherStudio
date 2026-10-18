import { useState } from "react";
import { AetherIcon, Button, Dialog, IconButton, SettingsWindow, TextField } from "../src";
import { WorkspaceQuickControls } from "../src/WorkspaceQuickControls";
import { HeaderSampleAccount } from "./HeaderSampleAccount";
import { CAD_HEADER_PINS, useCADHeaderPins } from "./cad-header-pins";
import { useSuiteApps } from "./suite-apps";
import "./TransparentHeaderUtilities.css";

/** Same approved CAD controls in the reference header and standalone model demo. */
export function TransparentHeaderUtilities({ onAccount, onHelp, onComments, onNotifications, local = false }: {
  onAccount: () => void; onHelp: () => void; onComments: () => void; onNotifications?: () => void; local?: boolean;
}) {
  const apps = useSuiteApps();
  const [settings, setSettings] = useState(false), [share, setShare] = useState(false), [copied, setCopied] = useState("");
  useCADHeaderPins();
  return <div className="transparent-header-utilities">
    <WorkspaceQuickControls appID="cad" appName="Aether CAD" apps={apps} compact defaultPinnedIDs={CAD_HEADER_PINS}
      onSettings={() => setSettings(true)} onShare={() => { setCopied(""); setShare(true); }}
      account={<HeaderSampleAccount name={local ? "Local user" : undefined} detail={local ? "Local preview" : undefined} onViewAccount={onAccount}/>}
      viewControls={<>
        <IconButton label="Notifications" disabled={!onNotifications} title={!onNotifications ? "Notifications require a connected Aether Studio account." : undefined} onClick={onNotifications}><AetherIcon name="bell"/></IconButton>
        <IconButton label="Comments" onClick={onComments}><AetherIcon name="comment"/></IconButton>
        <IconButton label="Help" onClick={onHelp}><AetherIcon name="help"/></IconButton>
      </>}/>
    <SettingsWindow open={settings} title="Aether CAD settings" headerAppID="cad" sections={[]} activePaneID="" onSelectPane={() => {}} onClose={() => setSettings(false)}>{null}</SettingsWindow>
    <Dialog open={share} title="Share preview" onClose={() => setShare(false)} actions={<Button onClick={() => setShare(false)}>Done</Button>}>
      <div className="transparent-header-share"><p>This link opens the demo. Local model edits stay in this window.</p>
        <TextField aria-label="Preview link" readOnly value={location.href}/>
        <Button onClick={async () => { try { await navigator.clipboard.writeText(location.href); setCopied("Link copied"); } catch { setCopied("Select and copy the link above."); } }}>Copy link</Button><span role="status">{copied}</span>
      </div>
    </Dialog>
  </div>;
}

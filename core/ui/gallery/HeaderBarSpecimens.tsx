import { TransparentHeaderSpecimen } from "./TransparentHeaderSpecimen";
import { useState } from "react";
import { AetherIcon, Avatar, Button, CommandPalette, Dialog, DocumentBar, IconButton, MenuButton, StudioModeButton, TextField, WorkspaceSwitcher, WorkspaceWindowMenu, type LayoutPreset } from "../src";
import { CAD_HEADER_PINS, useCADHeaderPins } from "./cad-header-pins";
import { HeaderSampleAccount } from "./HeaderSampleAccount";
import { SUITE_APPS } from "./suite-apps";
import "./HeaderBarSpecimens.css";

const HEADERS = [
  { id: "cad", name: "Aether CAD", document: "Train Cart Wheel", workspaces: ["Design", "Assembly", "Drawing"] },
  { id: "animation", name: "Aether Animation", document: "Character Study", workspaces: ["Animate", "Rig", "Show", "Hardware"] },
  { id: "map", name: "Aether Map", document: "Prism Pavilion", workspaces: ["Mapping", "Playback"] },
] as const;
const DEFAULT_PINS = ["share", "notifications", "help"];

function AppHeaderSpecimen({ id, name, document: documentName, workspaces }: typeof HEADERS[number]) {
  const compact = id === "cad";
  const [workspace, setWorkspace] = useState<string>(workspaces[0]);
  const [layout, setLayout] = useState<LayoutPreset>("docked");
  const [notice, setNotice] = useState(compact ? "Document controls on the left. Header icons and account on the right." : "Choose a workspace or try the header controls.");
  const [panel, setPanel] = useState<"account" | "notifications" | "help" | "comments" | "share" | "history" | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  useCADHeaderPins(compact);
  const share = () => { setCopyStatus(""); setPanel("share"); };
  const selectWorkspace = (value: string) => { setWorkspace(value); setNotice(`${value} workspace selected.`); };
  return <article className="header-bar-specimen" aria-label={`${name} header specimen`}>
    <h3>{name}</h3>
    <div className="header-bar-specimen-scroll" role="region" aria-label={`${name} header preview`} tabIndex={0} onKeyDown={event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); event.stopPropagation(); setSearchOpen(true); }
    }}>
      <DocumentBar windowChrome={false} compactControls={compact} className={`transparent-header-example header-bar-specimen-example${compact ? " header-bar-specimen-example--compact" : ""}`} defaultHeaderPins={compact ? CAD_HEADER_PINS : DEFAULT_PINS}
        application={{ id, name, identityStyle: "wordmark", apps: SUITE_APPS, onShare: compact ? share : undefined, onHome: event => {
          event.preventDefault(); selectWorkspace(workspaces[0]); setNotice(`${name} home selected.`);
        } }}
        leading={<><span className="transparent-header-divider" aria-hidden="true"/><strong className="transparent-header-title">{documentName}</strong>
          {compact ? <><MenuButton label="Document version: Main" className="transparent-header-workspace" items={[
            { id: "main", label: "Main", kind: "radio", checked: true },
            { id: "history", label: "Versions and history…", separatorBefore: true },
          ]} onSelect={value => { if (value === "history") setPanel("history"); }}>Main<AetherIcon name="chevron-down"/></MenuButton>
            <IconButton label="Copy document link" onClick={share}><AetherIcon name="link"/></IconButton></> :
            <WorkspaceSwitcher className="transparent-header-workspace" workspaces={workspaces.map(label => ({ id: label, label }))} workspaceID={workspace} onSelect={selectWorkspace}/>}
          <span className="transparent-header-local"><AetherIcon name="cloud"/>Local preview</span>
        </>}
        trailing={compact ? <><IconButton label={`Search ${name} commands`} appearance="glyph" onClick={() => setSearchOpen(true)}><AetherIcon name="search"/></IconButton><span className="header-bar-utility-divider" aria-hidden="true"/></> : <Button className="transparent-header-search" aria-label={`Search ${name} commands`} onClick={() => setSearchOpen(true)}><AetherIcon name="search"/><span>Search tools, features, or help…</span><kbd>⌘ K</kbd></Button>}
        viewControls={<>
          <IconButton label="Notifications" onClick={() => setPanel("notifications")}><AetherIcon name="bell"/></IconButton>
          {compact && <IconButton label="Comments" onClick={() => setPanel("comments")}><AetherIcon name="comment"/></IconButton>}
          <IconButton label="Help" onClick={() => setPanel("help")}><AetherIcon name="help"/></IconButton>
          <StudioModeButton preset={layout} onChange={value => { setLayout(value); setNotice(`${value[0].toUpperCase()}${value.slice(1)} layout selected.`); }}/>
          <WorkspaceWindowMenu/>
        </>}
        account={compact ? <HeaderSampleAccount onViewAccount={() => setPanel("account")}/> : <MenuButton label={`${name} sample account`} className="transparent-header-account header-bar-specimen-account" items={[
          { id: "profile", label: "Alex Morgan", icon: <Avatar name="Alex Morgan" size="small"/> },
        ]} onSelect={() => setPanel("account")}><Avatar name="Alex Morgan" size="small"/><span>Alex Morgan</span><AetherIcon name="chevron-down"/></MenuButton>}
      />
    </div>
    <p className="header-bar-specimen-status" role="status">{notice}</p>
    <CommandPalette open={searchOpen} title={`Search ${name} commands`} commands={[
      ...(compact ? [{ id: "comments", label: "Open comments", category: "Document" }, { id: "share", label: "Share document link", category: "Document" }] : workspaces.map(value => ({ id: value, label: `Switch to ${value} workspace`, category: "Workspace" }))),
      { id: "help", label: `${name} header help`, category: "Help" },
    ]} onClose={() => setSearchOpen(false)} onSelect={value => { setSearchOpen(false); if (value === "help" || value === "comments") setPanel(value); else if (value === "share") share(); else selectWorkspace(value); }}/>
    <Dialog open={panel !== null} title={panel === "account" ? "Sample account" : panel === "notifications" ? "Notifications" : panel === "comments" ? "Comments" : panel === "share" ? "Share document" : panel === "history" ? "Versions and history" : `${name} header help`} onClose={() => setPanel(null)} actions={<Button onClick={() => setPanel(null)}>Done</Button>}>
      {panel === "account" ? <><p>Alex Morgan · Demo account</p><p>alex.morgan@example.com</p><p>Applications show the signed-in account in this same position.</p></> : panel === "notifications" ? <p>No notifications in this local preview.</p> : panel === "comments" ? <p>No comments on this sample document.</p> : panel === "history" ? <p>Main · Local preview. Saved versions are available in a connected document.</p> : panel === "share" ? <div className="transparent-header-share"><p>Share this header review.</p><TextField aria-label="Document link" readOnly value={location.href}/><Button onClick={async () => { try { await navigator.clipboard.writeText(location.href); setCopyStatus("Link copied"); } catch { setCopyStatus("Select and copy the link above."); } }}>Copy link</Button><span role="status">{copyStatus}</span></div> : <p>Search commands or open Settings → Header to choose the icons shown in this app’s header.</p>}
    </Dialog>
  </article>;
}

export function HeaderBarSpecimens() {
  return <div className="header-bar-specimens">
    <p>The same content hierarchy across app headers: app and document context on the left, search, pinned icons and account on the right. The framed variants retain their border.</p>
    <TransparentHeaderSpecimen/>
    {HEADERS.map(header => <AppHeaderSpecimen key={header.id} {...header}/>)}
    <p className="header-bar-specimen-note">Choose pinned icons in Settings → Header. Preferences are saved per app. Share copies this review page’s link; accounts and documents shown here are examples.</p>
  </div>;
}

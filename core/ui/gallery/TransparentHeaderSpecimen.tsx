import { useState } from "react";
import { AetherIcon, AppWordmark, Button, CommandPalette, Dialog, DocumentBar, IconButton, MenuButton, SegmentedControl, TextField } from "../src";
import "./TransparentHeaderSpecimen.css";
import { TransparentHeaderUtilities } from "./TransparentHeaderUtilities";

type Panel = "share" | "notifications" | "help" | "account" | "comments";
const titles: Record<Panel, string> = { share: "Document link", notifications: "Notifications", help: "Transparent header", account: "Sample account", comments: "Comments" };

/** Review the shared header against a continuous workspace surface. */
export function TransparentHeaderSpecimen() {
  const [appearance, setAppearance] = useState("dark");
  const [workspace, setWorkspace] = useState("Main");
  const [search, setSearch] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [notice, setNotice] = useState("The workspace continues behind the header.");
  const [copied, setCopied] = useState(false);
  const share = () => { setCopied(false); setPanel("share"); };
  return <article className="transparent-header-specimen" aria-label="Transparent header specimen">
    <div className="transparent-header-heading"><div><h3>Transparent · open workspace</h3><p>No background, border or shadow. The controls sit directly over the workspace.</p></div>
      <SegmentedControl ariaLabel="Header preview background" value={appearance} onChange={setAppearance} options={[{ id: "dark", label: "Dark workspace" }, { id: "light", label: "Light workspace" }]} />
    </div>
    <div className="transparent-header-scroll" role="region" aria-label="Transparent header preview" tabIndex={0} onKeyDown={event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); event.stopPropagation(); setSearch(true); }
    }}>
      <div className="transparent-header-scene" data-appearance={appearance}>
        <DocumentBar variant="transparent" windowChrome={false} className="transparent-header-example" leading={<>
          <button className="transparent-header-brand" type="button" aria-label="Aether CAD preview home" onClick={() => { setWorkspace("Main"); setNotice("Main workspace selected."); }}><AppWordmark app="cad" size={32} appearance={appearance === "dark" ? "dark" : "light"} decorative /></button>
          <span className="transparent-header-divider" aria-hidden="true" />
          <strong className="transparent-header-title">Train Cart Wheel</strong>
          <MenuButton label={`Header workspace: ${workspace}`} className="transparent-header-workspace" items={["Main", "Review"].map(label => ({ id: label, label, kind: "radio" as const, checked: workspace === label }))} onSelect={value => { setWorkspace(value); setNotice(`${value} workspace selected.`); }}>{workspace}<AetherIcon name="chevron-down" /></MenuButton>
          <IconButton label="Share preview link" size="medium" onClick={share}><AetherIcon name="link" /></IconButton>
          <span className="transparent-header-local"><AetherIcon name="cloud" />Local preview</span>
        </>} trailing={<>
          <Button className="transparent-header-search" aria-label="Search header commands" onClick={() => setSearch(true)}><AetherIcon name="search" /><span>Search tools, features, or help…</span><kbd>⌘ K</kbd></Button>
          <TransparentHeaderUtilities onNotifications={() => setPanel("notifications")} onHelp={() => setPanel("help")} onComments={() => setPanel("comments")} onAccount={() => setPanel("account")}/>
        </>} />
        <div className="transparent-header-workspace-caption" aria-hidden="true"><span>MAIN WORKSPACE</span><small>One continuous surface</small></div>
      </div>
    </div>
    <p className="transparent-header-notice" role="status">{notice}</p>
    <CommandPalette open={search} title="Search header commands" placeholder="Search workspace and header actions…" commands={[
      { id: "main", label: "Switch to Main workspace", category: "Workspace" }, { id: "review", label: "Switch to Review workspace", category: "Workspace" },
      { id: "dark", label: "Dark workspace preview", category: "Appearance" }, { id: "light", label: "Light workspace preview", category: "Appearance" },
      { id: "share", label: "Share preview link", category: "Document" }, { id: "help", label: "Header help", category: "Help" },
    ]} onClose={() => setSearch(false)} onSelect={id => {
      setSearch(false);
      if (id === "main" || id === "review") { const value = id === "main" ? "Main" : "Review"; setWorkspace(value); setNotice(`${value} workspace selected.`); }
      else if (id === "dark" || id === "light") setAppearance(id);
      else if (id === "share") share();
      else setPanel("help");
    }} />
    <Dialog open={panel !== null} title={panel ? titles[panel] : "Header"} onClose={() => setPanel(null)} actions={<Button onClick={() => setPanel(null)}>Done</Button>}>
      {panel === "share" ? <div className="transparent-header-share"><p>Share this header review.</p><TextField aria-label="Header review link" readOnly value={location.href} /><Button onClick={async () => { try { await navigator.clipboard.writeText(location.href); setCopied(true); } catch { setCopied(false); setNotice("Select and copy the review link from the dialog."); } }}>{copied ? "Copied" : "Copy link"}</Button></div> : null}
      {panel === "comments" ? <p>No comments on this sample document.</p> : null}
      {panel === "notifications" ? <p>No notifications in this local preview.</p> : null}
      {panel === "help" ? <p>Try the workspace menu, search, link and account controls. With focus in the header, press ⌘K or Ctrl+K to search. This is an independent header specimen.</p> : null}
      {panel === "account" ? <p>Alex Morgan · Sample account for this design review.</p> : null}
    </Dialog>
  </article>;
}

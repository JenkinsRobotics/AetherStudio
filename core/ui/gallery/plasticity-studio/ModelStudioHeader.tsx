import { useEffect, useState } from "react";
import { AetherIcon, AppMark, AppWordmark, Button, CommandPalette, DocumentBar, IconButton, MenuButton, type CommandPaletteCommand } from "../../src";
import "./ModelStudioHeader.css";
import { TransparentHeaderUtilities } from "../TransparentHeaderUtilities";

/** The approved transparent header, connected to the local study's existing commands. */
export function ModelStudioHeader({ name, workspaceName, commands, onAction }: {
  name: string;
  workspaceName: string;
  commands: readonly CommandPaletteCommand[];
  onAction: (id: string) => void;
}) {
  const [search, setSearch] = useState(false);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      if (event.target instanceof Element && event.target.closest('[role="dialog"], [role="menu"]')) return;
      event.preventDefault(); setSearch(true);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return <>
    <DocumentBar variant="transparent" windowChrome={false} className="ps-app-header" leading={<>
      <AppWordmark app="cad" size={32} appearance="dark" />
      <span className="ps-header-mark" role="img" aria-label="Aether CAD"><AppMark app="cad" size={28} /></span>
      <span className="ps-header-divider" aria-hidden="true" />
      <strong className="ps-header-title" title={name}>{name}</strong>
      <MenuButton label={`Workspace version: ${workspaceName}`} className="ps-header-workspace" items={[
        { id: "current", label: workspaceName, kind: "radio", checked: true },
        { id: "file:properties", label: "Workspace properties…", separatorBefore: true },
      ]} onSelect={id => { if (id !== "current") onAction(id); }}>{workspaceName}<AetherIcon name="chevron-down" /></MenuButton>
      <IconButton label="Share document link" size="medium" disabled title="Save to Aether Studio to obtain a shareable document link."><AetherIcon name="link" /></IconButton>
      <span className="ps-header-local"><AetherIcon name="cloud" />Local preview</span>
    </>} trailing={<>
      <Button className="ps-header-search" aria-label="Search tools, features, or help" onClick={() => setSearch(true)}><AetherIcon name="search" /><span>Search tools, features, or help…</span><kbd>⌘ K</kbd></Button>
      <TransparentHeaderUtilities local onAccount={() => onAction("about")} onHelp={() => onAction("about")} onComments={() => onAction("comments")}/>
    </>} />
    <CommandPalette open={search} title="Search Model Studio" placeholder="Search tools and document actions…" commands={[...commands, { id: "about", label: "Model Studio help", category: "Help" }]} onClose={() => setSearch(false)} onSelect={id => { setSearch(false); onAction(id); }} />
  </>;
}

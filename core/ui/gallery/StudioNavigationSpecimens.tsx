import { useState } from "react";
import { AetherIcon, ApplicationSidebar, MenuButton, SidebarLabel, type SidebarSection } from "../src";
import "./StudioNavigationSpecimens.css";

const modes = [
  ["Design", "cylinder"], ["Sketch", "pencil"], ["Surface", "cube"],
  ["Sheet Metal", "cube-transparent"], ["Assembly", "assembly"],
  ["Drawing", "document-text"], ["Rendering", "cube"],
  ["Simulation", "waveform"], ["Manufacture", "tools"],
] as const;

function StudioSidebar({ id, collapsed = false }: { id: string; collapsed?: boolean }) {
  const [selected, setSelected] = useState("Design");
  const [workspace, setWorkspace] = useState("Main");
  const [sync, setSync] = useState("current");
  const [message, setMessage] = useState("");
  const sections: SidebarSection[] = [
    { id: "workspaces", items: modes.map(([label, icon]) => ({ id: label, label, icon, current: selected === label, onSelect: () => { setSelected(label); setMessage(`${label} selected`); } })) },
    { id: "resources", items: [["Files", "folder"], ["Teams", "people"], ["Learn", "book"]].map(([label, icon]) => ({ id: label, label, icon, current: selected === label, onSelect: () => { setSelected(label); setMessage(`${label} selected`); } })) },
  ];
  const status = sync === "current" ? "Up to date" : sync === "syncing" ? "Syncing…" : "Offline";
  return <ApplicationSidebar id={id} name="Aether CAD" variant="studio" defaultCollapsed={collapsed}
    app="cad" sections={sections}
    footer={<div className="studio-nav-context">
      <MenuButton label="Document and workspace" placement="top-start" items={[{ id: "Main", label: "Main workspace" }, { id: "Review", label: "Review workspace" }]}
        onSelect={id => { setWorkspace(id); setMessage(`${id} workspace selected`); }}>
        <AetherIcon name="cube" /><SidebarLabel><strong>Train Cart Wheel</strong><small>{workspace}<AetherIcon name="chevron-down" /></small></SidebarLabel>
        <AetherIcon name="chevron-down" className="studio-nav-document-chevron" />
      </MenuButton>
      <MenuButton label={`Cloud status: ${status}. Preview states`} placement="top-start" className={`studio-nav-cloud studio-nav-cloud--${sync}`}
        items={[{ id: "current", label: "Preview: Up to date" }, { id: "syncing", label: "Preview: Syncing" }, { id: "offline", label: "Preview: Offline" }]}
        onSelect={id => { setSync(id); setMessage(`Cloud preview: ${id}`); }}>
        <AetherIcon name="cloud" /><span className="studio-nav-cloud-copy"><SidebarLabel>Cloud</SidebarLabel><small><i aria-hidden="true" /><SidebarLabel>{status}</SidebarLabel></small></span>
      </MenuButton>
      <span className="studio-nav-announcement" role="status" aria-live="polite">{message}</span>
    </div>} />;
}

export function StudioNavigationSpecimens() {
  return <section className="studio-nav-specimens" aria-label="Studio navigation variant">
    <h4>Studio navigation · dark reference variant</h4>
    <p>Click the A to collapse or expand. Document and cloud controls preview their states.</p>
    <div className="studio-nav-comparison">
      <figure><div className="studio-nav-preview"><StudioSidebar id="gallery-studio-nav-expanded" /></div><figcaption>Expanded · 232 px</figcaption></figure>
      <figure><div className="studio-nav-preview"><StudioSidebar id="gallery-studio-nav-collapsed" collapsed /></div><figcaption>Collapsed · 72 px</figcaption></figure>
    </div>
  </section>;
}

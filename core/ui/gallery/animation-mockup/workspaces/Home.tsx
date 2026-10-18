/** HomeAssets.swift — HomeWorkspace: the three-column project launcher. */
import { useState } from "react";
import { AD, Badge, Divider, NewCharacterDialog, ProjectCard, Sym } from "../../../src/Kit";
import type { AppState } from "../AnimationMockupApp";
import { useDemo, type Workspace } from "../model";

const SECTIONS = [
  { id: "getStarted", label: "Get Started", icon: "star", subtitle: "Purpose-built Aether workspaces" },
  { id: "recents", label: "Recent Projects", icon: "clock", subtitle: "Projects you have opened" },
  { id: "characters", label: "Characters", icon: "character", subtitle: "Characters in this project" },
  { id: "library", label: "Character Library", icon: "library", subtitle: "Published, reusable characters" },
] as const;

const SAMPLE_RECENTS = [
  { name: "Robot Arm Assembly", subtitle: "9:41 AM", version: "V12", icon: "figure-walk" },
  { name: "Base", subtitle: "Yesterday", version: "V3", icon: "hexgrid" },
  { name: "Gripper", subtitle: "May 12, 2024", version: "V7", icon: "pinch" },
];

const ARCHETYPES: readonly { title: string; detail: string; icon: string; workspace: Workspace; preview?: boolean }[] = [
  { title: "Hardware Character", detail: "Rigid components, mates, servos, and motion", icon: "figure-stand", workspace: "character" },
  { title: "Digital Character", detail: "3D avatars, faces, and expressions", icon: "character", workspace: "character", preview: true },
  { title: "Show Control", detail: "Audio, screens, LEDs, and events", icon: "lighting", workspace: "show" },
];

export function HomeWorkspace({ app }: { app: AppState }) {
  const [section, setSection] = useState<(typeof SECTIONS)[number]["id"]>("getStarted");
  const demo = useDemo();
  const current = SECTIONS.find((s) => s.id === section)!;

  const columnHeader = (title: string, subtitle: string) => <div className="home-column-header"><strong>{title}</strong><span>{subtitle}</span></div>;
  const projectCard = (name: string, kind: string, meta: string, tint: string, onClick?: () => void) => <ProjectCard key={name} name={name} kind={kind} meta={meta} tint={tint} onClick={onClick} />;
  // The July-19 build's RECENT grid, kept verbatim.
  const REX_RECENTS = [["Rex", "animatronic dinosaur", "18 parts · 6 servos", AD.accent2], ["Marble Bust", "AR avatar", "1 mesh · face rig", AD.accent], ["Show — Lobby", "3 characters", "timeline · 4:20", AD.warn]] as const;

  const content = {
    getStarted: (
      <div className="home-get-started">
        <div><p className="home-welcome">Welcome back</p><h1>What are we bringing to life today?</h1></div>
        <div className="home-big-actions">
          {[["Import model", "cube-transparent", "STEP · STL · OBJ · glTF", AD.accent2, () => demo.importModel()],
            ["New character", "plus-square", "Start from an empty rig", AD.accent, () => demo.setShowNewCharacter(true)],
            ["Open show", "rectangle-group", "Sequence + hardware", AD.warn, () => app.go("show")]].map(([title, icon, sub, tint, tap]) => (
            <button key={title as string} type="button" className="home-big-action" style={{ "--tint": tint } as React.CSSProperties} onClick={tap as () => void}>
              <Sym name={icon as string} size={22} className="aui-kit-tinted" /><span className="aui-kit-spacer" /><strong>{title as string}</strong><span>{sub as string}</span>
            </button>))}
        </div>
        <span className="aui-kit-caption" style={{ fontSize: 10.5 }}>START FROM</span>
        <div className="aui-kit-stack-10">
          {ARCHETYPES.map((a) => (
            <button key={a.title} type="button" className="home-archetype" onClick={() => { demo.setStatus(`New ${a.title} project`); app.go(a.workspace); }}>
              <Sym name={a.icon} size={17} style={{ color: a.preview ? AD.text3 : AD.accent, width: 26 }} />
              <span className="aui-kit-stack-3"><span className="aui-kit-hstack-6"><strong>{a.title}</strong>{a.preview && <Badge text="preview" tint={AD.warn} />}</span><small>{a.detail}</small></span>
            </button>))}
        </div>
        <span className="aui-kit-caption" style={{ fontSize: 10.5 }}>RECENT</span>
        <div className="home-grid">{REX_RECENTS.map(([n, k, m, t]) => projectCard(n, k, m, t, () => app.go(n.startsWith("Show") ? "show" : "character")))}</div>
        <span className="aui-kit-caption" style={{ fontSize: 10.5 }}>NEXT STEPS</span>
        <div className="home-guides">
          {[["Assemble a character", "Import parts, then place them around the character origin.", AD.accent2, "character"],
            ["Rig it with mates", "Pick two parts and connect them with a revolute or slider.", AD.accent, "rig"],
            ["Animate the rig", "Key mate values on the timeline and press play.", AD.warn, "animate"]].map(([title, detail, tint, ws]) => (
            <button key={title} type="button" className="home-guide" style={{ "--tint": tint } as React.CSSProperties} onClick={() => app.go(ws as Workspace)}><strong>{title}</strong><span>{detail}</span></button>))}
        </div>
      </div>
    ),
    recents: <div className="home-grid">{REX_RECENTS.map(([n, k, m, t]) => projectCard(n, k, m, t, () => app.go("character")))}{SAMPLE_RECENTS.map((r) => projectCard(r.name, "Local project", r.subtitle, AD.accent2, () => app.go("character")))}</div>,
    characters: <div className="home-grid">{demo.characters.map((c) => projectCard(c.name, `${c.parts.length} parts`, `${demo.mates.length} mates · ${c.clips} clips`, AD.accent, () => { demo.setActiveCharacterID(c.id); app.go("character"); }))}</div>,
    library: <div className="aui-kit-stack-12"><p className="aui-kit-t3 aui-kit-s115">Publish a character from the Character tab to reuse it across projects.</p><div className="home-grid">{projectCard("Rex", "Published character", "Character Library", AD.warn)}</div></div>,
  };

  return (
    <div className="home">
      <aside className="home-left">
        <div className="aui-kit-stack-8">
          <button type="button" className="home-project-action" data-filled onClick={() => { demo.setStatus("New Studio Project"); app.go("character"); }}><Sym name="document-add" size={12} weight="medium" />New Studio Project</button>
          <button type="button" className="home-project-action" onClick={() => demo.setStatus("Open A Project (placeholder)")}><Sym name="folder" size={12} weight="medium" />Open A Project</button>
        </div>
        <nav className="home-nav" aria-label="Home sections">
          {SECTIONS.map((s) => <button key={s.id} type="button" data-active={section === s.id || undefined} aria-current={section === s.id ? "page" : undefined} onClick={() => setSection(s.id)}><Sym name={s.icon} size={11} weight="medium" style={{ width: 16 }} /><span>{s.label}</span></button>)}
        </nav>
        <div className="aui-kit-between"><strong className="aui-kit-s12">Recent</strong><span className="aui-kit-caption" style={{ fontSize: 9 }}>SAMPLES</span></div>
        <div className="aui-kit-stack-8 aui-kit-scroll">
          {SAMPLE_RECENTS.map((r) => (
            <button key={r.name} type="button" className="home-recent" onClick={() => app.go("character")}>
              <span className="home-recent-thumb"><Sym name={r.icon} size={17} /></span>
              <span className="home-recent-text"><strong>{r.name}</strong><span>{r.subtitle}</span></span>
              <span className="aui-kit-spacer" /><span className="home-version">{r.version}</span>
            </button>))}
        </div>
      </aside>
      <Divider vertical />
      <main className="home-middle">
        {columnHeader(current.label, current.subtitle)}
        <div className="aui-kit-scroll" style={{ flex: 1 }}>{content[section]}</div>
      </main>
      <Divider vertical />
      <aside className="home-right">
        {columnHeader("Open & Connected", "One format, many embodiments")}
        {[["GitHub Repository", "code"], ["Workflow Reference", "document-text"]].map(([t, i]) => <a key={t} className="home-link" href="#" onClick={(e) => e.preventDefault()}><Sym name={i} size={12} className="aui-kit-t2" style={{ width: 18 }} /><span>{t}</span></a>)}
        <Divider style={{ margin: "4px 0" }} />
        {[["3D", "RealityKit native viewport"], ["{ }", "Open Aether formats"], ["~", "Hardware-neutral motion"]].map(([g, t]) => <div key={g} className="home-fact"><code>{g}</code><span>{t}</span></div>)}
        <Divider style={{ margin: "4px 0" }} />
        <span className="aui-kit-caption" style={{ fontSize: 9 }}>LEARN</span>
        {[["Tutorials", "graduationcap"], ["Workflows", "branch"], ["Manual", "book"]].map(([t, i]) => <a key={t} className="home-learn" href="#" onClick={(e) => e.preventDefault()}><Sym name={i} size={11} style={{ width: 16 }} /><span>{t}</span><span className="aui-kit-spacer" /><Sym name="open-external" size={9} className="aui-kit-t3" /></a>)}
        <span className="aui-kit-spacer" />
        <span className="aui-kit-mono aui-kit-t3 aui-kit-s10">Aether Animation Mockup 0.1.0</span>
      </aside>
      {demo.showNewCharacter && <div className="animation-mockup-scrim" onClick={() => demo.setShowNewCharacter(false)}><div onClick={(e) => e.stopPropagation()}><NewCharacterDialog onCancel={() => demo.setShowNewCharacter(false)} onCreate={(name) => { demo.addCharacter(name); demo.setShowNewCharacter(false); }} /></div></div>}
    </div>
  );
}

import { StudioEnvironmentPanel } from "../StudioReferencePanels";
import { NativeVariants } from "./NativeVariants";
import { MateEditorLabSpecimen } from "../StudioMateInspector";
import { StudioNodeWorkspace } from "../StudioShowWorkspace";
import { useEffect, useState } from "react";
import { AetherIcon, Button, DocumentTabs, Timeline, Tree, type LayoutPreset } from "../../src/index";
import { AnnouncementCard, AssistantPanel, ImportWorkflow, MaterialEditor, SpecimenBoard } from "../../src/ConceptWidgets";
import type { AssistantMessage } from "../../src/AssistantPanel";
import type { SpecimenSectionDefinition } from "../../src/SpecimenBoard";
import {
  ActionButtonsSpecimen, CompactActionPanelSpecimen, ComponentMenuSpecimen, ConceptTemplateCardsSpecimen,
  CreationPaletteSpecimen, DetachedToolSpecimen, DialogSpecimen, EmptyWorkspaceSpecimen, FieldsSpecimen,
  FloatingRibbonSpecimen, GraphicsPopoverSpecimen, HardwareMonitorSpecimen, IconThemeSelectorSpecimen,
  InspectorSpecimen, LayeredIconListSpecimen, LayoutControlsSpecimen, ProductionChromeSpecimen,
  ProgressStatusSpecimen, RecentProjectsSpecimen, TimelineDesignBSpecimen, Workspace3DSpecimen,
  WorkspaceLayoutsSpecimen,
} from "./UIDevSpecimens";

const animationTracks = [
  { id: "yaw", label: "Head Yaw", color: "#55a9fb", keyframes: [{ timeS: 0 }, { timeS: 2.2 }, { timeS: 5.1 }] },
  { id: "audio", label: "Audio", kind: "audio" as const, color: "#49c99a", keyframes: [{ timeS: 1.1 }, { timeS: 6.3 }] },
  { id: "lighting", label: "Lighting", color: "#bf6ae7", keyframes: [{ timeS: .6 }, { timeS: 5.1 }, { timeS: 7.6 }] },
];
const showTracks = [
  { id: "audio", label: "Audio", kind: "audio" as const, color: "#49c99a", keyframes: [{ timeS: 0 }, { timeS: 5.8 }] },
  { id: "video", label: "Video", color: "#55a9fb", keyframes: [{ timeS: 1.2 }, { timeS: 6.4 }] },
  { id: "events", label: "Events", color: "#ff8c42", keyframes: [{ timeS: 2.1 }, { timeS: 7.2 }] },
  { id: "character", label: "Character", color: "#b873dd", keyframes: [{ timeS: .8 }, { timeS: 4.2 }] },
];

function filterIDs(tool: string): readonly string[] | null {
  const filters: Record<string, readonly string[]> = {
    agent: ["agent", "advisor"], navigator: ["navigator", "layered-icon-list"],
    inspector: ["component-inspector", "appearance-inspector", "material-editor", "visualization-panel", "mate-editor"],
    "timeline-preview": ["animation-timeline", "show-timeline", "timeline-design-b"],
    "workspace-3d": ["workspace-3d", "triad-manipulator", "viewport-controls"],
    "floating-window": ["production-chrome", "workspace-layouts", "recent-projects", "document-tab-strip", "floating-tool", "floating-ribbon"],
    "mate-editor": ["mate-editor"], triad: ["triad-manipulator"],
    buttons: ["action-buttons", "compact-tab-panel"], inputs: ["input-fields", "layout-style-controls"],
    menus: ["context-menu", "document-tab-strip", "compact-tab-panel"], dialogs: ["alert", "confirmation", "model-import-staging"],
    popovers: ["popover", "notification-popup"], references: ["notification-popup", "model-import-staging", "concept-template-cards", "icon-theme-selector"],
    panels: ["navigator", "agent", "component-inspector", "appearance-inspector", "material-editor", "visualization-panel", "hardware-panel", "layered-icon-list"],
    "design-sandbox": ["appearance-inspector", "material-editor", "visualization-panel", "layout-style-controls", "icon-theme-selector"],
    "ui-kit": ["action-buttons", "input-fields", "compact-tab-panel", "empty-state", "progress-and-status", "concept-template-cards"],
    tokens: ["appearance-inspector", "material-editor", "layout-style-controls", "icon-theme-selector"],
  };
  return filters[tool] ?? null;
}

/** The native templates and shared advisor with their live state; the browser and the flat showcase rows both read it. */
function useNativeTemplateSections(preset: LayoutPreset, tool = "templates") {
  const [selectedTree, setSelectedTree] = useState<ReadonlySet<string>>(new Set(["head"]));
  const [timeS, setTimeS] = useState(2.2);
  const [nodePlaying, setNodePlaying] = useState(false);
  useEffect(() => {
    if (!nodePlaying || tool !== "nodes") return;
    const timer = window.setInterval(() => setTimeS((time) => (time + 1 / 30) % 30), 1000 / 30);
    return () => window.clearInterval(timer);
  }, [nodePlaying, tool]);
  const [activeDocument, setActiveDocument] = useState("addresses");
  const [materialName, setMaterialName] = useState("Brushed Metal Material");
  const [materialColor, setMaterialColor] = useState("#c7b477");
  const [channels, setChannels] = useState([{ id: "roughness", label: "Roughness", value: .23 }, { id: "mix", label: "Mix", value: .63 }, { id: "specular", label: "Specular", value: .72 }]);
  const [materialAppearance,setMaterialAppearance]=useState({color:"#54b4dc",opacity:100,tessellation:"auto" as const});
  const [messages, setMessages] = useState<AssistantMessage[]>([{ id: "welcome", role: "assistant", text: "Let’s work in Aether Animation Studio. I can explain tools, review a rig, and guide an operator through a task." }]);
  const [announcementVisible, setAnnouncementVisible] = useState(true);

  const navigator = <div className="uidev-navigator"><header><div><strong>COMPONENTS</strong><span>UI Dev Sample Rig</span></div><AetherIcon name="more-circle"/></header><Tree ariaLabel="UI Dev project navigator" selectedIDs={selectedTree} onSelect={(ids) => setSelectedTree(new Set(ids))} nodes={[
    { id: "base", label: "Base", icon: <AetherIcon name="cube"/> },
    { id: "head", label: "Head Assembly", icon: <AetherIcon name="assembly"/>, children: [{ id: "torso", label: "Torso", icon: <AetherIcon name="cube"/> }, { id: "head-part", label: "Head", icon: <AetherIcon name="cube"/> }] },
    { id: "mates", label: "MATES", icon: <AetherIcon name="mate"/>, children: [{ id: "yaw", label: "Head Yaw", icon: <AetherIcon name="revolute"/> }, { id: "fastened", label: "Base Fastened", icon: <AetherIcon name="fastened"/> }] },
    { id: "assets", label: "ASSETS", icon: <AetherIcon name="layers"/>, children: [{ id: "robot", label: "robot.usdz", icon: <AetherIcon name="file-character"/> }] },
  ]}/><footer><Button><AetherIcon name="plus" /></Button><Button>•••</Button></footer></div>;

  const materialEditor = <MaterialEditor name={materialName} color={materialColor} type="Glossy" channels={channels} onNameChange={setMaterialName} onColorChange={setMaterialColor} onChannelChange={(id, value) => setChannels((current) => current.map((channel) => channel.id === id ? { ...channel, value } : channel))}/>;
  const materialBrowser = <StudioEnvironmentPanel appearance={materialAppearance} onAppearance={value=>setMaterialAppearance({...value,tessellation:"auto"})} assignmentLabel="Head Pan Housing" initialTab="material"/>;
  const animationTimeline = <Timeline tracks={animationTracks} durationS={8} timeS={timeS} onSeek={setTimeS}/>;
  const showTimeline = <Timeline tracks={showTracks} durationS={8} timeS={timeS} onSeek={setTimeS}/>;

  const sections: SpecimenSectionDefinition[] = [
    { id: "windows", title: "Windows & Workspaces", detail: "Primary app regions shown at the proportions operators actually use.", minimumWidth: 430, maximumWidth: 590, specimens: [
      { id: "production-chrome", title: "Production App Chrome", detail: "Project identity, centered workspace stages, status, layout, and help.", icon: "window", idealSize: "1180 × 150", previewHeight: 190, content: <ProductionChromeSpecimen/> },
      { id: "workspace-layouts", title: "Workspace Layout Modes", detail: "The same browser and inspector shown docked, floating, and canvas-hidden.", icon: "windows", idealSize: "1080 × 440", previewHeight: 390, content: <WorkspaceLayoutsSpecimen active={preset}/> },
      { id: "recent-projects", title: "Recent Projects", detail: "Start-screen project history and revisions.", icon: "history", idealSize: "440 × 250", previewHeight: 230, content: <RecentProjectsSpecimen/> },
      { id: "navigator", title: "Project Navigator", detail: "Component tree, groups, mates, and assets.", icon: "sidebar", idealSize: "320 × 520", previewHeight: 360, content: navigator },
      { id: "workspace-3d", title: "3D Workspace", detail: "Primary model viewport and camera HUD.", icon: "cube", idealSize: "720 × 520", previewHeight: 360, content: <Workspace3DSpecimen/> },
      { id: "agent", title: "Aether Agent", detail: "Docked assistant; never a floating default.", icon: "aether", idealSize: "360 × 560", previewHeight: 410, content: <AssistantPanel title="Aether Agent" detail="Docked Studio assistant concept" messages={messages} suggestions={["What can you help me with?", "How do I create a revolute mate?", "Review this workspace layout"]} onSubmit={(text) => setMessages((current) => [...current, { id: `${Date.now()}`, role: "user", text }])}/> },
      { id: "advisor", title: "AI Advisor", detail: "Shared welcome, sample prompts and conversation view. Local showcase only.", icon: "advisor", idealSize: "320 × 720", previewHeight: 650, content: <AdvisorSpecimen/> },
      { id: "document-tab-strip", title: "Document Tab Strip", detail: "Open projects with select, close, and add.", icon: "document", idealSize: "980 × 88", previewHeight: 150, content: <div className="uidev-document-tabs"><i className="uidev-window-dots"><b /><b /><b /></i><DocumentTabs ariaLabel="UI Dev documents" tabs={[{id:"addresses",label:"db1_addresses"},{id:"archive",label:"db1_archive",dirty:true},{id:"motion",label:"head_motion"}]} activeID={activeDocument} onSelect={setActiveDocument} onClose={()=>undefined}/><Button><AetherIcon name="plus" /></Button></div> },
    ]},
    { id: "timelines", title: "Timelines & Editors", detail: "Horizontal editing surfaces reserve width for time and track relationships.", minimumWidth: 430, maximumWidth: 590, specimens: [
      { id: "animation-timeline", title: "Animation Timeline", detail: "Tracks, playhead, keys, and transport.", icon: "animate", idealSize: "760 × 280", previewHeight: 250, content: animationTimeline },
      { id: "show-timeline", title: "Show Timeline", detail: "Audio, video, event, and character tracks.", icon: "file-show", idealSize: "760 × 300", previewHeight: 250, content: showTimeline },
      { id: "timeline-design-b", title: "Timeline Design B", detail: "Rows, authored keys, and connected motion paths.", icon: "sketch-nodes", idealSize: "1080 × 560", previewHeight: 520, content: <TimelineDesignBSpecimen>{animationTimeline}</TimelineDesignBSpecimen> },
    ]},
    { id: "inspectors", title: "Inspectors", detail: "Narrow, task-focused property surfaces with explicit values and actions.", minimumWidth: 330, maximumWidth: 450, specimens: [
      { id: "component-inspector", title: "Component Inspector", detail: "Transform, identity, and ownership.", icon: "settings", idealSize: "340 × 520", previewHeight: 390, content: <InspectorSpecimen kind="component"/> },
      { id: "appearance-inspector", title: "Appearance", detail: "Palette, RGB, opacity, and quality.", icon: "palette", idealSize: "340 × 520", previewHeight: 390, content: <InspectorSpecimen kind="appearance"/> },
      { id: "material-editor", title: "Material Editor", detail: "Preview, surface color, channels, and assignment.", icon: "palette", idealSize: "410 × 620", previewHeight: 520, content: materialEditor },
      { id: "visualization-panel", title: "Visualization Browser", detail: "The production material and environment trigger, library, and assignment states.", icon: "appearance", idealSize: "420 × 720", previewHeight: 620, content: materialBrowser },
      { id: "mate-editor", designSize: [720, 610], title: "Mate Editor", detail: "Shared ten-kind mate configuration panel.", icon: "mate", idealSize: "350 × 540", previewHeight: 390, content: <MateEditorLabSpecimen/> },
    ]},
    { id: "panels", title: "Panels & Tools", detail: "Persistent and temporary instruments, including rig-specific interaction tools.", minimumWidth: 330, maximumWidth: 450, specimens: [
      { id: "creation-palette", title: "Rig Creation Palette", detail: "Components, mates, motors, media, and events.", icon: "new", idealSize: "760 × 130", previewHeight: 230, content: <CreationPaletteSpecimen/> },
      { id: "triad-manipulator", title: "Triad Manipulator", detail: "Translation, rotation, and plane handles.", icon: "planes-axes", idealSize: "440 × 440", previewHeight: 390, content: <Workspace3DSpecimen triad/> },
      { id: "layered-icon-list", title: "Layered Icon List", detail: "Dense hierarchy, tags, states, and type icons.", icon: "layers", idealSize: "380 × 680", previewHeight: 520, content: <LayeredIconListSpecimen/> },
      { id: "hardware-panel", title: "Hardware Monitor", detail: "Connection, safety, channel, and output state.", icon: "hardware", idealSize: "360 × 460", previewHeight: 360, content: <HardwareMonitorSpecimen/> },
      { id: "floating-tool", title: "Detached Tool", detail: "The one intentional floating utility pattern.", icon: "windows", idealSize: "360 × 420", previewHeight: 360, content: <DetachedToolSpecimen/> },
      { id: "floating-ribbon", title: "Floating Tool Ribbon", detail: "Complete workspace groups with native tab, icon, label, divider, and caption anatomy.", icon: "layout", idealSize: "620 × 120", previewHeight: 180, content: <FloatingRibbonSpecimen/> },
    ]},
    { id: "dialogs", title: "Dialogs, Menus & Popovers", detail: "Contextual and blocking decisions shown together for wording and density review.", minimumWidth: 300, maximumWidth: 410, specimens: [
      { id: "alert", title: "Information Alert", detail: "Short, blocking information with one safe exit.", icon: "status-error", idealSize: "340 × 170", previewHeight: 190, content: <DialogSpecimen/> },
      { id: "confirmation", title: "Confirmation Dialog", detail: "Consequential action, object name, and Cancel.", icon: "delete", idealSize: "380 × 220", previewHeight: 220, content: <DialogSpecimen confirmation/> },
      { id: "popover", title: "Graphics Popover", detail: "Task-local settings anchored to their trigger.", icon: "view", idealSize: "300 × 250", previewHeight: 260, content: <GraphicsPopoverSpecimen/> },
      { id: "context-menu", title: "Component Menu", detail: "Grouped CAD-style commands and destructive tail.", icon: "menu", idealSize: "290 × 410", previewHeight: 370, content: <ComponentMenuSpecimen/> },
      { id: "notification-popup", title: "Notification Popup", detail: "Dismissible announcement with supporting rows.", icon: "comment", idealSize: "340 × 430", previewHeight: 430, content: announcementVisible ? <AnnouncementCard badge="New in v0.1.5" title="Connect multiple controllers" detail="Route one character across multiple output devices. Choose a primary controller while keeping remaining buses visible." items={[{id:"pca",title:"PCA9685 · Stage Left",detail:"Primary · 12 channels",selected:true},{id:"dx",title:"DYNAMIXEL Bus",detail:"6 devices · ready"}]} onDismiss={()=>setAnnouncementVisible(false)}/> : <Button onClick={()=>setAnnouncementVisible(true)}>Restore Preview</Button> },
      { id: "model-import-staging", designSize: [620, 690], title: "Character Part Import", detail: "Destination character, source files, units, and assembly workflow confirmation.", icon: "import", idealSize: "620 × 690", previewHeight: 530, content: <ImportWorkflow title="Import Character Parts" detail="Review destination and source files before importing." destination="Atlas · Character origin" files={[{id:"base",name:"base.stl",detail:"Millimeters · 1 part"},{id:"head",name:"head.stl",detail:"Millimeters · 1 part"}]} options={["Copy into project","Preserve source hierarchy"]}/> },
    ]},
    { id: "controls", title: "Buttons & Inputs", detail: "The shared action, selection, field, picker, and viewport-control vocabulary.", minimumWidth: 300, maximumWidth: 410, specimens: [
      { id: "action-buttons", title: "Action Buttons", detail: "Primary, secondary, quiet, destructive, and states.", icon: "mouse", idealSize: "360 × 230", previewHeight: 240, content: <ActionButtonsSpecimen/> },
      { id: "input-fields", title: "Fields & Inputs", detail: "Text, number, search, picker, toggle, and readout.", icon: "text", idealSize: "380 × 360", previewHeight: 340, content: <FieldsSpecimen/> },
      { id: "viewport-controls", title: "Viewport Controls", detail: "View cube, axes, render menu, and camera actions.", icon: "cube", idealSize: "360 × 300", previewHeight: 300, content: <Workspace3DSpecimen/> },
      { id: "layout-style-controls", designSize: [980, 620], title: "Layout & Style Controls", detail: "Layout, border, spacing, and background inspector groups.", icon: "layout", idealSize: "980 × 620", previewHeight: 520, content: <LayoutControlsSpecimen/> },
      { id: "compact-tab-panel", title: "Compact Action Panel", detail: "Primary command, settings, and theme switch.", icon: "commands", idealSize: "320 × 190", previewHeight: 260, content: <CompactActionPanelSpecimen/> },
      { id: "icon-theme-selector", designSize: [1040, 620], title: "Icon Selector & Theme Lab", detail: "Selected icons and contextual actions compared across five palettes.", icon: "apps", idealSize: "1040 × 620", previewHeight: 500, content: <IconThemeSelectorSpecimen/> },
    ]},
    { id: "status", title: "Status & Empty States", detail: "Loading, unavailable, empty, and success states remain informative and honest.", minimumWidth: 300, maximumWidth: 410, specimens: [
      { id: "empty-state", title: "Empty Workspace", detail: "A clear next action when no rig content exists.", icon: "new", idealSize: "420 × 260", previewHeight: 270, content: <EmptyWorkspaceSpecimen/> },
      { id: "progress-and-status", title: "Progress & Status", detail: "Success, loading, unavailable, and safety feedback.", icon: "status-incomplete", idealSize: "380 × 280", previewHeight: 290, content: <ProgressStatusSpecimen/> },
      { id: "concept-template-cards", designSize: [1080, 680], title: "Concept Template Cards", detail: "Starting points for onboarding, empty workspaces, and add-content flows.", icon: "items", idealSize: "1080 × 680", previewHeight: 520, content: <ConceptTemplateCardsSpecimen/> },
    ]},
  ];
  return { sections, timeS, setTimeS, nodePlaying, setNodePlaying };
}

export function UIDevWorkspace({ preset, specimen }: { preset: LayoutPreset; specimen: string | null }) {
  const tool = specimen ?? "templates";
  const { sections, timeS, setTimeS, nodePlaying, setNodePlaying } = useNativeTemplateSections(preset, tool);

  if (tool === "variants") return <div className="uidev-workspace"><div className="uidev-scroll"><NativeVariants/></div></div>;

  const allowed = filterIDs(tool);
  const visibleSections = sections.map((section) => ({ ...section, specimens: allowed ? section.specimens.filter((item) => allowed.includes(item.id)) : section.specimens })).filter((section) => section.specimens.length > 0);
  if (tool === "nodes") visibleSections.splice(0, visibleSections.length, { id: "node-workspace", title: "Node Workspaces", detail: "Connected show logic rendered as an editable production surface.", minimumWidth: 700, maximumWidth: 1080, specimens: [{ id: "node-workspace", title: "Node Workspace", detail: "Scene flow, parallel actions, events, and output.", icon: "sketch-nodes", idealSize: "1080 × 560", previewHeight: 520, content: <StudioNodeWorkspace timeS={timeS} playing={nodePlaying} onSeek={setTimeS} onTogglePlay={() => setNodePlaying((value) => !value)}/> }] });

  return <div className="uidev-workspace"><header><AetherIcon name="hammer"/><div><strong>LIVING UI STANDARD</strong><span>Change the reusable component first; product surfaces inherit it.</span></div><small>Development tool</small></header><div className="uidev-scroll"><SpecimenBoard eyebrow="ANIMA STUDIO · UI SPECIMEN BOARD" title={tool === "templates" ? "Every current surface, together" : tool.replaceAll("-", " ").toUpperCase()} detail="Review complete production surfaces, interaction patterns, and feedback states before they enter a product workspace." stats={tool === "templates" ? [`${sections.reduce((count, section) => count + section.specimens.length, 0)} TEMPLATES`, `${sections.length} SECTIONS`] : []} status={tool === "templates" ? "Shared components update live" : undefined} sections={visibleSections}/></div></div>;
}

/** One native template as a flat, captioned specimen at its design width — no card, no fixed preview height. */
export function NativeTemplate({ id }: { id: string }) {
  const { sections } = useNativeTemplateSections("docked");
  const template = sections.flatMap((section) => section.specimens).find((item) => item.id === id);
  if (!template) return null;
  const width = template.designSize?.[0] ?? Number.parseInt(template.idealSize ?? "360", 10);
  return (
    <div className="gallery-variant" data-native-template={id} data-wide={width >= 900 || undefined}>
      <small>{template.title} · native template · {template.idealSize}</small>
      <div className="gallery-native-template" style={{ width, maxWidth: "100%" }}>{template.content}</div>
    </div>
  );
}

function AdvisorSpecimen() {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  return <AssistantPanel title="Advisor preview" heading="AI Advisor" layout="agent" messages={messages}
    status="Local showcase · no provider request" suggestions={["Help me plan my next step.", "Review my workspace."]}
    toolbar={<Button onClick={() => setMessages([])}>New chat</Button>}
    onRate={(id, rating) => setMessages(current => current.map(message => message.id === id ? {...message, rating} : message))}
    onSubmit={text => setMessages(current => [...current, {id:crypto.randomUUID(),role:"user",text},
      {id:crypto.randomUUID(),role:"assistant",text:"Showcase response: this demonstrates the conversation layout. Connect a provider in an Aether workspace for live assistance."}])}/>;
}

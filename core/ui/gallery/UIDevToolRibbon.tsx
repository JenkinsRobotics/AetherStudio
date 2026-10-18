import { useEffect, useRef, useState } from "react";
import {
  AetherIcon,
  type AetherIconName,
  IconButton,
  Popover,
  Ribbon,
  RibbonGroup,
  RibbonTool,
} from "../src/index";
import { nativeRibbonCatalog } from "./NativeRibbonCatalog";
import { useAnimationStudioPreference } from "./AnimationStudioPreferences";
import {
  ribbonCatalog,
  workspaces,
  type RibbonCommand,
  type RibbonSection,
  type WorkspaceID,
} from "./AnimationStudioCatalog";

export type UIDevToolDensity = "compact" | "standard" | "expanded";
export type UIDevToolbarShape = "square" | "soft" | "rounded";

const densityOptions: readonly { id: UIDevToolDensity; label: string; detail: string; icon: "apps" | "layout" | "items" }[] = [
  { id: "compact", label: "Compact", detail: "Icons only", icon: "apps" },
  { id: "standard", label: "Standard", detail: "Icons and labels", icon: "layout" },
  { id: "expanded", label: "Expanded", detail: "Grouped, with headings", icon: "items" },
];

const shapeOptions: readonly { id: UIDevToolbarShape; label: string; detail: string }[] = [
  { id: "square", label: "Square", detail: "Crisp corners" },
  { id: "soft", label: "Soft", detail: "Lightly rounded" },
  { id: "rounded", label: "Rounded", detail: "Full pill" },
];

function nativeNodeIcon(label: string): AetherIconName {
  const icons: Record<string,AetherIconName> = {Start:"play",End:"close",Sequence:"items",Parallel:"parallel","IF / ELSE":"connector",Loop:"redo","Animation Clip":"file-clip",Pose:"file-character",Wait:"history","Wait for Event":"history","Emit Event":"wireless","Set Variable":"settings",Select:"node-select",Hand:"mouse",Connect:"connector","Frame All":"fit",Validate:"status-incomplete",AND:"connector",OR:"connector",XOR:"parallel",NOT:"status-error",Text:"text",Microphone:"animate",Hardware:"hardware",Screen:"window",LED:"apps",Audio:"animate","Audio Clip":"animate",Motion:"file-character",Event:"wireless","End Scene":"close",Monitor:"gauge","Read Input":"import","Write Output":"export",Register:"settings",Flag:"status-incomplete",Position:"fit",Memory:"layers","Tool Call":"commands",STT:"comment",TTS:"comment",LLM:"ai-generate","AI Behavior":"ai-generate"};
  return icons[label] ?? "sketch-nodes";
}

function commandGroups(section: RibbonSection, commands: readonly RibbonCommand[]) {
  const groups: { label: string; commands: RibbonCommand[] }[] = [];
  for (const command of commands) {
    const label = command.group ?? section.label;
    const group = groups.find((entry) => entry.label === label);
    if (group) group.commands.push(command);
    else groups.push({ label, commands: [command] });
  }
  return groups;
}

function ToolPalette({ commands, activeTool, onCommand }: {
  commands: readonly RibbonCommand[];
  activeTool: string | null;
  onCommand: (id: string, label: string) => void;
}) {
  return <div className="animation-toolbar-palette">
    {commands.map((command) => <button
      key={command.id}
      type="button"
      disabled={command.disabled}
      title={command.disabled ? `${command.label} · Unavailable in this concept` : command.label}
      aria-pressed={activeTool === command.id}
      onClick={() => onCommand(command.id, command.label)}
    >
      <AetherIcon name={command.icon} />
      <span>{command.label}</span>
      {activeTool === command.id ? <AetherIcon name="status-incomplete" /> : null}
    </button>)}
  </div>;
}

function SettingRow({ selected, label, detail, icon, onClick }: {
  selected: boolean;
  label: string;
  detail: string;
  icon: "apps" | "layout" | "items" | "window";
  onClick: () => void;
}) {
  return <button className="animation-toolbar-setting" type="button" aria-pressed={selected} onClick={onClick}>
    <AetherIcon name={icon} />
    <span><strong>{label}</strong><small>{detail}</small></span>
    {selected ? <AetherIcon name="status-incomplete" /> : null}
  </button>;
}

export function UIDevToolRibbon({ workspace, activeSection, activeTool, onSection, onCommand }: {
  workspace: WorkspaceID;
  activeSection: string;
  activeTool: string | null;
  onSection: (label: string) => void;
  onCommand: (id: string, label: string) => void;
}) {
  const [density, setDensity] = useAnimationStudioPreference<UIDevToolDensity>("toolbar-density", "expanded");
  const [shape, setShape] = useAnimationStudioPreference<UIDevToolbarShape>("toolbar-shape", "soft");
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const [palette, setPalette] = useState<{ anchor: HTMLElement; section: RibbonSection; commands: readonly RibbonCommand[] } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const source = workspace in nativeRibbonCatalog ? nativeRibbonCatalog[workspace as keyof typeof nativeRibbonCatalog] : null;
  const sections: readonly RibbonSection[] = workspace === "nodes" ? nativeRibbonCatalog.nodes.map((section) => ({label:section.label,commands:section.commands.map((command) => ({id:`native-${section.label}-${command.label}`,label:command.label,icon:nativeNodeIcon(command.label),disabled:!command.action}))})) : ribbonCatalog[workspace].map((section) => ({...section,commands:section.commands.map((command) => {
    const native = source?.find((entry) => entry.label === section.label)?.commands.find((entry) => entry.label === command.label);
    const localModelTool = ["gear","rack","screw","linear","box","cylinder","sphere","empty-point","locator","fastened","parallel","pin-slot","width","tangent","revolute","slider","cylindrical","planar","ball"].includes(command.id);
    return {...command, disabled: source ? !native?.action : workspace === "modeling" ? !localModelTool : ["canvas2d","vr"].includes(workspace) ? true : command.disabled};
  })}));
  const selected = sections.find((section) => section.label === activeSection) ?? sections[0];
  const usesCategoryTabs = density === "expanded" && workspace !== "assets" && sections.length > 1;
  const visibleSections = usesCategoryTabs && selected ? [selected] : sections;

  useEffect(() => {
    scrollRef.current?.scrollTo?.({ left: 0 });
    setPalette(null);
  }, [density, workspace, activeSection]);

  const chooseCommand = (id: string, label: string) => {
    onCommand(id, label);
    setPalette(null);
  };
  const openPalette = (event: React.MouseEvent<HTMLElement>, section: RibbonSection, commands: readonly RibbonCommand[]) => {
    setPalette({ anchor: event.currentTarget, section, commands });
  };
  const scroll = (direction: -1 | 1) => scrollRef.current?.scrollBy?.({ left: direction * Math.max(240, scrollRef.current.clientWidth * .72), behavior: "smooth" });

  return <div className={`animation-ribbon-surface${usesCategoryTabs ? " animation-ribbon-surface--tabs" : ""}`} data-density={density} data-shape={shape}>
    {usesCategoryTabs ? <div className="animation-ribbon-tabs" role="tablist" aria-label={`${workspaces.find((entry) => entry.id === workspace)?.label ?? "UI library"} tools`}>
      {sections.map((section) => <button key={section.label} type="button" role="tab"
        aria-selected={section.label === selected?.label}
        className={section.label === selected?.label ? "animation-ribbon-tab animation-ribbon-tab--active" : "animation-ribbon-tab"}
        onClick={() => onSection(section.label)}>{section.label}</button>)}
    </div> : null}
    <div className="animation-ribbon-row">
      <IconButton className="animation-ribbon-scroll-button" label="Scroll tools left" onClick={() => scroll(-1)}><AetherIcon name="chevron" /></IconButton>
      <div className="animation-ribbon-scroll" ref={scrollRef}>
        {density === "compact" ? <div className="animation-ribbon-compact" role="toolbar" aria-label="Compact tools">
          {visibleSections.map((section) => <button
            key={section.label}
            type="button"
            aria-label={`${section.label} tools`}
            aria-expanded={palette?.section.label === section.label}
            className={section.commands.some((command) => command.id === activeTool) ? "animation-ribbon-category animation-ribbon-category--active" : "animation-ribbon-category"}
            onClick={(event) => openPalette(event, section, section.commands)}
          ><AetherIcon name={section.commands[0]?.icon ?? "apps"} /></button>)}
        </div> : <Ribbon>
          {visibleSections.flatMap((section) => {
            const commands = density === "standard" ? section.commands.slice(0, 3) : section.commands;
            const overflow = density === "standard" ? section.commands.slice(3) : [];
            const groups = commandGroups(section, commands);
            return groups.map((group, groupIndex) => <RibbonGroup key={`${section.label}-${group.label}`} label={group.label}>
              {group.commands.map((command) => <RibbonTool key={command.id} label={command.label}
                active={activeTool === command.id} disabled={command.disabled}
                title={command.disabled ? `${command.label} · Unavailable in this concept` : command.label}
                aria-label={command.label} data-icon-only={command.iconOnly || undefined}
                icon={<AetherIcon name={command.icon} />} onClick={() => chooseCommand(command.id, command.label)} />)}
              {overflow.length && groupIndex === groups.length - 1 ? <button className="animation-ribbon-more" type="button" aria-label={`More ${section.label} tools`} aria-expanded={palette?.section.label === section.label} onClick={(event) => openPalette(event, section, overflow)}><AetherIcon name="chevron" /></button> : null}
            </RibbonGroup>);
          })}
        </Ribbon>}
      </div>
      <IconButton className="animation-ribbon-scroll-button animation-ribbon-scroll-button--right" label="Scroll tools right" onClick={() => scroll(1)}><AetherIcon name="chevron" /></IconButton>
      <IconButton className="animation-toolbar-settings-button" label="Tool bar density and shape" aria-expanded={Boolean(settingsAnchor)} onClick={(event) => setSettingsAnchor((current) => current ? null : event.currentTarget)}><AetherIcon name="more-circle" /></IconButton>
    </div>
    <Popover open={Boolean(settingsAnchor)} anchor={settingsAnchor} onClose={() => setSettingsAnchor(null)} ariaLabel="Tool bar density and shape" placement="bottom-end" className="animation-toolbar-settings-popover">
      <strong className="animation-toolbar-settings-caption">DENSITY</strong>
      {densityOptions.map((option) => <SettingRow key={option.id} selected={density === option.id} label={option.label} detail={option.detail} icon={option.icon} onClick={() => setDensity(option.id)} />)}
      <hr />
      <strong className="animation-toolbar-settings-caption">SHAPE</strong>
      {shapeOptions.map((option) => <SettingRow key={option.id} selected={shape === option.id} label={option.label} detail={option.detail} icon="window" onClick={() => setShape(option.id)} />)}
    </Popover>
    <Popover open={Boolean(palette)} anchor={palette?.anchor ?? null} onClose={() => setPalette(null)} ariaLabel={`${palette?.section.label ?? "Tool"} tools`} placement="bottom-start" className="animation-toolbar-palette-popover">
      <header><strong>{palette?.section.label.toUpperCase()}</strong><AetherIcon name={palette?.section.commands[0]?.icon ?? "apps"} /></header>
      {palette ? <ToolPalette commands={palette.commands} activeTool={activeTool} onCommand={chooseCommand} /> : null}
    </Popover>
  </div>;
}

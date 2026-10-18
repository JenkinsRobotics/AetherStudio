import { useState } from "react";
import { AetherIcon, EmptyState, StylePropertiesPanel, type StylePropertiesValue } from "../src/index";
import { AppearanceInspector } from "../src/AppearanceInspector";
import { INITIAL_STYLE, previewStyle } from "./PropertiesPanelDemo";
import { useReferenceTreePanel } from "./TreePanelDemo";
import "./SidebarWidgetPanels.css";

const ROUND_PART: StylePropertiesValue = { ...INITIAL_STYLE, width: 140, height: 140, corners: [70, 70, 70, 70], fill: { enabled: true, color: "#6659d4", opacity: 100 } };
const defaultStyle = (id: string) => id === "result-2" ? ROUND_PART : INITIAL_STYLE;

/** Gallery composition only: reference CAD items share sample style edits across tabs. */
export function useSidebarWidgetPanels() {
  const { content: tree, selectedNode } = useReferenceTreePanel("result-1");
  const [styles, setStyles] = useState<Record<string, StylePropertiesValue>>({});
  const item = selectedNode && ["body", "sketch", "part"].includes(selectedNode.category ?? "") ? selectedNode : undefined;
  const value = item ? styles[item.id] ?? defaultStyle(item.id) : undefined;
  const update = (next: StylePropertiesValue) => { if (item) setStyles(old => ({ ...old, [item.id]: next })); };
  const chooseItem = <EmptyState title="Select an item" description="Choose a body, sketch or part in Layers to edit its appearance and properties." />;
  const scale = value ? Math.min(1, 220 / value.width, 220 / value.height) : 1;
  const preview = <figure className="sidebar-widget-preview" aria-label="Selected item preview">
    <div className="sidebar-widget-preview-stage">
      {item && value && !item.dimmed ? <div style={{ width: value.width * scale, height: value.height * scale, transform: `rotate(${value.rotation}deg)` }}>
        <div data-testid="sidebar-preview-shape" style={{ ...previewStyle(value), transform: `scale(${scale})`, transformOrigin: "top left" }} />
      </div> : <AetherIcon name={item ? "hidden" : "collection-folder"} width={48} height={48} />}
    </div>
    <figcaption><strong>{selectedNode?.label ?? "Choose a feature or part"}</strong><span>{item && value ? `${item.dimmed ? "Hidden · " : ""}${value.width} × ${value.height} px · widget preview` : "Select an item to preview it"}</span></figcaption>
  </figure>;

  return { preview, panels: [
    { id: "structure", title: "Layers", icon: <AetherIcon name="layers" />, collection: true,
      content: <div className="sidebar-widget-tree">{tree}</div> },
    { id: "appearance", title: "Appearance", icon: <AetherIcon name="appearance" />, chromeless: true, content: item && value ? <div className="sidebar-widget-editor">
      <strong className="sidebar-widget-selection">{item.label}</strong>
      <AppearanceInspector value={{ color: value.fill.color, opacity: value.fill.opacity, tessellation: "auto" }} showTessellation={false}
        onChange={appearance => update({ ...value, fill: { enabled: true, color: appearance.color, opacity: appearance.opacity } })} />
    </div> : chooseItem },
    { id: "inspector", title: "Inspector", icon: <AetherIcon name="sliders" />, chromeless: true, content: item && value
      ? <StylePropertiesPanel selectionLabel={item.label} value={value} onChange={update} onReset={() => update(defaultStyle(item.id))} /> : chooseItem },
  ] };
}

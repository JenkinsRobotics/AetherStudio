import { useId, useState, type ReactNode } from "react";
import { Inspector } from "./Inspector";
import { FieldRow } from "./FieldRow";
import { AetherIcon } from "./AetherIcon";
import { IconButton } from "./IconButton";
import { NumberField } from "./NumberField";
import { ColorField } from "./ColorField";
import { SelectField } from "./SelectField";
import { Slider } from "./Slider";
import { Checkbox } from "./Checkbox";
import "./StylePropertiesPanel.css";

/** Presentation values in CSS pixels, degrees and percent. The owning app
 * translates them to its document model; the inspector never owns geometry. */
export interface StylePropertiesValue {
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  corners: [number, number, number, number]; // clockwise from top left
  fill: { enabled: boolean; color: string; opacity: number };
  border: { enabled: boolean; color: string; width: number; style: "solid" | "dashed" | "dotted" };
  shadow: { enabled: boolean; color: string; opacity: number; x: number; y: number; blur: number; spread: number };
}
export interface StylePropertiesPanelProps {
  value: StylePropertiesValue;
  onChange: (value: StylePropertiesValue) => void;
  selectionLabel?: string;
  onReset?: () => void;
  className?: string;
}
function Section({ title, children, enabled, onEnabled, action }: {
  title: string; children: ReactNode; enabled?: boolean; onEnabled?: (enabled: boolean) => void; action?: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const id = useId();
  return <section className="aui-style-section">
    <header><button type="button" className="aui-style-section-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      <AetherIcon name={open ? "chevron-down" : "chevron-right"}/>{title}
    </button>{action}{onEnabled && <Checkbox label="" aria-label={`Enable ${title.toLowerCase()}`} checked={enabled} onChange={e => onEnabled(e.target.checked)}/>}</header>
    <div id={id} hidden={!open}><fieldset disabled={enabled === false}>{children}</fieldset></div>
  </section>;
}
function Numeric({ label, value, onChange, min, max, unit = "px" }: {
  label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; unit?: string;
}) {
  return <FieldRow label={label}><NumberField aria-label={label} value={value} min={min} max={max} unit={unit} onCommit={onChange}/></FieldRow>;
}
export function StylePropertiesPanel({ value: v, onChange, selectionLabel = "Rectangle", onReset, className = "" }: StylePropertiesPanelProps) {
  const [linked, setLinked] = useState(true);
  const update = (patch: Partial<StylePropertiesValue>) => onChange({ ...v, ...patch });
  const radius = (index: number, next: number) => update({ corners: linked ? [next, next, next, next] : v.corners.map((n, i) => i === index ? next : n) as StylePropertiesValue["corners"] });
  return <Inspector><aside className={`aui-style-properties ${className}`} aria-label="Style properties">
    <header className="aui-style-heading"><div><strong>{selectionLabel}</strong></div>{onReset && <IconButton label="Reset properties" onClick={onReset}><AetherIcon name="refresh"/></IconButton>}</header>
    <Section title="Layout">
      <div className="aui-style-pair"><Numeric label="Width" value={v.width} min={1} max={2000} onChange={width => update({width})}/><Numeric label="Height" value={v.height} min={1} max={2000} onChange={height => update({height})}/></div>
      <div className="aui-style-pair"><Numeric label="Rotation" value={v.rotation} min={-360} max={360} unit="°" onChange={rotation => update({rotation})}/><Numeric label="Layer opacity" value={v.opacity} min={0} max={100} unit="%" onChange={opacity => update({opacity})}/></div>
    </Section>
    <Section title="Corners" action={<IconButton label="Link corner radii" aria-pressed={linked} onClick={() => setLinked(!linked)}><AetherIcon name="link"/></IconButton>}>
      <div className="aui-style-corners">{["Top left", "Top right", "Bottom left", "Bottom right"].map((label, position) => {
        const index = [0, 1, 3, 2][position];
        return <label key={label}><span className={`aui-style-corner-glyph corner-${index}`} aria-hidden/><NumberField aria-label={`${label} radius`} value={v.corners[index]} min={0} max={1000} unit="px" onCommit={n => radius(index, n)}/></label>;
      })}</div><small>{linked ? "All corners change together" : "Adjust each corner independently"}</small>
    </Section>
    <Section title="Fill" enabled={v.fill.enabled} onEnabled={enabled => update({fill:{...v.fill, enabled}})}>
      <FieldRow label="Color"><ColorField ariaLabel="Fill color" value={v.fill.color} onChange={color => update({fill:{...v.fill, color}})}/></FieldRow>
      <FieldRow label="Opacity"><Slider ariaLabel="Fill opacity" value={v.fill.opacity} unit="%" onChange={opacity => update({fill:{...v.fill, opacity}})}/></FieldRow>
    </Section>
    <Section title="Border" enabled={v.border.enabled} onEnabled={enabled => update({border:{...v.border, enabled}})}>
      <FieldRow label="Color"><ColorField ariaLabel="Border color" value={v.border.color} onChange={color => update({border:{...v.border, color}})}/></FieldRow>
      <div className="aui-style-pair"><Numeric label="Thickness" value={v.border.width} min={0} max={100} onChange={width => update({border:{...v.border, width}})}/><FieldRow label="Style"><SelectField aria-label="Border style" value={v.border.style} options={[{value:"solid",label:"Solid"},{value:"dashed",label:"Dashed"},{value:"dotted",label:"Dotted"}]} onChange={e => update({border:{...v.border, style:e.target.value as StylePropertiesValue["border"]["style"]}})}/></FieldRow></div>
    </Section>
    <Section title="Shadow" enabled={v.shadow.enabled} onEnabled={enabled => update({shadow:{...v.shadow, enabled}})}>
      <FieldRow label="Color"><ColorField ariaLabel="Shadow color" value={v.shadow.color} onChange={color => update({shadow:{...v.shadow, color}})}/></FieldRow>
      <FieldRow label="Opacity"><Slider ariaLabel="Shadow opacity" value={v.shadow.opacity} unit="%" onChange={opacity => update({shadow:{...v.shadow, opacity}})}/></FieldRow>
      <div className="aui-style-pair"><Numeric label="Offset X" value={v.shadow.x} min={-200} max={200} onChange={x => update({shadow:{...v.shadow, x}})}/><Numeric label="Offset Y" value={v.shadow.y} min={-200} max={200} onChange={y => update({shadow:{...v.shadow, y}})}/></div>
      <div className="aui-style-pair"><Numeric label="Blur" value={v.shadow.blur} min={0} max={200} onChange={blur => update({shadow:{...v.shadow, blur}})}/><Numeric label="Spread" value={v.shadow.spread} min={-100} max={100} onChange={spread => update({shadow:{...v.shadow, spread}})}/></div>
    </Section>
    <footer><AetherIcon name="check"/><span>Changes apply to the selection</span></footer>
  </aside></Inspector>;
}

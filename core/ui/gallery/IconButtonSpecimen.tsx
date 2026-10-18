import { useState } from "react";
import { AetherIcon, IconButton, type IconButtonSize } from "../src/index";
import "./IconButtonSpecimen.css";
import { ElementSpec } from "./showcase/ElementSpec";

const treatments = [
  { appearance: "glyph", label: "Glyph", caption: "Icon color" },
  { appearance: "rounded", label: "Rounded", caption: "Rounded fill" },
  { appearance: "cell", label: "Full cell", caption: "Full-cell fill" },
] as const;

function ActiveExample({ size, appearance, label, caption }: { size: IconButtonSize } & typeof treatments[number]) {
  const [active, setActive] = useState(true);
  const name = `${size[0].toUpperCase()}${size.slice(1)} ${label}`;
  return <figure className="icon-active-example">
    <IconButton label={`${name} Model`} size={size} appearance={appearance} aria-pressed={active} onClick={() => setActive(!active)}><AetherIcon name="cube-transparent" /></IconButton>
    <figcaption>{caption}</figcaption>
  </figure>;
}

function StandardButtons() {
  const [selected, setSelected] = useState<string | null>("cube-transparent");
  return <div role="group" aria-label="Standard icon buttons" style={{ display: "flex", gap: 4 }}>
    {([["image", "Image"], ["cube-transparent", "Model"], ["link", "Link"]] as const).map(([icon, label]) => <IconButton key={icon} label={`Standard ${label}`} size="medium"
      aria-pressed={selected === icon} onClick={() => setSelected(selected === icon ? null : icon)}><AetherIcon name={icon} /></IconButton>)}
    <IconButton label="Standard Delete unavailable" size="medium" disabled><AetherIcon name="delete" /></IconButton>
  </div>;
}

export function IconButtonSpecimen() {
  return <div className="icon-button-specimen"><ElementSpec summary="One borderless resting look. Three active treatments: icon color, rounded fill or full-cell fill. Three approved sizes: Small, Medium and Large."
    standard={<StandardButtons />}
    states={<IconButton label="Save" size="medium"><AetherIcon name="save" /></IconButton>}
    variants={[
      ...([
        { size: "small", label: "Small", note: "28 px button · 20 px icon. Compact document toolbar." },
        { size: "medium", label: "Medium", note: "36 px button · 20 px icon. Standard sidebar tabs." },
        { size: "large", label: "Large", note: "40 px button · 24 px icon. Floating command toolbar." },
      ] as const).map(({ size, label, note }) => ({ label, note, node: <div className="icon-active-examples" role="group" aria-label={`${label} active treatments`}>
        {treatments.map(treatment => <ActiveExample key={treatment.appearance} size={size} {...treatment} />)}
      </div> })),
      { label: "Disabled", node: <IconButton label="Delete" size="medium" disabled><AetherIcon name="delete" /></IconButton> },
    ]}
    configuration={<div style={{ display: "flex", gap: 4 }}>{(["undo", "redo", "save"] as const).map(name => <IconButton key={name} label={name} size="small"><AetherIcon name={name} /></IconButton>)}</div>}
    rules={["Every icon rests without a border or box. Rounded is the default active treatment.", "Click an active example to turn it off and compare the shared resting look.", "Small: compact toolbar. Medium: sidebar. Large: command toolbar.", "Touch targets remain at least 44 px. Keyboard focus stays visible.", "Use shared system glyphs, never emoji."]} /></div>;
}

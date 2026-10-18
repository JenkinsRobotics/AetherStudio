import type { CSSProperties } from "react";
import { Button } from "./Button";
import "./ConceptWidgets.css";

export interface MaterialChannel { id: string; label: string; value: number; }
export interface MaterialEditorProps { name: string; color: string; type: string; channels: readonly MaterialChannel[]; onNameChange?: (name: string) => void; onColorChange?: (color: string) => void; onChannelChange?: (id: string, value: number) => void; onAssign?: () => void; }

export function MaterialEditor({ name, color, type, channels, onNameChange, onColorChange, onChannelChange, onAssign }: MaterialEditorProps) {
  return <section className="aui-material-editor" aria-label="Material editor">
    <div className="aui-material-editor__preview"><span className="aui-material-editor__sphere" style={{ "--material-color": color } as CSSProperties} /><div className="aui-material-editor__identity"><input aria-label="Material name" value={name} onChange={(event) => onNameChange?.(event.target.value)} /><select aria-label="Material type" defaultValue={type}><option>{type}</option></select><label className="aui-material-editor__color"><input aria-label="Material color" type="color" value={color} onChange={(event) => onColorChange?.(event.target.value)} />{color.toUpperCase()}</label></div></div>
    <div>{channels.map((channel) => <label className="aui-material-editor__channel" key={channel.id}><span>{channel.label}</span><input aria-label={channel.label} type="range" min="0" max="1" step="0.01" value={channel.value} onChange={(event) => onChannelChange?.(channel.id, Number(event.target.value))} /><output>{channel.value.toFixed(2)}</output></label>)}</div>
    <div className="aui-material-editor__actions"><Button>Node Editor</Button><Button primary onClick={onAssign}>Assign</Button></div>
  </section>;
}

import { Button } from './Button';
import { ColorField } from './ColorField';
import { FieldRow } from './FieldRow';
import { NumberField } from './NumberField';
import './GradientControls.css';

/** Controlled presentation contract; products own paint validation and storage. */
export interface GradientControlsProps {
  value: { kind: 'linear' | 'radial'; angleDeg: number; stops: { offset: number; color: string; opacity: number }[] };
  onChange: (value: GradientControlsProps['value']) => void;
  disabled?: boolean;
}
export function GradientControls({ value, onChange, disabled }: GradientControlsProps) {
  const stops = (next: GradientControlsProps['value']['stops']) => onChange({ ...value, stops: next });
  return <fieldset className="aui-gradient-controls" disabled={disabled}>
    <legend>Gradient</legend>
    {value.kind === 'linear' && <FieldRow label="Angle"><NumberField disabled={disabled} aria-label="Gradient angle" value={value.angleDeg} min={-360} max={360} unit="°" onCommit={angleDeg => onChange({ ...value, angleDeg })} /></FieldRow>}
    {value.stops.map((stop, index) => <fieldset className="aui-gradient-stop" key={index}>
      <legend>Stop {index + 1}</legend>
      <ColorField disabled={disabled} ariaLabel={`Stop ${index + 1} color`} value={stop.color} onChange={color => stops(value.stops.map((s, i) => i === index ? { ...s, color } : s))} />
      <FieldRow label="Position"><NumberField disabled={disabled} aria-label={`Stop ${index + 1} position`} value={stop.offset * 100} min={0} max={100} unit="%" onCommit={offset => stops(value.stops.map((s, i) => i === index ? { ...s, offset: offset / 100 } : s).sort((a, b) => a.offset - b.offset))} /></FieldRow>
      <FieldRow label="Opacity"><NumberField disabled={disabled} aria-label={`Stop ${index + 1} opacity`} value={stop.opacity * 100} min={0} max={100} unit="%" onCommit={opacity => stops(value.stops.map((s, i) => i === index ? { ...s, opacity: opacity / 100 } : s))} /></FieldRow>
      <Button disabled={disabled || value.stops.length <= 2} onClick={() => stops(value.stops.filter((_, i) => i !== index))}>Remove stop {index + 1}</Button>
    </fieldset>)}
    <Button disabled={disabled || value.stops.length >= 16} onClick={() => stops([...value.stops, { offset: .5, color: value.stops[0].color, opacity: 1 }].sort((a, b) => a.offset - b.offset))}>Add gradient stop</Button>
  </fieldset>;
}

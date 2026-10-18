import { useState } from 'react';
import { AetherIcon, Checkbox, ParameterRow } from '../src';

function Example({ title, initial }: { title: string; initial: number }) {
  const [opacity, setOpacity] = useState(initial), [speed, setSpeed] = useState(2);
  const [disabled, setDisabled] = useState(false), [assigned, setAssigned] = useState(true);
  const [editing, setEditing] = useState(false);
  return <section aria-label={title} style={{ width: 310, display: 'grid', gap: 8, alignContent: 'start' }}>
    <strong>{title} · shared parameter controls</strong>
    <Checkbox label={`Disable ${title} controls`} checked={disabled} onChange={event => setDisabled(event.target.checked)} />
    <ParameterRow label="Opacity" icon={<AetherIcon name="lighting" />} value={opacity} onChange={setOpacity}
      min={0} max={100} sliderRange={{ min: 0, max: 100 }} unit="%" disabled={disabled} />
    <ParameterRow label="Speed" icon={<AetherIcon name="history" />} value={speed} onChange={setSpeed} min={0} step={.05}
      sliderRange={{ min: 0, max: 5 }} disabled={disabled}
      modulation={assigned ? { label: 'LFO 3', range: { min: 1, max: 4 }, onEdit: () => setEditing(!editing) } : undefined} />
    <Checkbox label={`Assign ${title} modulation`} checked={assigned} onChange={event => setAssigned(event.target.checked)} />
    {editing && <p role="status">The product opens its modulation editor here. Range markers describe the assigned limits.</p>}
  </section>;
}

export function ParameterRowDemo() { return <><Example title="Surface" initial={75} /><Example title="Lighting" initial={45} /></>; }

import { useState } from 'react';
import { Checkbox, GradientControls, SelectField, type GradientControlsProps } from '../src';
function Example({ radial }: { radial: boolean }) {
  const [disabled, setDisabled] = useState(false);
  const [value, setValue] = useState<GradientControlsProps['value']>({ kind: radial ? 'radial' : 'linear', angleDeg: 45, stops: [
    { offset: 0, color: radial ? '#ff9533' : '#ed408a', opacity: 1 },
    { offset: 1, color: radial ? '#572caa' : '#239bff', opacity: 1 },
  ] });
  return <section aria-label={radial ? 'Radial gradient example' : 'Linear gradient example'} style={{ width: 270, padding: 12, display: 'grid', gap: 10, alignContent: 'start' }}>
    <strong>Vector paint · {radial ? 'Radial' : 'Linear'}</strong>
    <Checkbox label="Disable gradient controls" checked={disabled} onChange={e => setDisabled(e.target.checked)} />
    <SelectField aria-label="Gradient type" value={value.kind} options={[{ value: 'linear', label: 'Linear' }, { value: 'radial', label: 'Radial' }]} onChange={e => setValue({ ...value, kind: e.target.value as 'linear' | 'radial' })} />
    <GradientControls value={value} onChange={setValue} disabled={disabled} />
  </section>;
}
export function GradientControlsDemo() { return <><Example radial={false} /><Example radial /></>; }

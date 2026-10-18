import { useContext, useId, useState, type ReactNode } from 'react';
import { InspectorContext } from './InspectorContext';
import { NumberField } from './NumberField';
import { Slider } from './Slider';
import './ParameterRow.css';

export interface ParameterRowProps {
  label: string;
  ariaLabel?: string;
  icon?: ReactNode;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** Suggested slider interval; numeric entry may extend beyond it within min/max. */
  sliderRange?: { min: number; max: number };
  help?: string;
  disabled?: boolean;
  modulation?: { label: string; onEdit: () => void; range?: { min: number; max: number } };
}

/** A shared inspector row. Products supply meaning, limits and assignment actions. */
export function ParameterRow({ label, ariaLabel = label, icon, value, onChange, min, max, step = 1, unit = '', sliderRange, help, disabled, modulation }: ParameterRowProps) {
  const id = useId();
  const inspector = useContext(InspectorContext);
  const [showHelp, setShowHelp] = useState(false);
  const labelElement = <label htmlFor={id} className="aui-parameter-label" title={label}>
    {icon && <span aria-hidden className="aui-parameter-icon">{icon}</span>}<span>{label}</span>
  </label>;
  return <div className="aui-parameter" data-modulated={modulation ? true : undefined} data-disabled={disabled || undefined}>
    <div className="aui-parameter-row">
      {inspector && help ? <div className="aui-inspector-parameter-heading">{labelElement}
        <button type="button" className="aui-inspector-info" aria-label={`About ${ariaLabel}`}
          aria-expanded={showHelp} aria-controls={`${id}-help`} onClick={() => setShowHelp(value => !value)}>i</button>
      </div> : labelElement}
      {sliderRange && <Slider ariaLabel={ariaLabel} value={value} min={Math.min(sliderRange.min, value)} max={Math.max(sliderRange.max, value)}
        step={step} unit={unit} showValue={false} disabled={disabled} onChange={onChange} range={modulation?.range} />}
      <span className="aui-parameter-entry"><NumberField id={id} className="aui-parameter-value" aria-label={ariaLabel} aria-describedby={help ? `${id}-help` : undefined}
        value={value} min={min} max={max} step={step} unit={unit} disabled={disabled} onValueChange={next => next !== null && onChange(next)} /></span>
    </div>
    {modulation && <button type="button" className="aui-parameter-assignment" disabled={disabled}
      aria-label={`Edit ${ariaLabel} modulation`} onClick={modulation.onEdit}>{modulation.label}</button>}
    {help && <p id={`${id}-help`} className="aui-parameter-help" hidden={inspector && !showHelp}>{help}</p>}
  </div>;
}

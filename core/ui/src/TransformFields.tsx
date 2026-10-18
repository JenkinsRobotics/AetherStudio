import { AetherIcon } from './AetherIcon';
import { IconButton } from './IconButton';
import { NumberField } from './NumberField';
import './TransformFields.css';
export interface TransformFieldsProps {
  label: string; values: readonly number[]; unit?: string; disabled?: boolean;
  min?: number; max?: number; step?: number; locked?: readonly boolean[];
  onCommit: (axis: number, value: number) => void;
  onToggleLock?: (axis: number) => void;
}
/** Unframed vector editor. Units, constraints and edit transactions belong to the caller. */
export function TransformFields({ label, values, unit, disabled, min, max, step, locked, onCommit, onToggleLock }: TransformFieldsProps) {
  return <section className="aui-transform-fields" aria-label={label}><h3>{label}</h3>
    {['X', 'Y', 'Z'].map((axis, index) => <div className="aui-transform-axis" key={axis}>
      <span>{axis}</span><NumberField aria-label={`${label} ${axis}`} value={values[index] ?? 0} unit={unit} min={min} max={max} step={step}
        disabled={disabled || locked?.[index]} onCommit={value => onCommit(index, value)}/>
      {onToggleLock && <IconButton label={`${locked?.[index] ? 'Unlock' : 'Lock'} ${label} ${axis}`} appearance="glyph" size="small" disabled={disabled} aria-pressed={!!locked?.[index]} onClick={() => onToggleLock(index)}><AetherIcon name={locked?.[index] ? 'lock' : 'unlock'}/></IconButton>}
    </div>)}
  </section>;
}

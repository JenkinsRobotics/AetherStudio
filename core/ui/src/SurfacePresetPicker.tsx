import { MaterialSwatch } from './MaterialSwatch';
import './SurfacePresetPicker.css';
export interface SurfacePreset { id: string; name: string; color: string; roughness?: number; metalness?: number; }
/** Content only; hosts provide the sidebar, popover or floating-panel container. */
export function SurfacePresetPicker({ presets, selectedId, disabled, onSelect }: {
  presets: readonly SurfacePreset[]; selectedId?: string; disabled?: boolean; onSelect: (id: string) => void;
}) {
  return <div className="aui-surface-presets" role="group" aria-label="Surface presets">{presets.map(preset =>
    <button key={preset.id} type="button" aria-label={`Apply ${preset.name}`} aria-pressed={preset.id === selectedId} disabled={disabled} onClick={() => onSelect(preset.id)}>
      <MaterialSwatch color={preset.color} size="large" roughness={preset.roughness}/><span>{preset.name}</span>
    </button>)}</div>;
}

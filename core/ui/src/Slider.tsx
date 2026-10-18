import { useState } from "react";
import type { CSSProperties } from "react";
import './Slider.css';

export interface SliderProps {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  ariaLabel: string;
  showValue?: boolean;
  disabled?: boolean;
  className?: string;
  /** Read-only markers for an assigned range; the owning editor adjusts its limits. */
  range?: { min: number; max: number };
}

export function Slider({ value, defaultValue, onChange, min = 0, max = 100, step = 1, unit = "", ariaLabel, showValue = true, disabled = false, className, range }: SliderProps) {
  const [internal, setInternal] = useState(defaultValue ?? min);
  const current = value ?? internal;
  const update = (next: number) => {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  };
  const percent = max === min ? 0 : Math.max(0, Math.min(100, (current - min) / (max - min) * 100));
  return <div className={["aui-slider aui-slider-control", className].filter(Boolean).join(" ")} style={{ "--aui-slider-fill": `${percent}%` } as CSSProperties}>
    <span className="aui-slider-track">
    <input type="range" aria-label={ariaLabel} aria-valuetext={`${current}${unit}`} value={current} min={min} max={max} step={step} disabled={disabled} onChange={(event) => update(Number(event.target.value))} />
    {range && [range.min, range.max].map((limit, index) => <span key={index} aria-hidden className="aui-slider-range-mark"
      style={{ left: `${max === min ? 0 : Math.max(0, Math.min(100, (limit - min) / (max - min) * 100))}%` }} />)}
    </span>
    {showValue ? <output>{current.toLocaleString()}{unit}</output> : null}
  </div>;
}

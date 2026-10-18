import { useId, type ReactNode } from "react";
import { Button } from "./Button";
import "./ThumbnailPicker.css";

export interface ThumbnailOption { id: string; label: string; detail?: string; preview: ReactNode; disabled?: boolean; }
/** A controlled visual collection. Selection has native button and pressed semantics. */
export function ThumbnailPicker({ label, items, value, onChange }: { label: string; items: readonly ThumbnailOption[]; value: string; onChange: (id: string) => void }) {
  const id = useId();
  return <section className="aui-thumbnail-picker" aria-labelledby={id}>
    <h3 id={id}>{label}</h3><div className="aui-thumbnail-picker__grid">{items.map(item => <Button key={item.id} appearance="flat" active={value === item.id} aria-label={item.label} aria-pressed={value === item.id} disabled={item.disabled} onClick={() => onChange(item.id)}>
      <span className="aui-thumbnail-picker__preview" aria-hidden="true">{item.preview}</span><span className="aui-thumbnail-picker__label">{item.label}</span>{item.detail && <small>{item.detail}</small>}
    </Button>)}</div>
  </section>;
}

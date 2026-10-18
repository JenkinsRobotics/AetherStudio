import { useContext, useId, type ReactNode } from 'react';
import { InspectorContext } from './InspectorContext';
import './Inspector.css';

export interface InspectorProps {
  children: ReactNode;
  className?: string;
}

/** Compact property sheet. Nested FieldRows inherit inline labels; other forms keep their layout. */
export function Inspector({ children, className }: InspectorProps) {
  const nested = useContext(InspectorContext);
  // Reusable property sheets can also be rendered alone without adding nested padding.
  if (nested) return className ? <div className={className}>{children}</div> : <>{children}</>;
  return <InspectorContext.Provider value={true}>
    <div className={['aui-inspector', className].filter(Boolean).join(' ')}>{children}</div>
  </InspectorContext.Provider>;
}

export interface InspectorSectionProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  /** Omit for a static section; supply to make it a disclosure. */
  defaultOpen?: boolean;
}

export function InspectorSection({ title, children, actions, defaultOpen }: InspectorSectionProps) {
  const id = useId();
  const body = <div className="aui-inspector-section-body">{children}</div>;
  return defaultOpen === undefined
    ? <section className="aui-inspector-section" aria-labelledby={id}>
      <div className="aui-inspector-section-heading"><h3 id={id}>{title}</h3>{actions}</div>{body}
    </section>
    : <details className="aui-inspector-section" open={defaultOpen}>
      <summary className="aui-inspector-section-heading">{title}</summary>{body}
    </details>;
}

/** Related actions share a row and wrap instead of stretching into separate large buttons. */
export function InspectorActions({ children, label }: { children: ReactNode; label?: string }) {
  return <div className="aui-inspector-actions" role={label ? 'group' : undefined} aria-label={label}>{children}</div>;
}

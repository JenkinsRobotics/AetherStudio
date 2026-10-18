import type { ReactNode } from "react";

export interface ElementVariant { label: string; note?: string; node: ReactNode }

/**
 * One element's standard (Jonathan, 2026-10-13): the standard form, the
 * variations allowed, and the element in its standard configuration (labelled,
 * in a field row or group). Elements are atoms; anything composed of several
 * belongs on the Widgets tab.
 */
export function ElementSpec({ summary, standard, states = standard, variants = [], configuration, rules = [] }: {
  summary: string;
  standard: ReactNode;
  /** Sample shown at rest, hover and focus; false for non-interactive elements. */
  states?: ReactNode | false;
  variants?: readonly ElementVariant[];
  configuration?: ReactNode;
  rules?: readonly string[];
}) {
  // One compact card (Jonathan, 2026-10-14): every form side by side, no stage per element.
  return <article className="element-spec">
    <p className="element-spec-summary">{summary}</p>
    <dl className="element-spec-rows">
      <dt>Standard</dt><dd aria-label="Standard">{standard}</dd>
      {states !== false && <><dt>States</dt><dd aria-label="States" className="element-spec-states">
        {(["rest", "hover", "focus"] as const).map((state) => <figure key={state} data-element-state={state} inert><div>{states}</div><figcaption>{state[0].toUpperCase() + state.slice(1)}</figcaption></figure>)}
      </dd></>}
      {variants.map((variant) => <Row key={variant.label} label={variant.label} note={variant.note}>{variant.node}</Row>)}
      {configuration && <><dt>In a form</dt><dd aria-label="Standard configuration">{configuration}</dd></>}
    </dl>
    {rules.length > 0 && <ul className="element-spec-rules" aria-label="Usage">{rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>}
  </article>;
}

function Row({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return <><dt title={note}>{label}{note && <small>{note}</small>}</dt><dd aria-label={label}>{children}</dd></>;
}

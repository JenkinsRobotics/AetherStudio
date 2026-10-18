import { useContext, useId, useState, type ReactNode } from "react";
import { InspectorContext } from './InspectorContext';
import './Inspector.css';

export interface FieldRowProps {
  label: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  modified?: boolean;
  required?: boolean;
  onReset?: () => void;
  className?: string;
  /** Inspector inherits inline; standalone forms retain stacked labels. */
  layout?: 'inline' | 'stacked';
}

/** Standard property-editor row. The application supplies the editor and owns
 * transactions; FieldRow owns consistent labeling, help, error, and reset UI. */
export function FieldRow({
  label,
  htmlFor,
  children,
  help,
  error,
  modified,
  required,
  onReset,
  className,
  layout,
}: FieldRowProps) {
  const inspector = useContext(InspectorContext);
  const inline = layout ? layout === 'inline' : inspector;
  const [showHelp, setShowHelp] = useState(false);
  const helpID = useId();
  const classes = ["aui-field-row"];
  if (inline) classes.push('aui-field-row--inline');
  if (layout === 'stacked') classes.push('aui-field-row--stacked');
  if (error) classes.push("aui-field-row--error");
  if (modified) classes.push("aui-field-row--modified");
  if (className) classes.push(className);
  return (
    <div className={classes.join(" ")}>
      <div className="aui-field-row-heading">
        <label htmlFor={htmlFor}>
          {modified ? <span className="aui-field-row-modified" aria-hidden title="Modified">•</span> : null}
          {label}
          {required ? <span aria-hidden> *</span> : null}
        </label>
        {inline && help && !error ? <button type="button" className="aui-inspector-info"
          aria-label={typeof label === 'string' ? `About ${label}` : 'About this setting'}
          aria-expanded={showHelp} aria-controls={helpID} onClick={() => setShowHelp(value => !value)}>i</button> : null}
        {onReset ? <button type="button" onClick={onReset}>Reset</button> : null}
      </div>
      <div className="aui-field-row-editor">{children}</div>
      {error ? <div className="aui-field-row-error" role="alert">{error}</div> : null}
      {!error && help ? <div id={helpID} className="aui-field-row-help" hidden={inline && !showHelp}>{help}</div> : null}
    </div>
  );
}

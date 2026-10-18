import type { ReactNode, SelectHTMLAttributes } from "react";
import { AetherIcon } from "./AetherIcon";

export interface SelectFieldOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectFieldProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: readonly SelectFieldOption[];
  placeholder?: string;
  invalid?: boolean;
  /**
   * A glyph naming what the select filters, drawn in the field's leading edge.
   *
   * It lives here so no panel has to position one itself. The comments filters
   * did, with an absolutely placed icon and a hand-counted left padding, and at
   * sidebar width the field shrank until the icon sat on top of the text
   * (Jonathan, 2026-10-04: "the icon is behind the text"). The field now
   * reserves the space in its own layout, so it cannot be squeezed away.
   */
  icon?: ReactNode;
}

/** Native select semantics with the shared Aether field presentation. */
export function SelectField({
  options,
  placeholder,
  invalid,
  icon,
  className,
  ...selectProps
}: SelectFieldProps) {
  const classes = ["aui-select-field"];
  if (invalid) classes.push("aui-select-field--invalid");
  if (className) classes.push(className);
  return (
    <span className="aui-select-field-wrap" data-icon={icon ? "" : undefined}>
      {icon ? <span className="aui-select-field-icon" aria-hidden="true">{icon}</span> : null}
      <select
        {...selectProps}
        className={classes.join(" ")}
        aria-invalid={invalid || undefined}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="aui-select-field-arrow" aria-hidden><AetherIcon name="chevron-down" /></span>
    </span>
  );
}

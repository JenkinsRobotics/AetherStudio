import type { ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accent-filled call-to-action variant. */
  primary?: boolean;
  /** Pressed/latched state (e.g. an armed tool). */
  active?: boolean;
  /** Standard, soft filled, or text-only action. */
  appearance?: "standard" | "flat" | "link";
}

/** The standard Aether push button. */
export function Button({ primary, active, appearance = "standard", className, ...rest }: ButtonProps) {
  const classes = ["aui-button"];
  if (primary) classes.push("aui-button--primary");
  if (active) classes.push("aui-button--active");
  if (appearance !== "standard") classes.push(`aui-button--${appearance}`);
  if (className) classes.push(className);
  return <button type="button" className={classes.join(" ")} {...rest} />;
}

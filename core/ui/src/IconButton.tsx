import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./IconButton.css";

export type IconButtonSize = "small" | "medium" | "large";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name; rendered as title + aria-label. */
  label: string;
  /** Active treatment. Rounded is standard; "default" and retired "plain" are compatibility inputs that render rounded. */
  appearance?: "default" | "plain" | "rounded" | "cell" | "glyph";
  /** Desktop standard: small 28px, medium 36px, large 40px. Omit to retain host defaults. */
  size?: IconButtonSize;
  children: ReactNode;
}

/** A rounded icon command with a quiet resting surface and filled selection. */
export function IconButton({ label, children, className, appearance = "rounded", size, ...rest }: IconButtonProps) {
  const classes = ["aui-icon-button"];
  if (className) classes.push(className);
  return (
    <button
      type="button"
      className={classes.join(" ")}
      data-appearance={appearance === "glyph" || appearance === "cell" ? appearance : "rounded"}
      data-size={size}
      title={label}
      aria-label={label}
      {...rest}
    >
      {children}
    </button>
  );
}

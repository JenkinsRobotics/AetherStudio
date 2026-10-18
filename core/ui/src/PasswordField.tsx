import { useState } from "react";
import { TextField, type TextFieldProps } from "./TextField";
import { IconButton } from "./IconButton";
import { AetherIcon } from "./AetherIcon";
import "./WorkflowElements.css";
export type PasswordFieldProps = Omit<TextFieldProps, "type" | "unit">;
export function PasswordField(props: PasswordFieldProps) {
  const [revealed, setRevealed] = useState(false);
  return <span className="aui-password-field"><TextField {...props} type={revealed ? "text" : "password"} />
    <IconButton appearance="glyph" label={revealed ? "Hide password" : "Show password"} aria-pressed={revealed} disabled={props.disabled} onClick={() => setRevealed(value => !value)}><AetherIcon name={revealed ? "hidden" : "view"} /></IconButton>
  </span>;
}

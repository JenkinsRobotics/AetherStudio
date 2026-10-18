import { useState } from "react";
import { DashboardCard } from "./DashboardCards";
import { TextField } from "./TextField";
import { PasswordField } from "./PasswordField";
import { Checkbox } from "./Checkbox";
import { Button } from "./Button";
import "./WorkflowWidgets.css";
export interface AuthenticationValues { name: string; email: string; password: string; }
export interface AuthenticationFormProps { mode: "login" | "signup"; appName: string; onModeChange: (mode: "login" | "signup") => void; onSubmit: (value: AuthenticationValues) => void; onProvider?: (provider: string) => void; onResetPassword?: () => void; busy?: boolean; }
export function AuthenticationForm({ mode, appName, onModeChange, onSubmit, onProvider, onResetPassword, busy }: AuthenticationFormProps) {
  const [value, setValue] = useState<AuthenticationValues>({ name: "", email: "", password: "" });
  const signup = mode === "signup";
  return <DashboardCard contentOnly density="compact" title={signup ? `Create an ${appName} account` : `Log in to ${appName}`} className="aui-workflow">
    <form className="aui-workflow-stack" onSubmit={event => { event.preventDefault(); onSubmit(value); }}>
      {signup && <label className="aui-workflow-field">Full name<TextField autoComplete="name" required value={value.name} onChange={e => setValue({ ...value, name: e.target.value })} placeholder="First and last name" /></label>}
      <label className="aui-workflow-field">Email<TextField type="email" autoComplete="email" required value={value.email} onChange={e => setValue({ ...value, email: e.target.value })} placeholder="you@company.com" /></label>
      <label className="aui-workflow-field">Password<PasswordField aria-label="Password" autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? 8 : undefined} value={value.password} onChange={e => setValue({ ...value, password: e.target.value })} placeholder={signup ? "At least 8 characters" : "Your password"} /></label>
      {signup ? <Checkbox required label="I agree to the privacy policy" /> : onResetPassword && <Button appearance="link" onClick={onResetPassword}>I forgot my password</Button>}
      <Button primary type="submit" disabled={busy}>{busy ? "Please wait…" : signup ? "Create account" : "Log in"}</Button>
      {onProvider && <><div className="aui-workflow-divider">Or {signup ? "sign up" : "log in"} with</div><div className="aui-workflow-actions">{["Google", "LinkedIn"].map(provider => <Button key={provider} onClick={() => onProvider(provider)}>{provider}</Button>)}</div></>}
      <Button appearance="link" onClick={() => onModeChange(signup ? "login" : "signup")}>{signup ? "Have an account? Log in" : "New here? Create account"}</Button>
    </form>
  </DashboardCard>;
}

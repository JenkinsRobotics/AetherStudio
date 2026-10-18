import { DashboardCard } from "./DashboardCards";
import { TextField } from "./TextField";
import { SettingsLink } from "./SettingsLink";
import { Button } from "./Button";
import "./WorkflowWidgets.css";
export interface AccountProfileValue { name: string; company: string; }
export interface AccountProfileProps { value: AccountProfileValue; email: string; onChange: (value: AccountProfileValue) => void; onAction: (action: "api-key" | "email" | "password" | "delete") => void; onSave: () => void; onCancel: () => void; }
export function AccountProfile({ value, email, onChange, onAction, onSave, onCancel }: AccountProfileProps) {
  return <DashboardCard contentOnly density="compact" title="Account settings" className="aui-workflow"><form className="aui-workflow-stack" onSubmit={e => { e.preventDefault(); onSave(); }}>
    <label className="aui-workflow-field">Your full name<TextField required value={value.name} autoComplete="name" onChange={e => onChange({ ...value, name: e.target.value })} /></label>
    <label className="aui-workflow-field">Company name<TextField value={value.company} autoComplete="organization" onChange={e => onChange({ ...value, company: e.target.value })} /></label>
    <div className="aui-workflow-settings"><SettingsLink label="API key" description="Connect with other apps" onClick={() => onAction("api-key")} /><SettingsLink label="Email" description={email} onClick={() => onAction("email")} /><SettingsLink label="Password" description="Update your sign-in password" onClick={() => onAction("password")} /><SettingsLink label="Delete account" description="Permanently remove your account data" destructive onClick={() => onAction("delete")} /></div>
    <div className="aui-workflow-actions"><Button primary type="submit">Update</Button><Button appearance="flat" onClick={onCancel}>Cancel</Button></div>
  </form></DashboardCard>;
}

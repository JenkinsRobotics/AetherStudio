import { useEffect, useState, type FormEvent } from "react";
import { Button, TextField } from "@aether/ui";
import { SignInFrame } from "./SetupWizard";
import { api } from "@aether/session/library/api";

export function Recovery({ token, available, onBack }: { token: string; available: boolean; onBack: () => void }) {
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (location.hash) history.replaceState(null,"",location.pathname+location.search); }, []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();setBusy(true);setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (token) {
        if (values.password !== values.confirm) throw new Error("Passwords do not match.");
        await api("/api/recovery/reset", { token, password: values.password });setDone(true);
      } else {
        const result = await api<{message:string}>("/api/recovery/request", values);setMessage(result.message);
      }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <SignInFrame><form className="auth-card" onSubmit={submit}><span className="setup-eyebrow">ACCOUNT RECOVERY</span><h2>{done ? "Password updated" : token ? "Choose a new password" : "Let’s get you back in"}</h2><p>{done ? "Your old sign-ins have been revoked. Sign in with your new password." : token ? "Your reset link works once and expires after 30 minutes." : "Enter your username or email address. We’ll email your username and a link to choose a new password."}</p>{error && <div role="alert" className="message error">{error}</div>}{message && <div role="status" className="message">{message}</div>}{!done && (token ? <><label className="field"><span>New password</span><TextField name="password" type="password" required minLength={12} maxLength={256} autoComplete="new-password" /></label><label className="field"><span>Confirm new password</span><TextField name="confirm" type="password" required minLength={12} maxLength={256} autoComplete="new-password" /></label><Button primary type="submit" disabled={busy}>Save new password</Button></> : <><label className="field"><span>Username or email</span><TextField name="account" required maxLength={254} autoComplete="username" /></label>{available ? <Button primary type="submit" disabled={busy}>Email recovery link</Button> : <div className="setup-note"><p>Email delivery is not configured on this host yet. Ask an administrator to reset your password. Server owners can also recover access from the local console.</p></div>}</>)}<Button onClick={onBack}>Back to sign in</Button></form></SignInFrame>;
}

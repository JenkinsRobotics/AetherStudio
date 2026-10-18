import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { AppIcon, AetherIcon, Button, Checkbox, TextField } from "@aether/ui";
import artwork from "@aether/assets/branding/studio-setup.svg";
import { api } from "@aether/session/library/api";
import "./setup.css";

export type Installation = {
  setup_authorized?: boolean;
  setup_instructions?: string;
  data_directory?: string | null;
  host_ready: boolean;
  storage_ready: boolean;
  packages: {
    id: string;
    name: string;
    description: string;
    installed: boolean;
  }[];
};
const steps = [
  "Welcome",
  "Workspace",
  "Administrator",
  "Applications",
  "Review",
];
function SetupFrame({
  children,
  step,
  onStep,
}: {
  children: ReactNode;
  step?: number;
  onStep?: (step: number) => void;
}) {
  return (
    <div className="setup-stage">
      <div className="setup-window">
        <aside className="setup-story">
          <div className="setup-wordmark">
            <AppIcon app="studio" size={34} />
            <strong>Aether Studio</strong>
          </div>
          <div className="setup-story-copy">
            <span className="setup-eyebrow">A SPACE TO CREATE</span>
            <h1>
              Your tools.
              <br />
              Your workspace.
              <br />
              <span>Yours to host.</span>
            </h1>
            <p>
              Bring your creative tools together in one place. Open them from a
              browser. Keep your work on your own host.
            </p>
          </div>
          <img
            className="setup-artwork"
            src={artwork}
            alt="A central workspace connected to a desktop and a mobile device"
          />
          <div className="setup-story-footer">
            <span className="setup-dot" /> Locally hosted · Open source
          </div>
        </aside>
        <div className="setup-right">
          {step !== undefined && (
            <nav aria-label="Setup progress" className="setup-progress">
              <ol>
                {steps.map((name, index) => (
                  <li
                    key={name}
                    aria-current={index === step ? "step" : undefined}
                    className={
                      index < step
                        ? "complete"
                        : index === step
                          ? "current"
                          : ""
                    }
                  >
                    <button
                      disabled={index >= step}
                      onClick={() => onStep?.(index)}
                      aria-label={`Step ${index + 1}: ${name}`}
                    >
                      <span>{index < step ? "✓" : index + 1}</span>
                      <small>{name}</small>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
export function SetupWizard({
  installation,
  onComplete,
  refresh,
}: {
  installation: Installation;
  onComplete: () => void;
  refresh: () => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("Aether Studio");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [apps, setApps] = useState(() =>
    installation.packages
      .filter((app) => app.installed && app.id !== "ui")
      .map((app) => app.id),
  );
  const [authorized, setAuthorized] = useState(Boolean(installation.setup_authorized));
  const [authorizing, setAuthorizing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const code = new URLSearchParams(location.hash.slice(1)).get("setup");
    if (code) {
      setAuthorizing(true);
      api("/api/setup/authorize", { token: code }).then(() => {
        setAuthorized(true);
        history.replaceState(null, "", location.pathname + location.search);
      }).catch((e: Error) => setError(e.message)).finally(() => setAuthorizing(false));
    }
  }, []);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  const move = (next: number) => {
    if (!busy) {
      setError("");
      setStep(next);
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (
      step === 0 &&
      (!installation.host_ready || !installation.storage_ready)
    ) {
      setError(
        "The installation is not ready. Run Install Aether Studio again to repair it.",
      );
      return;
    }
    if (step === 2 && !authorized) { setError(installation.setup_instructions ?? "Reopen Aether Studio.app on this host to authorize setup, then refresh this page."); return; }
    if (step === 2 && password !== confirm) {
      setError("Your passwords do not match. Check both fields and try again.");
      return;
    }
    if (step < 4) {
      move(step + 1);
      return;
    }
    setBusy(true);
    try {
      await api("/api/setup", {
        full_name: fullName,
        email,
        name: name.trim(),
        username,
        password,
        apps,
      });
      setCreated(true);
      await api("/api/login", { username, password });
      setPassword("");
      setConfirm("");
      onComplete();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const titles = [
    "Welcome to your Studio",
    "Make this workspace yours",
    "Create your administrator",
    "Choose your applications",
    "Ready to create?",
  ];
  const descriptions = [
    "Installation is complete. Let’s take a few quick steps to make this workspace yours.",
    "Give your installation a name. You can change it later in Server & network.",
    "This is the owner account for this installation. It can manage users, apps and server settings.",
    "Start with the tools you need. Enable or disable applications later without deleting your saved work.",
    "Check your choices. Nothing is saved until you finish setup.",
  ];
  return (
    <SetupFrame step={step} onStep={move}>
      <form className="setup-form" onSubmit={submit}>
        <div className="setup-heading">
          <span className="setup-eyebrow">
            FIRST-TIME SETUP · STEP {step + 1} OF 5
          </span>
          <h2 ref={heading} tabIndex={-1}>
            {titles[step]}
          </h2>
          <p>{descriptions[step]}</p>
        </div>
        {error && (
          <div role="alert" className="message error">
            {error}
          </div>
        )}
        <div className="setup-step-content">
          {step === 0 && (
            <>
              <div className="installation-checks">
                <div>
                  <span
                    className={
                      installation.host_ready ? "check-ok" : "check-warn"
                    }
                  >
                    {installation.host_ready ? "✓" : "!"}
                  </span>
                  <div>
                    <strong>Aether host is running</strong>
                    <small>
                      Your apps keep working when you close their windows.
                    </small>
                  </div>
                </div>
                <div>
                  <span
                    className={
                      installation.storage_ready ? "check-ok" : "check-warn"
                    }
                  >
                    {installation.storage_ready ? "✓" : "!"}
                  </span>
                  <div>
                    <strong>Private storage is ready</strong>
                    <small>
                      Accounts and host-saved files stay on this device.
                    </small>
                  </div>
                </div>
                <div>
                  <span className="check-ok">✓</span>
                  <div>
                    <strong>
                      {
                        installation.packages.filter((app) => app.installed)
                          .length
                      }{" "}
                      application packages installed
                    </strong>
                    <small>Choose which ones to enable in a moment.</small>
                  </div>
                </div>
              </div>
              <div className="setup-note">
                <AetherIcon name="home" />
                <p>
                  You only do this once for each Aether Studio installation.
                  Other users can be added afterward.
                </p>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              {installation?.data_directory && <p className="hint">Server data folder: <code style={{ overflowWrap: "anywhere" }}>{installation.data_directory}</code>. Selected during installation; all team browsers use this server.</p>}
              <label className="field">
                <span>Workspace name</span>
                <TextField
                  aria-label="Workspace name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={80}
                  pattern={".*\\S.*"}
                  placeholder="e.g. Jenkins Studio"
                />
                <small>
                  Shown in your workspace sidebar and sign-in screen.
                </small>
              </label>
              <div className="setup-connection">
                <div className="setup-connection-icon">
                  <AetherIcon name="hardware" width={26} height={26} />
                </div>
                <div>
                  <strong>Start on this device</strong>
                  <span className="setup-tag">Ready now</span>
                  <p>
                    Your installation is available at <b>{location.origin}</b>.
                  </p>
                </div>
              </div>
              <div className="setup-note">
                <AetherIcon name="settings" />
                <p>
                  Want to connect other devices? After setup, an administrator
                  can configure secure network access in{" "}
                  <strong>Server & network</strong>.
                </p>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <label className="field">
                <span>Full name</span>
                <TextField
                  aria-label="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  required
                  maxLength={120}
                  placeholder="Jonathan Jenkins"
                />
              </label>
              <label className="field">
                <span>Email address</span>
                <TextField
                  aria-label="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </label>
              <label className="field">
                <span>Administrator username</span>
                <TextField
                  aria-label="Administrator username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  minLength={2}
                  maxLength={64}
                  pattern={"[A-Za-z0-9_.\\-]{2,64}"}
                  required
                />
                <small>
                  2–64 letters, numbers, dots, dashes or underscores.
                </small>
              </label>
              <label className="field">
                <span>Password</span>
                <TextField
                  aria-label="Password"
                  autoComplete="new-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={12}
                  maxLength={256}
                  required
                />
                <small>
                  Use at least 12 characters. A memorable passphrase works well.
                </small>
              </label>
              <label className="field">
                <span>Confirm password</span>
                <TextField
                  aria-label="Confirm password"
                  autoComplete="new-password"
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={12}
                  maxLength={256}
                  required
                />
              </label>
              <Checkbox
                label="Show passwords"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />
              <div className="setup-note"><AetherIcon name="home" /><p>{authorizing ? "Authorizing setup…" : authorized ? "Setup authorized on this host. No code to enter." : installation.setup_instructions ?? "Open Aether Studio.app on this host to authorize first-time setup, then refresh this page. Authorization lasts an hour and survives refreshes."}</p></div>
              <p className="setup-smallprint">
                This account belongs to your installation. Your email can be used for sign-in and password recovery once an administrator configures Email delivery. Keep your password somewhere safe.
              </p>
            </>
          )}
          {step === 3 && (
            <>
              <div className="setup-applications">
                {installation.packages.map((app) => (
                  <label
                    key={app.id}
                    className={`setup-package ${apps.includes(app.id) ? "selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={apps.includes(app.id)}
                      disabled={!app.installed}
                      onChange={(e) =>
                        setApps(
                          e.target.checked
                            ? [...apps, app.id]
                            : apps.filter((id) => id !== app.id),
                        )
                      }
                      aria-label={`Enable ${app.name}`}
                    />
                    <span className={`setup-package-icon ${app.id}`}>
                      <AppIcon app={app.id} size={38} />
                    </span>
                    <span className="setup-package-copy">
                      <strong>{app.name}</strong>
                      <small>{app.description}</small>
                      {app.id === "ui" && (
                        <small>Optional · administrator design tools</small>
                      )}
                      {!app.installed && (
                        <small>Build required — run the installer again</small>
                      )}
                    </span>
                    <span className="setup-package-check" aria-hidden="true">
                      {apps.includes(app.id) ? "✓" : ""}
                    </span>
                  </label>
                ))}
              </div>
              <p className="setup-smallprint">
                Community plugins are planned for a future release. You can also
                start with administration only.
              </p>
            </>
          )}
          {step === 4 && (
            <>
              <dl className="setup-review">
                <div>
                  <dt>Workspace</dt>
                  <dd>{name.trim()}</dd>
                  <button type="button" onClick={() => move(1)}>
                    Edit
                  </button>
                </div>
                <div>
                  <dt>Administrator</dt>
                  <dd>{fullName} · {username.toLowerCase()}<br />{email}</dd>
                  <button type="button" onClick={() => move(2)}>
                    Edit
                  </button>
                </div>
                <div>
                  <dt>Applications</dt>
                  <dd>
                    {installation.packages
                      .filter((app) => apps.includes(app.id))
                      .map((app) => app.name)
                      .join(", ") || "Administration only"}
                  </dd>
                  <button type="button" onClick={() => move(3)}>
                    Edit
                  </button>
                </div>
                <div>
                  <dt>Access</dt>
                  <dd>This device · {location.origin}</dd>
                </div>
              </dl>
              <div className="setup-note">
                <AetherIcon name="save" />
                <p>
                  Finish setup to save these choices and sign in. You can manage
                  applications, invite people by creating accounts, and
                  configure your network from the administration sidebar.
                </p>
              </div>
            </>
          )}
        </div>
        <footer className="setup-actions">
          {step > 0 ? (
            <Button onClick={() => move(step - 1)} disabled={busy || created}>
              Back
            </Button>
          ) : (
            <span className="setup-smallprint">About 2 minutes</span>
          )}
          {created && error ? (
            <Button primary onClick={refresh}>
              Continue to sign in
            </Button>
          ) : (
            <Button
              type="submit"
              primary
              disabled={
                busy ||
                (step === 0 &&
                  (!installation.host_ready || !installation.storage_ready))
              }
            >
              {busy
                ? "Creating your workspace…"
                : step === 0
                  ? "Let’s get started"
                  : step === 4
                    ? "Finish setup"
                    : "Continue"}
              <span aria-hidden="true"> →</span>
            </Button>
          )}
        </footer>
      </form>
    </SetupFrame>
  );
}
export function SetupComplete({
  name,
  onContinue,
}: {
  name: string;
  onContinue: () => void;
}) {
  return (
    <SetupFrame>
      <div className="setup-complete">
        <span className="setup-complete-mark">✓</span>
        <span className="setup-eyebrow">SETUP COMPLETE</span>
        <h2>{name} is ready.</h2>
        <p>
          Your administrator account and application choices are saved. You’re
          signed in and ready to create.
        </p>
        <div className="completion-next">
          <div>
            <AetherIcon name="items" />
            <div>
              <strong>Open your applications</strong>
              <p>Find your enabled tools on the Studio homepage.</p>
            </div>
          </div>
          <div>
            <AetherIcon name="assembly" />
            <div>
              <strong>Add your team</strong>
              <p>Create accounts and manage access from Users and Teams.</p>
            </div>
          </div>
          <div>
            <AetherIcon name="window" />
            <div>
              <strong>Keep Studio in your Dock</strong>
              <p>
                In Safari, choose File → Add to Dock. Do the same inside CAD or
                Animation for their own app icons.
              </p>
            </div>
          </div>
        </div>
        <Button primary onClick={onContinue}>
          Open my workspace →
        </Button>
        <small>
          Network access can be configured later in Server & network.
        </small>
      </div>
    </SetupFrame>
  );
}
export function SignInFrame({ children }: { children: ReactNode }) {
  return (
    <SetupFrame>
      <div className="setup-signin">{children}</div>
    </SetupFrame>
  );
}

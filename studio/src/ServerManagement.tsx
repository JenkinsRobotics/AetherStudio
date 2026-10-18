import { useEffect, useState } from "react";
import { AetherIcon, Button, Checkbox } from "@aether/ui";
import { api } from "@aether/session/library/api";
import type { ServerStorage } from "./ServerStoragePanel";

type Report = {
  installation: {
    platform: string; python_version?: string; runtime?: string; runtime_version?: string; source_directory: string; data_directory: string;
    configuration_file: string; service: string; managed_lifecycle: boolean;
    working_directory: string; retained: string[];
    commands: Record<string, { preview: string; apply: string }>;
  };
  network: { name: string; public_url: string; bind_address: string; port: number };
  https: boolean; restart_required: boolean; storage: (Omit<Partial<ServerStorage>, "free_bytes"> & { free_bytes: number | null }) | null;
  capabilities?: { backups: boolean; network_settings: boolean; mail: boolean };
  counts: { users: number; documents: number };
  applications: { id: string; installed: boolean }[];
};

export function ServerManagement({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [action, setAction] = useState<"repair" | "uninstall" | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [notice, setNotice] = useState("");
  async function refresh() {
    try { setError(""); setReport(await api<Report>("/api/admin/maintenance")); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { void refresh(); }, []);
  function download() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "aether-studio-diagnostics.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setNotice("Command copied. Run it in a terminal on the server."); }
    catch { setNotice("Select and copy the displayed command, then run it on the server."); }
  }
  return <>
    <div className="page-heading"><div><h1>Server management</h1><p>Set up, maintain and recover this Aether Studio installation.</p></div><Button onClick={() => void refresh()}><AetherIcon name="history" />Refresh status</Button></div>
    {error && <p role="alert">{error}</p>}
    {!report && !error && <p role="status">Loading server information…</p>}
    {report && <>
      <section className="section"><h2>This server</h2>
        <p><strong>{report.network.name}</strong> · {report.installation.platform} · {report.installation.runtime ?? "Python"} {report.installation.runtime_version ?? report.installation.python_version}</p>
        <p>{report.installation.service}. {report.https ? "HTTPS enabled." : "Local HTTP connection."}</p>
        <p>Server address: <a href={report.network.public_url}>{report.network.public_url}</a></p>
        {report.installation.data_directory && <p>Object storage: <code style={{ overflowWrap: "anywhere" }}>{report.installation.data_directory}</code></p>}
        <p>{report.counts.users} accounts · {report.counts.documents} documents {report.storage?.free_bytes != null && <> · {(report.storage.free_bytes / 1024 ** 3).toFixed(1)} GB free</>}</p>
        {report.storage && report.capabilities?.backups !== false && <p>{report.storage.last_success ? `Last backup: ${new Date(report.storage.last_success * 1000).toLocaleString()}` : "No completed backup recorded."} {report.storage.error}</p>}
        {report.restart_required && <p>Saved connection settings are waiting for a restart.</p>}
      </section>
      <section className="section"><h2>Setup and configuration</h2><div className="actions">
        {report.capabilities?.network_settings !== false && <Button onClick={() => onNavigate("network")}><AetherIcon name="hardware" />Network, HTTPS & restart</Button>}
        <Button onClick={() => onNavigate("users")}><AetherIcon name="settings" />Accounts</Button>
        <Button onClick={() => onNavigate("access")}><AetherIcon name="settings" />Permissions</Button>
        <Button onClick={() => onNavigate("apps")}><AetherIcon name="items" />Applications</Button>
        {report.capabilities?.backups !== false && <Button onClick={() => onNavigate("backups")}><AetherIcon name="save" />Backups & restore</Button>}
        {report.capabilities?.mail !== false && <Button onClick={() => onNavigate("email")}><AetherIcon name="settings" />Email delivery</Button>}
      </div><p>Organizations, shared workspaces and file permissions are managed in <a href="/drive/">Aether Drive</a>. Document history is always enabled.</p></section>
      <section className="section"><h2>Diagnostics</h2><p>Download installation paths, runtime version, storage status, application availability and account/document counts. Passwords, tokens, document contents and user identities are excluded. The report includes local paths; review before sharing.</p>
        <div className="actions"><Button onClick={download}><AetherIcon name="save" />Download diagnostics</Button><Button onClick={() => onNavigate("activity")}><AetherIcon name="history" />View activity</Button></div>
      </section>
      {report.installation.runtime !== "Rust" && <section className="section"><h2>Repair, reinstall or uninstall</h2>
        <p>Repair rebuilds the current source installation and reinstalls its background service and browser shortcuts. It does not fetch or upgrade source code.</p>
        <p>Uninstall removes the background service and generated browser shortcuts. Accounts, files, history, backups, configuration and source code are retained.</p>
        <p>These actions run on the server through the maintenance helper. The web portal stops being available while its host is stopped. Save open work first.</p>
        {!report.installation.managed_lifecycle && <p role="status">Managed repair and uninstall are available for the Mac installer. Other hosts currently use their external OS service manager.</p>}
        <div className="actions"><Button disabled={!report.installation.managed_lifecycle} onClick={() => { setAction("repair"); setAcknowledged(false); setNotice(""); }}>Prepare repair / reinstall</Button><Button disabled={!report.installation.managed_lifecycle} onClick={() => { setAction("uninstall"); setAcknowledged(false); setNotice(""); }}>Prepare uninstall</Button></div>
        {action && <div className="welcome-panel" style={{ display: "block" }}>
          <h3>{action === "repair" ? "Repair / reinstall this installation" : "Uninstall service and shortcuts"}</h3>
          <p>{action === "repair" ? "The helper stops the service, creates a backup, then runs the installer. If a step fails, correct the issue and rerun repair; saved data remains in place." : "The helper verifies the installation, stops its service and removes only its service registration and generated browser shortcuts. It never deletes the data folder."}</p>
          <p>Open a terminal on the server. First change to the source folder, then preview the operation:</p>
          <code style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{report.installation.working_directory + "\n" + report.installation.commands[action].preview}</code>
          <Checkbox label="I understand this stops the server and have saved open work." checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />
          {acknowledged && <><p>Run this command on the server to perform the operation:</p><code style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{report.installation.commands[action].apply}</code><Button onClick={() => void copy(report.installation.commands[action].apply)}>Copy maintenance command</Button></>}
          <Button onClick={() => setAction(null)}>Close maintenance instructions</Button>
        </div>}
        {notice && <p role="status">{notice}</p>}
      </section>}
      {report.capabilities?.backups !== false && <section className="section"><h2>OneDrive and other cloud services</h2><p>Keep live Studio data on the server’s local disk. Choose a separate synced folder for completed backup archives in Backups. A direct OneDrive connector is not installed; connected-account uploads, delivery retries and remote restore browsing remain planned.</p><Button onClick={() => onNavigate("backups")}>Configure backup delivery</Button></section>}
    </>}
  </>;
}

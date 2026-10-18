import { Button, SelectField, TextField } from "@aether/ui";

export type ServerStorage = {
  data_directory: string;
  free_bytes: number | null;
  backup_directory?: string;
  backup_free_bytes?: number | null;
  manual_only?: boolean;
  managed_destination?: boolean;
  in_progress?: boolean;
  interval_hours: number;
  export_directory: string;
  last_backup: string;
  last_success: number;
  last_export: string;
  error: string;
  next_backup: number | null;
};

export function ServerStoragePanel({ storage, busy, run }: {
  storage: ServerStorage;
  busy: boolean;
  run: (path: string, data: object, message: string) => Promise<boolean>;
}) {
  return <section className="section">
    <h2>Server storage and backup delivery</h2>
    <p>Live data folder: <code style={{ overflowWrap: "anywhere" }}>{storage.data_directory}</code></p>
    <p className="hint">{storage.free_bytes != null && <>{(storage.free_bytes / 1024 ** 3).toFixed(1)} GB available. </>}This location is selected on the server during installation.</p>
    {storage.in_progress && <p role="status">Creating and verifying backup… You can continue working while this runs.</p>}
    {storage.managed_destination && <p>Backup folder: <code style={{ overflowWrap: "anywhere" }}>{storage.backup_directory}</code></p>}
    {storage.backup_free_bytes != null && <p className="hint">{(storage.backup_free_bytes / 1024 ** 3).toFixed(1)} GB available for backup archives.</p>}
    {storage.manual_only ? <>
      <p>Backup folder: <code style={{ overflowWrap: "anywhere" }}>{storage.backup_directory}</code></p>
      <p className="hint">Create a verified snapshot below and download its archive. Automatic schedules and delivery to another folder are still being migrated. Existing archives are retained until removed on the server.</p>
    </> : <form className="form" key={`${storage.interval_hours}:${storage.export_directory}`} onSubmit={async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      await run("/api/admin/storage", {
        interval_hours: Number(data.get("interval")),
        export_directory: String(data.get("destination") ?? ""),
      }, "Backup settings saved.");
    }}>
      <label className="field"><span>Automatic backups</span>
        <SelectField aria-label="Automatic backups" name="interval" defaultValue={storage.interval_hours} options={[
          { value: "24", label: "Daily" }, { value: "6", label: "Every 6 hours" },
          { value: "12", label: "Every 12 hours" }, { value: "168", label: "Weekly" },
          { value: "0", label: "Manual only" },
        ]} />
      </label>
      {!storage.managed_destination && <label className="field"><span>Backup destination on server</span>
        <TextField aria-label="Backup destination on server" name="destination" defaultValue={storage.export_directory} placeholder="Optional: a separate local or cloud-synced folder" />
        <small>Use an absolute folder path on this server. Completed archives are copied here; OneDrive or another installed sync app can upload them.</small>
      </label>}
      <p className="hint">{storage.managed_destination ? "The operator selects the private backup folder. Scheduled backups run while Studio is running; the next due backup runs after restart. Download archives below. External-folder delivery is not configured." : "Studio keeps a local backup even if delivery fails. Cloud upload status is managed by your sync app."} Archives are retained until you remove them; monitor free space.</p>
      <Button primary type="submit" disabled={busy}>Save backup settings</Button>
    </form>}
    {storage.error && <p role="alert">{storage.error}</p>}
    <p>{storage.last_success ? `Last local backup: ${new Date(storage.last_success * 1000).toLocaleString()}` : "No completed backup recorded yet."}</p>
    {storage.export_directory && <p>{storage.last_export ? `Delivered: ${storage.last_export}` : "No completed delivery recorded for the latest backup."}</p>}
    {storage.next_backup !== null && <p className="hint">{storage.next_backup < Date.now() / 1000 ? "Next backup: within a minute while the server is running." : `Next backup: ${new Date(storage.next_backup * 1000).toLocaleString()}`}</p>}
  </section>;
}

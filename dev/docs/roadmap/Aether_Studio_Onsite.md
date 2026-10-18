# On-site Aether Studio and Drive

Scope confirmed by Jonathan, 2026-10-03: this Mac is the first team server;
future hosts may run macOS, Linux or Windows. Team members use a browser.
External guests and native Files On-Demand are not required for this milestone.

## Ownership

Studio owns accounts, sessions, application access, documents and the server.
Drive provides the shared file experience. Editors open the same document IDs,
permissions and collaboration/history records. A server account can belong to
multiple Drive organizations and workspaces. Application teams govern app access;
Drive organization/workspace membership and file grants govern document access.
A cloud provider's sharing permissions do not grant Studio document access.

```text
Team browsers (Mac / Windows / Linux)
    -> HTTPS -> one Aether Studio server
                    -> local data folder (database, Drive blobs, workspaces)
                    -> completed backup archives
                         -> optional OneDrive / Dropbox / another sync folder
```

The live database belongs on a local server disk. Do not put it in a synchronized
folder or open it over SMB/NFS. SQLite explains the locking and network-filesystem
constraints at https://www.sqlite.org/useovernet.html. Backups use SQLite's online
backup API, then capture saved workspace files and immutable Drive objects under
the host lock. Backup archives are published by rename after their ZIP is closed.
A cloud sync app can transport those completed archives. It does not replace the
Studio server, HTTPS, account authentication or document permissions.

## Install on this Mac

Double-click `Install Aether Studio.command`. It offers a data folder and keeps
the current choice by default. Command-line installation accepts:

```sh
zsh core/host/install-macos.sh --data "/absolute/local/Studio Data"
```

For a **new, stopped installation**, add `--backup-directory` with an absolute
path to a separate backup folder. For an existing running installation, configure
backup delivery in **Administration > Backups**. Reinstalling against another data
folder while the service is running is rejected. Reinstall does not copy/migrate
the old data automatically.

The installer records the path in a private installation.json under the default
platform data/config location. The launch agent also passes `--data` explicitly.
App shortcuts, `open`, password recovery and foreground `serve` consult the
recorded location. The OS lock permits only one cooperating server process to use
a data folder. `--data` can explicitly select a different foreground installation.
Known cloud folder names and UNC paths are rejected for live storage; this is not
exhaustive sync/network detection. The operator must choose a genuinely local disk.

The Mac service starts **at user login**, not before login. Keep the server user
logged in and the machine awake. Linux and Windows use portable path defaults
and the same Python/browser server; native service installation and target-OS
packaging/engine qualification are still future work. Do not treat this Mac test
as verification of Windows or Linux deployment.

## Connect the team

1. Use `aether-studio` as the hostname under your organization’s DNS domain and reserve its LAN IP. Configure local DNS/router
   resolution so all team devices reach the same Mac.
2. Use an organizational TLS certificate or generate an internal one:
   `python -m core.host certificate --hostname aether-studio.example.com --ip 192.168.1.20`.
   Replace both examples. OpenSSL must be installed. The command creates a new
   private certificate directory; it never changes the listener or trust stores.
3. Trust the generated `ca.pem` on each client through your OS/browser certificate
   management. Keep `ca-key.pem` and `server-key.pem` private on the server.
   The server certificate lasts 365 days; the local CA lasts ten years. Regenerating
   creates a new CA, so clients must trust that new CA. Organizational certificate
   renewal is preferable for a managed team. Certificate files need separate backup.
4. In **Administration > Server & network**, set bind address `0.0.0.0`, the HTTPS
   URL with port, and the certificate/key paths. Save, then apply the restart.
5. Permit the selected port through the Mac firewall for the local network.
   On-site access does not need public router port forwarding.
6. Create accounts in **Users**. In Drive create/select an organization and shared
   workspace, add accounts and assign viewer/editor/owner roles. Put shared project
   files there; leave personal work in My files.
7. Test from a second device with an ordinary member: sign in, open a shared file,
   save, create an explicit version, comment, and assign an action item. Confirm a
   viewer cannot edit. Existing revision checks detect stale saves; this does not
   implement live simultaneous coediting.

Bonjour alternative for a small local network: set the Mac’s Local Hostname to
`aether-studio` in System Settings > General > Sharing, then use
`aether-studio.local`. This relies on mDNS-capable clients on the same multicast
network; managed DNS is preferable across office network segments. Do not create
a corporate unicast `.local` DNS zone. Apple documents the distinction at
https://support.apple.com/en-us/101903. Studio does not silently rename the machine,
change router DNS or install certificate trust on client devices.

## Backups and recovery

**Administration > Backups** shows the data folder, free disk, schedule, last local
backup and last export result. Daily is the default after setup; choose six/twelve
hours, weekly or manual only. The worker checks once a minute while serving.
Schedules resume after downtime; a missed interval produces one backup, not a
backlog. Failure is shown; the next scheduled attempt follows the chosen interval.
Manual backup can be used immediately after fixing a failure.

An optional delivery folder may be inside an existing cloud provider's sync root.
Studio writes a temporary `.partial` file there and renames it to `.zip` only after
copy and flush complete. A missing destination is reported without recreating its
mount path. Failed export keeps the local archive. Provider upload/replication is
monitored in the provider's application, not reported as successful by Studio.
Archives contain the team's private data. Use a folder restricted to administrators.
No retention purge is automatic; monitor disk use and retain/delete backup copies
according to team policy. Backups serialize saved-data access while the snapshot
is captured; large archives can temporarily delay saves.

Restore requires an empty folder:

```sh
python -m core.host restore --archive "/path/studio-backup.zip" --data "/empty/restored-data"
```

Restore verifies SQLite integrity and revokes sessions/service tokens. It resets
network configuration to localhost and clears the old backup destination/schedule
state; the new host starts with daily local backups. It does not reuse paths from
the old server. Restore currently limits extracted data to 20 GB.

To migrate, stop the service, retain the original data as a rollback copy, restore
into a new empty local folder, and rerun installation with `--data` pointing there.
On macOS use `launchctl bootout gui/$(id -u)/studio.aether.host` to stop/unload before
reinstalling. On a foreground installation, `python -m core.host configure --data
"/restored-data"` records the selection while stopped. Restore **before** configure:
configure creates the server lock file. No live data folder move is supported.

Backups exclude browser-local unsaved changes, installed application builds,
SMTP/agent secrets stored outside the database, and TLS files. Keep those server
configuration files separately. Test a restore before relying on any backup policy.

## Server management portal

Administration > Server management is the server control center: installation
information, storage/backup status, accounts, app access, network/HTTPS/restart,
email, activity and a diagnostics download. Diagnostics use an allowlist of
operational fields; they omit credentials, identities and file contents, but do
include local paths that should be reviewed before sharing.

Repair/reinstall and uninstall have a preview and an explicit local apply command:

```sh
python -m core.host.maintenance inspect
python -m core.host.maintenance repair --data "/path/to/Studio Data"
python -m core.host.maintenance repair --data "/path/to/Studio Data" --apply
python -m core.host.maintenance uninstall --data "/path/to/Studio Data"
python -m core.host.maintenance uninstall --data "/path/to/Studio Data" --apply
```

Without `--apply`, these commands only print the plan. The portal prepares the
correct quoted command for the current installation, after explaining that the
server stops. No browser endpoint executes arbitrary shell commands. The local
helper verifies service/shortcut ownership and refuses unrelated installations.
Mac repair stops the service, creates a backup, runs the existing source installer
and starts the reinstalled host. It does not fetch code updates. If repair fails,
keep the retained data, correct the error and rerun repair. Mac uninstall removes
the service and generated browser shortcuts; it preserves accounts, documents,
history, backups, certificates, configuration, source checkout and dependencies.
There is deliberately no automatic data purge. Nothing is uninstalled merely by
opening the portal or preparing a command.

Linux/Windows service install/repair/uninstall integrations and a packaged update
channel are not yet implemented. Offline restore/data relocation remain guided
console operations. The web control center cannot recover a missing/stopped server
on its own; the separately runnable local installer/maintenance helper is required.

## Cloud integration decision

Keep the live database, workspace files and version history on local server storage.
Current support publishes completed backup archives to an administrator-selected
folder, which may be synchronized by an already installed cloud provider.

A future **Aether Studio OneDrive integration** should connect through Microsoft
Graph, upload completed backups with resumable transfers, report delivery/retry
status, list remote recovery archives and offer deliberate file import/export.
This is a Studio integration, independent of any coding-assistant connector.
Its account registration, permissions, token storage/revocation and remote restore
verification require implementation before a Connect button is exposed. Use the
least permission supported by the selected account/API model. Provider failure
must not prevent local saves or remove local backups. OneDrive synchronization
never substitutes for Studio collaboration permissions or document version history.

Microsoft Graph's supported resumable upload mechanism:
https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0
SQLite WAL/database persistence requirements:
https://sqlite.org/wal.html

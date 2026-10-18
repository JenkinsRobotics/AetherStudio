# Company-network address

Jonathan selected company-network access first on 2026-10-13. The prepared address
is **https://aether-studio.local:8780/**; agent clients will use the same origin at
**https://aether-studio.local:8780/mcp**.

**Not activated yet.** macOS certificate-trust authorization was canceled. The
running native installation is unchanged and still uses localhost. Never bypass
certificate verification or retry the trust modification without renewed user
authorization. The temporary discovery test job was removed after verification.

## Prepared installation

Private candidate:
`~/Library/Application Support/Aether Studio Native/company-network-20261013-r1`.
It preserves the active native executable, all frontend/worker manifests, provider
settings and data paths. Its differences are the HTTPS origin, IPv4 network
listener, certificate/key paths and permitted TLS directory. No database migration
or database restart is needed. There were no saved network overrides when staged;
recheck this before activation, since an administrator's saved network settings
take precedence over operator defaults.

`dev/rebuild/company_network.py stage` creates an owner-only candidate without
activating it. Its macOS Bonjour helper advertises `aether-studio.local` and an
HTTPS service on the chosen Ethernet/Wi-Fi interface. It refreshes the record when
that interface's private IPv4 address changes and withdraws it when offline. It
does not rename the Mac or edit router configuration. The server binds IPv4
interfaces and keeps the explicit HTTPS Host/Origin and account permission checks.
No port forwarding, public DNS or Internet tunnel is configured.

The installation's existing LaunchAgents run under the signed-in server operator.
This is not a pre-login system-service installer. Same-link Bonjour discovery
does not establish access across routed company VLANs or client-isolated Wi-Fi;
those require the company's network administrator to provide DNS/discovery and
routing. Access from a second physical workstation is still unverified.

## Workstation certificate

The generated certificate identifies only `aether-studio.local`, lasts one year,
and has `CA:FALSE`: it cannot issue certificates for other websites. The server's
key is mode 0600 inside its private TLS directory. Never distribute that key.

The handoff archive is
`.verification/company-network-2026-10-13/Aether-Studio-network-setup.zip`.
It contains only `Aether-Studio.crt` and `CONNECT.txt`. Verify the certificate's
SHA256 fingerprint before trusting it:

```text
61:D0:54:8E:79:8D:30:FF:CF:C6:C4:4C:BF:80:AC:7F:
DB:45:9A:E3:1F:92:77:8E:56:6A:EA:DB:7F:15:BF:CD
```

On a Mac, import the public certificate in Keychain Access and trust it for SSL.
The included command constrains that trust to the server hostname and SSL policy;
macOS may require the user to authorize the change. This follows Apple's
[certificate trust controls](https://support.apple.com/guide/keychain-access/kyca11871/mac).
The host trust request was canceled; do not claim this trust is already installed.
Certificate enrollment on other operating systems and real external agent clients
remains to be verified. Clients with their own trust stores may need a separate
certificate import. The helper does not disable TLS checks in any client.

Renewing this self-signed server certificate requires updating workstation trust.
A company-managed certificate authority/domain is the later alternative when IT
needs centrally managed certificates or access across multiple network segments.

## Activate after trust approval

First inspect the current installation marker and saved network configuration.
If another task promoted an app after staging, rebase the candidate from the new
marker while retaining the prepared TLS files and network changes. Do not replace
a newer app or native generation with the staging snapshot. The activation tool
refuses a changed marker or unrelated environment changes.

```sh
.venv/bin/python dev/rebuild/company_network.py activate \
  --marker "$HOME/Library/Application Support/Aether Studio Native/current-installation.json" \
  --candidate "$HOME/Library/Application Support/Aether Studio Native/company-network-20261013-r1"
```

It verifies macOS SSL trust before modifying services, checks the native binary,
runs read-only store integrity checks, registers discovery, drains/restarts only
the native HTTP host and verifies named HTTPS readiness and the MCP resource URL.
It preserves PostgreSQL and application data. A pre-commit failure restores the
old server job unless a concurrent deployment has taken ownership. The successful
marker becomes the origin authority for subsequent deployments.

The real activation path has not been executed because certificate approval is
pending. After activation, also verify the sign-in page and secure browser context,
anonymous MCP rejection, agent OAuth metadata, and an actual second workstation.
Users will sign in at the new hostname; old localhost browser tabs/bookmarks and
MCP connections need the new address. Do not discard unsaved local editing state
before reconnecting.

## Verification so far

Four operator tests and scoped Ruff pass. They cover private-network/name guards,
name conflict refusal, real OpenSSL certificate creation, key permissions,
preservation of app/data configuration, public-only handoff contents and refusal
to alter services without certificate trust or with a stale generation.

An actual Bonjour registration resolved the new name to the Mac Studio's
`10.25.0.243` address. A real TLS handshake over that interface verified the
hostname using the generated certificate, without disabling certificate checks.
The test registration was then removed. Existing native readiness remains 200.
Evidence: `.verification/company-network-2026-10-13/report.json` and `tls-proof.json`.

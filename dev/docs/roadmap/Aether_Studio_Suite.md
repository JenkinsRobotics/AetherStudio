# Aether Studio: locally hosted application suite

Direction confirmed by Jonathan, 2026-09-08. The independent host and baseline
administration workspace are now implemented; see `core/host/README.md` and
STATUS. Historical delivery planning below is retained for the remaining gaps.
Community plugin support remains explicitly future work.

## Identity and principle

The [Aether branding guide](Aether_Branding.md) records Jonathan's updated
2026-09-13 visual identity and the generated Studio, CAD, Sketch, Vector and
Animate application marks, with links to their shared artwork masters.

Aether Studio is the umbrella collection of high-quality open-source software.
Aether CAD, Aether Animation (formerly Anima Studio), and future Aether Dynamics
are application packages. Users should install once on their own host and open
an application from a browser on a desktop, laptop, or tablet. No mandatory cloud
account is part of this direction. Browser access does not itself promise phone
usability, offline editing, simultaneous collaboration, or identical GPU support.

The local repository directory is `Aether Studio`, and **Aether Studio is the
server** — accounts, sessions, documents and protocol in `core/host/` and
`core/session/`. The one genuinely shared package is `core/ui/` (`@aether/ui`),
with shared artwork in `core/assets/`. The CAD engine (`@aether/core`) is
product-owned at `Aether CAD/aether-engine/` (2026-09-11; renamed 2026-09-12); the import name is
unchanged. Product paths and engine protocol/format
names remain unchanged. The remote is still
`JenkinsRobotics/AnimaStudio`. A compatibility symlink at the old local directory
preserves existing development paths and Python virtual-environment entry points.

## Review of existing implementation

| Area | Evidence in this checkout | Implication |
| --- | --- | --- |
| CAD | `Aether CAD/package.json`, `src/`, `core/engine/src/` | Already React 19/TypeScript/Vite with Three.js and OCCT/Replicad WASM; preserve real Part and Assembly workflows |
| Animation | `aether-animation/web/src/{App,TimelinePanel,PosePanel,MateDialog}.tsx`, `engine.ts` | Already React with shared UI and Python RPC; includes rig load/save, mate editing, posing and playback; not full archived-app parity |
| Native UI | removed 2026-09-23 (git history) | Swift application archived 2026-08-01 and deleted from the tree; current web product manifests do not use PySide6 |
| Core | `core/engine/package.json`, `ARCHITECTURE.md` | Real shared TS modules already extracted; not yet one fully consolidated server engine |
| Python | `aether_animation/bridge.py`, `aether_workspace.py`, `httpbridge.py` | Animation and persistent Assembly semantic authority remains here |
| Shared UI | `core/ui/src/` | Existing production controls and dock/float/canvas shell; extend these rather than fork a second suite widget system |
| Mockup | `onshape mockup/README.md`, `components/`, `package.json` | React/TS/Vite/Tailwind/Three.js, adaptive panels and fixture modeling; useful UX reference, no exact kernel integration |
| Dynamics | `aether-dynamics/README.md` | Scaffold only |

This review inspected source and documentation. It does not constitute renewed
runtime verification of previously shipped features.

## Recommended architecture (planned)

- **Browser applications:** React + TypeScript; Vite builds each application.
  A common launcher navigates between CAD and Animation. Share Aether UI controls,
  appearance and accessibility conventions; responsive/touch flows need explicit QA.
- **Suite host:** one managed installation serves the launcher, application assets
  and same-origin API. It supervises backend processes, manages workspace storage,
  sessions, access control and package enablement. This is a product host, not a
  third shared foundation alongside Core and UI.
- **Application packages:** start with bundled, versioned CAD/Animation modules
  enabled in a manifest. Record identifier, version, route, compatible API version
  and required services. Dynamic downloads and independent updates follow only
  after compatibility and rollback are tested.
- **Semantic engines:** retain current ownership while consolidating proven shared
  capabilities. Browser OCCT workers can continue doing local computation; moving
  heavy jobs to the host is a separate contract/performance decision. Do not make
  browsers and server competing authorities for the same saved workspace.
- **Storage:** host-owned project files and assets with atomic saves and revision
  checks. Device-local storage holds layout preferences, not the only project copy.
- **Hardware:** transport runs on the host or a connected device agent, with one
  explicit control owner and existing engine/firmware safety. Browser focus and
  network timing must not become the real-time servo loop.

A container/Compose distribution is the recommended first packaging target, with
persistent storage outside the image. Native installers can follow. Grafana is a
useful installation model: its official Docker documentation covers a single
service with persistent storage and plugins. This is an architectural analogy,
not a dependency: https://grafana.com/docs/grafana/latest/setup-grafana/installation/docker/
React documents Vite for custom client applications:
https://react.dev/learn/build-a-react-app-from-scratch

## Concrete gaps before cross-device use

The existing HTTP bridge binds to `127.0.0.1`, serves one selected application,
and has one shared Session protected by a lock. It exposes wildcard CORS and no
suite login boundary. Animation development targets the browser device's
`127.0.0.1:8787`. A different device therefore cannot simply open the current dev
URL and reach the intended host. Merely exposing that server to the LAN is not
the production implementation.

Provide same-origin routing, authenticated access, scoped file access, explicit
session/workspace ownership and save-conflict handling before shared-host release.
Configure HTTPS for the selected deployment and verify GPU/browser capabilities
on target tablets; provide a supported renderer fallback or a clear requirement.
Cross-device sequential use comes first; concurrent editing is separate work.

## Delivery order and acceptance (planned)

1. **Suite host vertical slice:** one launch command, app launcher and routes for
   existing CAD and Animation builds, supervised Python service, persistent data
   directory. Both applications reach the same host API without localhost literals.
2. **Cross-device workspace slice:** authenticated second-device access; create,
   save, reopen after host restart; denied out-of-root access; stale-save rejection.
   Define migration between existing Part, Assembly and Animation formats before
   claiming one shared project already opens in both products.
3. **Mockup UX integration:** move proven adaptive layout/interactions into Aether
   UI and consume them incrementally in CAD/Animation. Preserve mounted viewport,
   camera, selection and engine state; verify pointer/touch/keyboard behavior.
   Do not replace working OCCT operations with procedural mock geometry.
4. **Package distribution:** pinned host/app versions, enable/disable, dependency
   checks, backups and verified upgrade/rollback. Test on the supported host OSes.
5. **Product depth:** close Animation authoring gaps and CAD exact-feature gaps;
   start Dynamics only when a real simulation workflow needs it.

No new PySide6/Swift product rewrite is needed. Keep optional native launchers thin.
Do not rename Python `aether_animation`, `.anima`, or `.animastudio` identifiers as part
of branding: engine consolidation and format migration need their own atomic work.


## Shared directory organization — implemented 2026-09-08

`core/engine/` and `core/ui/` are the two shared packages under one `core/`
parent. Core as a directory means shared infrastructure; `@aether/core` still
means the UI-independent engine package. The proposed `apps/{cad,animation,dynamics}`
grouping and `host/` are future organization, not part of this relocation.

## Host/admin baseline delivered — 2026-09-08

`core/host/` serves `studio/` plus CAD, Animation and UI on one origin. It owns
local authentication, isolated login/app engine sessions and user file roots,
bundled-app gates, teams/application grants, scoped service tokens, network
configuration, audit, manual backups and offline restore. macOS per-user
LaunchAgent starts at login; four URL-opener shortcuts replace the native
webview wrappers. Studio has the user's supplied charcoal/blue sidebar design.
See `core/host/README.md` for precise shipped behavior and limitations.

Still planned: community package discovery/install/update, multi-organization
isolation, shared team project storage, full cross-device project migration and
collaboration, SSO/MFA/email delivery, unattended system service/container
packaging, automated DNS/TLS provisioning, scheduled backup/retention and
external data sources. Grafana Assistant/Advisor, enterprise licensing,
correlations and cloud migration are not Aether features by analogy alone.

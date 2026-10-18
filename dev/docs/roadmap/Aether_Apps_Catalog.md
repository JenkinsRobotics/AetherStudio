# The Aether Apps — catalog

Source of truth for product names, repos and status (Jonathan, 2026-10-10).
Naming: product **Aether X** (space), repo/URL `aether-x`, package `@aether/x`,
CLI `aether x`. The host's live app table is `PACKAGES` in `core/host/server.py`;
an app joins it once its repo exists.

**Suite line:** open-source tools for designing, animating and running real-world
shows and machines. They work together on one server and are built for AI from
the start.

**Pillars:** open source (Apache-2.0) · unified (one account, file system and
design language) · AI-native (every action drivable via MCP and the CLI; saved
work never needs AI) · yours to run (offline on one machine, or your own Studio
server). Descriptions never claim a programming language.

**Shape:** Aether Studio is the server and ships everything that needs one
(Drive, accounts, sharing, collaboration, versions, approvals). Every other app
is a separate repo and download that works alone offline and connects to Studio
when available.

## Server

| App | Repo | What it's for | Status |
|---|---|---|---|
| Aether Studio | `aether-platform` → `aether-studio` (planned rename) | Your team's server: accounts, shared files, version history, approvals and live collaboration on your own hardware. Includes Aether Drive. | Core |
| Aether Drive | `aether-drive` → merge into Studio (planned) | Files, projects, versions and shared workspaces. Ships inside Studio. | Core (part of Studio) |

## Apps: engineering and show (Aether's own line)

| App | Repo | What it's for | Status |
|---|---|---|---|
| Aether CAD | `aether-cad` | 3D parametric parts, assemblies and production drawings. An open alternative to SolidWorks, Onshape and Shapr3D. | Release 1 |
| Aether Animation | `aether-animation` | Animate characters and animatronic robots on a timeline, then play the motion on real servos. An open alternative to Bottango. | Release 1 (flagship) |
| Aether Map | `aether-map` | Projection mapping and unattended show playback on Raspberry Pi players. An open alternative to MadMapper and Resolume. | Release 1 |
| Aether Sketch | `aether-sketch` | Freehand drawing and sketching with expressive, pressure-sensitive brushes. An open alternative to Adobe Photoshop Sketch and Procreate. | Release 1 |
| Aether IO | `aether-io` | Electronics and wiring for motion hardware: controllers, signals and connections. | Later |

## Apps: creative

Built after release 1.

| App | Repo | What it's for | Equivalent to |
|---|---|---|---|
| Aether Vector | `aether-vector` (shell exists) | Vector illustration and graphic design. An open alternative to Adobe Illustrator and Affinity Designer. | VectorCraft |

## Final lineup (Jonathan, 2026-10-10)

Aether Studio (+ Aether Drive), Aether CAD, Aether Animation, Aether Map,
Aether Sketch, Aether IO, Aether Vector. Nothing else is planned.

**Deferred:** Aether Photo (image editing, like Photoshop/Affinity Photo) — off
the list until its repo exists; re-add here when work starts.

**Not adopted:** Film (video), Motion (effects), Layout (publishing), Darkroom
(photo library), PDF, a 2D CAD/drafting app, and Audio, Slides, Sheets, Write.
Revisit only on Jonathan's request.

## Possible later splits (currently features)

- **Aether Show:** one timeline syncing animation, projection, lighting and audio. Stays inside Animation and Map for now.
- **Aether Fleet:** set up, update and monitor Pi players and controllers. Stays inside Studio for now.

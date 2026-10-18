# Aether Studio as a platform

Jonathan, 2026-10-03: *"I want Aether Studio to become our version of Microsoft
365. Where Microsoft 365 is for office and business, our Aether Studio is for
engineering, creative design. So we need to think and plan everything in terms
of that."* And, on structure: *"I do not know if a monorepo is the right plan
or to split out the apps individually."*

This document takes the analogy seriously, measures what already exists against
it, and answers the repository question through it — because the analogy
answers it.

## 1. What Microsoft 365 actually is

It is worth being precise, because the common reading of the analogy is "a
bundle of apps", and that reading leads to the wrong architecture.

Microsoft 365 is **a platform with applications on top of it**. The platform is
identity, a file store, sharing and permissions, co-authoring, search, an
activity graph, licensing and tenant administration. Word, Excel and PowerPoint
are surfaces over that platform. For Aether, the useful lesson is independent application releases against a
stable platform contract. This document does not establish Microsoft’s internal
repository topology; our repository decision rests on our ownership boundaries.

Two consequences follow, and both matter here.

**The platform is the product.** Word is replaceable; a competitor could write a
better word processor. What cannot easily be replaced is the account, the files
already in it, the people they are shared with, and the version history. That
is the moat. In our terms: **Aether Studio is not the collection of CAD, Map and
Animation. Aether Studio is the thing underneath them**, and the apps are how a
person touches it.

**Compound documents are the suite's superpower.** An Excel range lives inside a
Word document and stays live. That single capability is most of why anyone buys
the suite rather than three separate tools. The engineering equivalent is a CAD
part placed in a Map show, a Sketch drawing referenced by a CAD drawing, an
Animation rig driving a Map output — each one a live reference, not a copy.

## 2. What already exists

More than I expected, and the shape is right.

| Capability | Where | State |
|---|---|---|
| Accounts, sessions, teams, audit | `core/host/state.py` | Real |
| **Per-user app entitlements**, admin enable/disable | `require_app`, `app_allowed` | Real — app-access enforcement; commercial licensing is separate |
| **One document store for every app** | `library` table | Real |
| Drive: organisations, workspaces, sharing, links, favourites, activity | nine `drive*.py` modules | Real |
| Version control: named versions, branches, merge, compare | `core/host/history.py` | Real |
| Comments, notes, tasks and reminders | `core/host/collaboration.py` | Persisted, permission-checked and revisioned; simultaneous editing is separate |
| AI agents, suite-wide | `core/host/agents/` | Real |
| Design system, themes, icon packs | `core/ui`, `core/assets` | Real |
| Backup, restore, maintenance, installation | `core/host/` | Real |

Two of these deserve emphasis because they are the hard parts and they are
already done.

**Entitlements enforce app access.** Administrators centrally enable applications
and control users' access. That is a useful foundation for licensing, but does not
by itself implement subscriptions, billing, offline licence validation or seats.

**There is already one file store.** Every application's documents live in a
single `library` table, and Drive layers organisations, workspaces, sharing and
activity on top of it by foreign key (`drive_locations.file_id → library.id`).
The OneDrive-shaped substrate is built. This is the single most encouraging
finding in this review, because it is the thing that would have been expensive
to retrofit.

## 3. Verified gaps and existing capabilities

Reviewed against the current checkout by Codex, 2026-10-03.

**Cross-application references remain a gap.** A shared contract needs stable
file identity, a pinned version or an explicit follow-branch policy, permission
checks at resolution, missing/deleted-target behavior and cycle handling. Products
must retain responsibility for interpreting the referenced content. CAD's linked
parts are useful prior work, not a reason for Map to import the CAD engine.

**Product code remains in the host.** The 28 `/api/cad/*` and `/api/map/*` route
references and `cad_settings.py`, `map_project.py`, `map_provisioning.py` remain.
Extract these behind an explicit product registration contract before separating
the server. Preserve authentication, authorization, storage migrations and the
existing HTTP behavior during that move.

**Drive already browses and searches across applications.** `Drive.list` in
`core/host/drive.py` reads the common library without a required app filter, applies
file permissions, and supports `organization="all"` for personal navigation.
Its query performs case-insensitive file-name matching. The optional app filter
and app-specific editor libraries are useful views, not separate storage silos.
Full-content indexing and federated search remain future work; there is no need
to remove app filtering from editor APIs to make Drive universal.

**Comments, notes and action items are implemented.** The collaboration service
persists document metadata and events, checks an independent expected revision,
and enforces author/owner/assignee permissions. Shared document panels call this
service through the session adapter. Gallery fixtures are demonstrations of those
components, not evidence that the production feature is a mock. Presence and
simultaneous co-authoring remain distinct work.

## 4. The repository question, answered by the framing

The chosen Aether target is **one platform repository plus application
repositories**, because the ownership boundaries have different release needs.

- **The platform is one thing and changes together.** Identity, documents,
  sharing, versioning, collaboration, the design system. A change here affects
  every application, and it needs one version number, one test suite and one
  release. Splitting it across repositories would mean coordinating a release
  across four places to add a field.
- **Each application is its own product and changes on its own schedule.** CAD
  shipping a new fillet does not concern Map. These belong in their own
  repositories, consuming the platform's HTTP contract and the design system
  package exactly as any third-party application would.

So the end state is:

```
aether-platform     core/host + core/session + the shared packages,
                    published as @aether/ui, @aether/assets, @aether/sketch
                    and a documented HTTP API — this is Aether Studio

aether-cad          each its own repository, each consuming the platform
aether-map          as a versioned dependency, with its own release train
aether-animation
aether-studio-apps  Drive, IO, Sketch, Vector together until they earn separation
```

**Placement follows real ownership and consumers.** Shared platform contracts
belong to the platform; product semantics belong to the product. For reusable
widgets, require a demonstrated consumer and keep data/operations in adapters.
“Could another app someday need this?” alone does not authorize a new shared
abstraction; `CONVENTIONS.md` requires a second real consumer. Audit the thirteen
named widgets individually rather than treating engine-free presentation as an
engine dependency.

**This does not change the staging.** The work in
[Repository_Split_Preparation.md](../../briefings/tasks/Repository_Split_Preparation.md)
is still exactly what has to happen first, and the platform framing adds one
item to it: the product code must come out of the server before the server can
be extracted. Cross-package relative imports remain a blocker. The new boundary guard records
325 occurrences, including CSS, asset globs, tests and configuration; its scope
is broader than the earlier 250-import estimate. It rejects new crossings while
existing ones are migrated to package exports.

## 5. Next implementation priorities

1. Make UI/assets/session contracts installable independently, with tarball
   consumer tests, before creating new repositories.
2. Remove product routes/modules from the platform behind a tested registration
   boundary. Keep editor formats, validation and rendering product-owned.
3. Design and implement permission-checked, version-aware document references.
4. Extend existing name search to indexed metadata/content when actual library
   size and supported formats justify it.
5. Add presence and simultaneous editing without conflating document saves,
   explicit versions and collaboration-metadata revisions.

Keep STEP, DXF, SVG and glTF round trips in the product verification gates during
this work. Repository organization must preserve file fidelity and behavior.

## 6. What to be careful about

**The analogy flatters.** Microsoft 365 is built by thousands of people and its
value rests on compatibility with documents the world already has. Our
equivalent of that compatibility is import and export fidelity — STEP, DXF,
SVG, glTF. A suite nobody can get their existing work into has no users,
however good its platform is.

**Breadth before depth is the failure mode.** Nine applications, two of which are
a placeholder and a README, is already a sign of pull in that direction. A
plausible Microsoft 365 for engineering could be three excellent applications on
an outstanding platform. It cannot be nine mediocre ones.

**The platform contract is the thing to protect.** Once applications live in
separate repositories, the HTTP API and the design system's exports become
promises to code that cannot be grepped. Version them, document them, and treat
a breaking change as an event — because after the split that is exactly what it
will be.

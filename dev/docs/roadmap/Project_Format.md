# Project format — the Anima Studio plain project folder

> How Anima Studio creates, saves, and reopens a project (Jonathan,
> 2026-07-16). A project is a **folder**, not one file: canonical engine
> documents (`.character.anima` / `.scene.anima`) plus the app's
> editor-only metadata and typed Project assets. Characters remain reusable
> semantic documents; an explicit Character export materializes the assets
> needed to make one independently shareable.

## Layout

```
~/Documents/AnimaStudio/
  Character Library/              <- reusable Character sources (app-owned index)
    <stable-library-uuid>/
      character-library.json      <- source identity + simple revision
      jp01.character.anima        <- canonical engine Character
      jp01.editor.json
      assets/                         <- materialized by Character export
  MyRobot/                        ← the project folder (plain folder, browsable)
    project.json                  ← manifest (app-owned): name, revision, dates,
    │                               milestone, character/scene index, window/editor state
    characters/
      jp01/                       ← one project-local character document
        jp01.character.anima      ← canonical rig (ENGINE format): parts, mates,
        │                           DOF, limits, relations, output mappings
        jp01.editor.json          ← editor-only (APP): connector inference cache,
        │                           per-part display, layout — NEVER inside the .anima
    scenes/
      wave.scene.anima            ← animations / shows (ENGINE format)
    assets/                        ← project Pack-and-Go source store
      models/ assemblies/ audio/ video/ images/ scripts/ renders/
```

Extensible: `project.json` indexes what's present, so future kinds
(audio, exports, LED maps) become new folders without a format change.

## Character and Project asset ownership

A Character may carry more than rigid geometry. Character-owned assets are the
files required whenever that reusable Character appears: CAD/mesh geometry,
material and texture maps, facial or LED layouts, character-specific audio,
reusable poses and animation clips, and calibration/reference data that does
not contain a physical device address. Project-owned assets are specific to one
show: stages and environments, show music/video, cue sheets, scene scripts, and
world-space placement. Hardware connection addresses and safety calibration
remain deployment data.

The live importers expose only formats they can load honestly. STEP/STP,
USD-family, STL, and OBJ are live for rigid 3D Parts. Audio, video, images,
animated image sequences, PBR texture sets, LED/pixel maps, motion capture,
URDF, and reusable animation/scene documents are valid future import families,
but each remains labelled planned until its parser and destination workflow
ship.

## Asset ingestion policy

- **Copy into Project is the default model-import behavior.** Studio copies
  the bytes into the matching typed directory (`assets/models/` for CAD) and
  never changes or deletes the operator's original file. This makes Save As,
  backup, sharing, and offline robot playback deterministic.
- **Reference in Place is the non-portable alternative.** The app stores the
  original absolute path plus a security-scoped bookmark. The engine still
  receives only a safe character-relative logical model token; editor metadata
  maps that token to the project asset ID. Missing links require relinking.
- **Rig-defining CAD defaults to copied.** Reimport/Replace copies a newer
  source over the managed `assets/models/` file while retaining asset identity
  and incrementing the simple part version.
- **Move is never an import choice.** Import must not destructively reorganize
  an operator's source library. A separate explicit Finder/export operation can
  move files if the operator requests it.

When the media importers ship, their staging sheet should offer **Copy
(recommended)** and **Link to Original**, explain portability and missing-file
risk inline, and remember the last choice per asset family. It must not present
Link for a format whose downstream engine/renderer path cannot resolve it.

**Real projects are plain folders** (browsable, versionable). A
single-file **`.animastudio` bundle is an Export form only** — "Export
Project" zips the folder into one shareable/double-clickable item;
day-to-day projects stay open folders.

## Ownership model: Library Character -> Project snapshot -> Scene instance

A **Character is reusable and conceptually independent of a Project**. Studio's
user-level `Character Library/` stores those reusable sources. A Project does
not keep a live external link to a library package: **Add to Project copies the
complete Character folder into `characters/` as a pinned snapshot**. That
snapshot records the source library UUID and revision in `project.json`, so the
operator can see exactly which source revision a show uses and explicitly
publish/update when desired. Editing a Library Character never silently changes
an existing show.

The ownership boundary is:

- **Character:** rigid Parts, mates/relations, DOF and limits, reusable clips,
  logical outputs, model/media assets intrinsic to that Character.
- **Project:** pinned Character snapshots, scenes/shows, project media and
  cues, world-space Character instances, and deployment selections.
- **Hardware profile / deployment:** device identities, physical channels,
  calibration, safety limits, and the binding from Character logical outputs
  to hardware. Hardware addresses do not belong in reusable Character rigs.

Character authoring uses `Character -> Part` coordinates. Scene authoring adds
the separate `World -> Character` instance transform. A Project may therefore
place the same Character multiple times without changing any Part-local rig
data.

## Where the logic lives (engine vs app)

Per "AnimaCore is canonical," the engine owns everything about file
**content**; the sandboxed Mac app owns the **filesystem**:

- **Engine (Python):** serialize/parse `.character.anima` and
  `.scene.anima`, validate, and define the project-format rules. These
  are pure text-in/text-out — the hooks. (Build: `serialize_character`
  / `serialize_scene`.)
- **App (Swift):** the actual folder/file writing, native New/Open/Save
  dialogs, security-scoped bookmarks, and atomic writes. This layer is
  **irreducibly Swift** — a sandboxed app's file access can't be handed
  to the Python helper subprocess — but it is thin and fully specified
  here, and the `AnimaDocument` P0A machinery already implements most of
  it (revised from a flat bundle to this folder layout). Codex wires it;
  it designs nothing.

## Names: project and character are independent namespaces

A project holds **one or more characters** (`characters/` is a folder of
many). The **project name** and a **character name** are separate
identities — a "MyRobot" project can contain characters "jp01",
"gripper", "turret". Character folder names are unique within a project;
the project name is unique within `~/Documents/AnimaStudio/`. Renaming
a project never touches character names, and vice versa. `project.json`
indexes the characters (and scenes) by their folder names + display
names. Each indexed Character also has `source_kind` (`project_local` or
`library_snapshot`) and, for snapshots, `library_character_id` plus
`library_revision`. These app-owned provenance fields do not enter the
canonical `.character.anima` file.

## The rule: canonical files vs editor metadata are separate

The `.character.anima` / `.scene.anima` are the **engine's** canonical,
portable documents — a character runs on the robot standalone. The
app's view state (connector-inference cache, layout, thumbnails, the
revision counter, and Project-asset identity mapping) lives in `project.json`
/ `*.editor.json`, **never in the `.anima`**. This is the "engine owns
`.anima`, app owns editor metadata" policy (`Studio_Bridge.md`) made physical.
Asset references inside a Project Character's `.character.anima` are safe,
relative logical tokens such as `assets/head.stl`; Studio resolves each token
through editor metadata to the Project asset or external bookmark. Exporting a
standalone Character copies its dependencies beside the canonical file so the
export — rather than the editable Project internals — is self-contained.

## Save / Open / Save As flows

- **New Project** → create `~/Documents/AnimaStudio/<name>/` with an
  empty `project.json` (revision 1) and empty `characters/` / `scenes/`.
  The parent workspace is one app preference: it defaults to
  `~/Documents/AnimaStudio/`, can be changed under **Settings → Workspace**,
  and is retained with an app-scoped security bookmark. New/Open/Save As
  panels all create and then open at that exact resolved root; Studio never
  substitutes the Documents parent merely because the default folder is absent
  on first run. A sandboxed first launch asks the operator to select Documents
  once, creates `AnimaStudio` under that granted parent, and persists an
  app-scoped security bookmark; subsequent panels open there directly. Existing
  preferences for the former `Anima Studio` default are migrated to
  `AnimaStudio`; operator-selected custom roots are preserved.
- **Import model** → copy the STEP/STP/STL/OBJ/USD into project
  `assets/models/` by default (or keep a bookmarked Reference in Place), and
  set the imported part's `model` to a safe character-relative logical token
  (`assets/<file>`), plus a `model_node` when the part is one node of a
  multi-node file. The adjacent editor metadata maps that token to a stable
  project asset ID; the app resolves the ID to the copied or external URL.
  Tokens are opaque to the engine — it round-trips the strings and never
  parses the mesh (see the Parts section of `Character_Format.md`). A multi-file
  assembly gives each part its own `model`; a single multi-node USD gives
  several parts a shared `model` with distinct `model_node`s. A multi-node STEP
  follows the same pattern: Open CASCADE/XDE supplies assembly-node names and
  one shared STEP asset remains the project source. STL and OBJ
  are unitless, so Studio records the operator's mm/cm/m interpretation in
  `<character>.editor.json` and converts positions to metres for rendering.
  STEP/STP dimensions are converted from the STEP/XDE document to metres by the
  CAD importer and do not show the unitless-mesh prompt.
- **Publish to Character Library** -> save the active Project Character first,
  then copy its complete self-contained directory to its stable library UUID.
  First publish creates revision 1; each later publish increments the simple
  library revision.
- **Add from Character Library** -> copy the selected library package into
  `characters/`, preserve its canonical and editor files, record the source
  UUID/revision, and generate a safe project-local display/folder name if the
  Project already contains a Character with that name.
- **Save** → for each dirty character/scene, the app hands its rig/scene
  to the engine to **serialize** into canonical text (the engine owns
  `.anima` *writing*, so the format has one author), writes the file,
  copies any new assets, and bumps `project.json`'s revision (the V-badge).
  Atomic (temp-then-replace) so a crash never corrupts the project.
- **Save As** → copy the project folder to a new name/location, bump
  revision, retarget the app's open document.
- **Open** → read `project.json` → for each character, load its
  `.character.anima` through the engine (`load_character`, exists) and
  restore view state from `*.editor.json`.
- **Save Assembly** → write a versioned, reusable
  `assets/assemblies/<name>.animasm` document containing Part/sub-assembly
  references. The Rig Asset Library discovers these files directly and can
  import one into another assembly; the document layer migrates legacy demo
  assembly JSON into the current format on read.
- **Recents** → the gallery tracks project-folder paths (security-scoped
  bookmarks), reading name/revision/thumbnail from each `project.json`.

## Engine serialization contract (BR-SAVE — engine side shipped)

The engine has the write verbs, the inverse of its loaders
(`aether_animation/serialize.py` + the `serialize_character` / `serialize_scene`
bridge verbs; full spec + round-trip guarantee live in
`Studio_Bridge.md` → "Serialization"):

| Verb | params | result |
|---|---|---|
| `serialize_character` | `{rig}` — the full rig DTO (**exactly** the `load_character` rig shape, full-fidelity: identity, parts, joints w/ controls + dofs + limits, parameters, clips w/ keyframes, relations, outputs w/ ranges) | `{text}` — canonical `.character.anima` YAML; invalid rig → `format_error` |
| `serialize_scene` | `{scene}` — the `.scene.anima` document structure | `{text}` — canonical `.scene.anima` YAML; invalid → `format_error` |

Round-trip is the acceptance test: `load_character(text)` →
serialize → `text'` where `load_character(text')` yields an equal rig,
for every file in `examples/` — verified in
`aether_animation/tests/test_serialize.py` and `test_bridge.py`. Serialization
validates (an un-serializable/invalid rig errors) so the app can never
write a broken file. To make the round-trip lossless the engine
**additively** enriched the `load_character` rig summary (clip
`keyframes`, output ranges, per-DOF `axis_vector`/`name`/`description`,
joint `description` — nothing renamed/removed).

The Swift app-side P0 lifecycle shipped on 2026-07-16: `AnimaDocument`
uses `project.json` format version 2, native New/Open/Save/Save As
dialogs rooted at the persisted workspace preference, atomic folder
replacement, active-character asset copying, and security-scoped
bookmark-backed workspace/recents access. The app retains the full
`load_character.rig` JSON value and passes it unchanged to
`serialize_character`; it does not reconstruct or hand-format YAML.

Remaining lifecycle work is scene reopening (`load_scene` does not yet
exist), thumbnail generation, dirty prompts/undo, milestone UI, and
project export to a single `.animastudio` archive. Transitional Swift
proxy component/mate edits also still need a defined projection into
the full-fidelity rig DTO before those edits can be saved canonically.

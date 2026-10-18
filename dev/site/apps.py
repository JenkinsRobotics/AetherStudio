"""Content for every Aether app's README and GitHub Pages site (alpha 0.1).

One entry per repository. Feature status is taken from dev/docs/reality/STATUS.md
and the product roadmaps: "works" = shipped in source and exercised, "progress" =
source candidate or partial, "planned" = roadmap only. Keep it honest; update this
file, then run build_pages.py.
"""

RELEASE = "Alpha 0.1"
ORG = "JenkinsRobotics"

# Shown on every app: what being an Aether app gives you.
SUITE = [
    ("Runs on its own", "Open an app on one machine and work locally. Your files stay on your disk in open, documented formats.", "works", "local install today · downloadable desktop app planned"),
    ("Or on your own server", "Point the apps at an Aether Studio server — a Mac Studio in the office or a rack of machines — and the whole team works from one place.", "works", ""),
    ("Any device", "Every app is a web app first, so laptops, desktops and tablets connect through a browser — no install on the client.", "works", "desktop downloads planned"),
    ("Built-in AI", "Connect ChatGPT, Claude or Gemini once in Studio. Each app's AI advisor edits your open document with the app's own tools — and AI is never required to open or play your work.", "works", ""),
    ("PDM and version control", "Versions, branches, releases and obsolescence for every document, with a visual version graph and restore.", "works", ""),
    ("Multi-user", "One account across every app, shared workspaces, permissions, comments and tasks.", "works", "real-time co-editing in progress"),
    ("Command line and MCP", "Every agent tool is also a CLI command and an MCP tool, with scoped grants, revision guards and retry receipts.", "works", ""),
    ("Open source", "Apache-2.0. Own your tools, your files and your server.", "works", ""),
]

APPS = [
    dict(
        id="cad", ai_status="works", name="Aether CAD", repo="Aether-CAD",
        line="3D parametric parts, assemblies and production drawings.",
        alt="An open alternative to SolidWorks, Onshape and Shapr3D.",
        h1=("Parametric CAD,", "open and agent-ready."),
        tagline="design it, change it, make it",
        lede="Sketch a profile, add features and edit any step of the history. Aether CAD runs a native FreeCAD/OpenCASCADE kernel behind its own feature model, so every part rebuilds exactly — and every action is available to you, your team and your AI.",
        what=[
            "Aether CAD is a feature-based 3D modeller for mechanical parts. You draw constrained sketches, turn them into solids with features like Extrude, Revolve, Sweep and Loft, and keep a full parametric history you can roll back, reorder and edit at any point.",
            "Geometry is computed by a native FreeCAD/OpenCASCADE engine behind a replaceable boundary. Aether owns the document, selection, references and history; the kernel performs the exact operations. Exports are exact STEP, not tessellated approximations.",
        ],
        works=[
            ("Constrained sketching", "Lines, arcs, circles, ellipses, conics and fit splines with free end tangents. Dimensions, geometric constraints, whole-entity Fix and connected-region selection."),
            ("Extrude, fully featured", "Blind, symmetric, through-all, up to next / face / part / vertex, signed end offsets, draft, thin walls, independent ends and multi-region profiles with holes."),
            ("Revolve, Sweep, Loft, Shell", "Directional and symmetric revolve extents, native sweep and loft, shell, Hole, Draft, fillet and chamfer, patterns, Booleans, mirror and part transform/copy."),
            ("Editable history", "Roll back, suppress, reorder and edit any feature; live native previews with Cancel/Apply; undo/redo; strict rebuild errors you can recover from."),
            ("Exact import and export", "Import STEP, IGES and BREP solids and STL/OBJ/PLY/OFF meshes (with closed-mesh-to-solid conversion). Export exact STEP and STL."),
            ("Inspect and analyse", "Measurements, angular inspection, capped section views and native volume interference between bodies."),
        ],
        progress=[
            ("Assemblies", "Mates against the native solver — fastened, revolute and prismatic today; the full joint set, limits, nested assemblies and BOM are next."),
            ("References that survive edits", "Stable face and edge identity through upstream dimension changes, splits and merges."),
            ("Fluid previews on big parts", "Revision-aware incremental evaluation, measured against cold rebuilds."),
            ("Variables and configurations", "Expressions, units and configuration tables driving parts and assemblies."),
        ],
        planned=[
            ("Production drawings", "Associative views, dimensions, tolerances, sections, title blocks and PDF/DXF output that update with the model."),
            ("Sheet metal and frames", "Flanges, bends, flat patterns, frame profiles and cut lists."),
            ("Surface modelling", "Surface authoring, continuity, trim, stitch and thicken."),
            ("Release and manufacturing", "Released BOMs and drawings, rendering, simulation and CAM integrations."),
        ],
        ai=[
            "Inspect a part's features and exact faces, then create rectangle, circle and polygon sketches and extrude or revolve them.",
            "Preview and change extrusion depth, Up-to-next end offsets and revolve extents; suppress, restore and reorder features.",
            "Every edit rebuilds through the native kernel and lands in the normal history and save flow — undo works exactly as if you had clicked it.",
        ],
        ai_example="“Create a 40 × 20 mm rectangle on the XY plane and extrude it 5 mm.”",
        studio_extra="Parts and assemblies live in Drive with versions, branches and releases; teammates review the same model, comment on it and pick up tasks.",
        roadmap=[
            ("Alpha 0.1", "Part modelling", "Sketching, the core solid features, editable history, exact STEP exchange and agent tools."),
            ("Alpha 0.2", "Assemblies", "The full mate set, robust references and configurations."),
            ("Beta", "Drawings and release", "Associative production drawings, BOMs and release workflows; desktop download."),
        ],
    ),
    dict(
        id="animation", ai_status="planned", name="Aether Animation", repo="Aether-Animation",
        line="Animate characters and animatronics, then play the motion on real servos.",
        alt="An open alternative to Bottango.",
        h1=("Animate it on screen,", "play it on the machine."),
        tagline="one performance, every output",
        lede="Import a character or robot, define how it moves, animate it on a timeline and send the same evaluated motion to a 3D preview, a 2D character, or real servos and controllers. The flagship of the Aether apps.",
        what=[
            "Aether Animation is motion authoring for digital characters and physical audio-animatronic figures. A rig describes parts, joints and limits; clips and poses describe the performance; one engine evaluates it.",
            "The same evaluated motion drives the preview, the hardware and headless show playback. Vendor channel details never enter the animation itself — outputs are adapters, so a show can move from a simulator to real hardware without being re-authored.",
        ],
        works=[
            ("One animation engine", "Rigs with mates, joint limits and relations; kinematics (including DH chains); pose resolution, validation and evaluation in a renderer-independent engine."),
            ("The .anima format", "Characters and scenes saved in a versioned, documented format with validation and migration."),
            ("Headless show playback", "Scenes play without the editor: clips, poses, waits, event gates, variables and branches, loops and deterministic parallel tracks."),
            ("Hardware wire protocol", "A versioned wire protocol with a simulator and serial transport, so output can be proven before it reaches a servo."),
            ("Web workspace", "The animation workspace on the shared Aether interface: viewport, pose panel, mate and relation dialogs and a timeline."),
        ],
        progress=[
            ("Rig and joint authoring", "Typed joint editing, placement and handles directly in the viewport."),
            ("Keyframe editing", "Editable keys and ranges, curves, interpolation and auto-key on the timeline."),
            ("Hardware output", "Actuator mapping with inversion, neutral and limits, and explicit arm/disarm with failsafe."),
        ],
        planned=[
            ("Servo and controller drivers", "Hobby servos and PCA9685 first, then steppers, DYNAMIXEL and custom channels."),
            ("Audio and video sync", "Waveforms, media tracks and lip-sync timing."),
            ("Puppeteering", "Record live input from controllers onto tracks, with layering and smoothing."),
            ("Advanced motion", "Pose blending, look-at, inverse kinematics and velocity-aware motion planning."),
        ],
        ai=[
            "The AI advisor comes to Animation through the same tool contract as every Aether app: inspect the rig, pose it and key it, with normal undo.",
            "AI is an authoring aid only: saved animation never requires an AI model to play, on screen or on hardware.",
        ],
        ai_example="“Blink both eyes twice over one second, then turn the head 20° to the left.”",
        studio_extra="Characters, scenes and media live in Drive; shows deploy to players on the network; the team shares rigs and reviews performances together.",
        roadmap=[
            ("Alpha 0.1", "Engine and format", "The animation engine, .anima files, headless playback and the wire protocol with its simulator."),
            ("Alpha 0.2", "Author on the timeline", "Rig, joint and keyframe editing in the web workspace."),
            ("Beta", "First servo", "Actuator mapping and live output to a real servo, safely armed."),
        ],
    ),
    dict(
        id="map", ai_status="works", name="Aether Map", repo="Aether-Map",
        line="Projection mapping and unattended show playback on Raspberry Pi players.",
        alt="An open alternative to MadMapper and Resolume.",
        h1=("Map light onto anything,", "then walk away."),
        tagline="author in the browser · play on a Pi",
        lede="Warp video, shaders and effects onto real buildings, sets and props in the browser, perform it live with faders and MIDI, then deploy the show to Raspberry Pi players that run it unattended — even with the network unplugged.",
        what=[
            "Aether Map is projection mapping and show control. You build scenes of mapped surfaces, put media, shaders and effects on their timelines, and preview exactly what each projector will show.",
            "Outputs bind explicitly to scenes, so a show plays the same in rehearsal and on site. Players download the show, cache it, and switch to updates atomically — a failed update never breaks the running show.",
        ],
        works=[
            ("Surfaces and masks", "Quads, curves and shapes with corner warp, welded corners, masks and cutouts, cube and box groups, and precise numeric controls."),
            ("Scenes and timelines", "Per-surface timelines, a reusable media pool, cue tracks and an audio mixer that belongs to the timeline."),
            ("Effects and shaders", "An effects library and shaders with parameter motion, body modulation and a visual gallery."),
            ("Perform live", "Full-window performance faders with automation takeover, locks and undo, and MIDI controllers with feedback."),
            ("Raspberry Pi players", "A Wi-Fi setup wizard, pairing, authorised deployment and offline playback with atomic, retrying updates."),
            ("Exports", "Show ZIP and wireframe SVG exports with the exact document and referenced media."),
        ],
        progress=[
            ("More receivers", "Android TV receiver, QR pairing and more reliable live casting."),
            ("3D pose mapping", "Three linked faces posed in 3D, including inside room corners."),
            ("Online assets and keying", "Online visual libraries and green-screen keying."),
            ("Hardware qualification", "Physical Pi boot, Wi-Fi, output and power-loss acceptance."),
        ],
        planned=[
            ("Edge blending", "Soft-edge blending across overlapping projectors."),
            ("Audio-reactive visuals", "Drive effects from live audio."),
            ("Show-wide sync", "One timeline across projection, animation, lighting and audio."),
        ],
        ai=[
            "Inspect a show, create scenes and surfaces, size and rotate surfaces, place pool assets on tracks, move and edit clips — on the open show with normal undo and autosave, or on saved shows through the CLI and MCP.",
            "Agents can request a read-only calibration mask of a scene; composition is evaluated as data, so changes are verifiable.",
        ],
        ai_example="“Create a surface named Front wall, size it to 800×450 at 100,150, and place the Red asset on its video track.”",
        studio_extra="Shows and media live in Drive; Studio pairs and deploys players across the venue network and tracks which show each output runs.",
        roadmap=[
            ("Alpha 0.1", "Author and play", "Surfaces, timelines, effects, live performance controls and offline Pi playback."),
            ("Alpha 0.2", "More outputs", "Android TV, QR pairing, live casting and qualified Pi hardware."),
            ("Beta", "Multi-projector", "Edge blending and show-wide synchronisation."),
        ],
    ),
    dict(
        id="sketch", ai_status="works", name="Aether Sketch", repo="Aether-Sketch",
        line="Drawing and sketching — clean vector paths today, expressive brushes next.",
        alt="An open alternative to Adobe Photoshop Sketch and Procreate.",
        h1=("Draw the idea,", "keep every line editable."),
        tagline="quick ideas, clean paths",
        lede="Sketch concepts, markups and visual ideas with a fast vector canvas: pens, shapes, layers and text that stay editable. The same drawing foundation powers the masks in Aether Map and profiles in Aether CAD.",
        what=[
            "Aether Sketch is the suite's drawing app. Today it is a vector sketching editor built on the shared Aether sketch foundation: every stroke is an editable path you can reshape, combine and export.",
            "Pressure-sensitive freehand brushes are the next step. Because Sketch, Map and CAD share one geometry layer, a shape drawn here behaves the same way in the other apps.",
        ],
        works=[
            ("Pen and paths", "Open and closed pen, retained cubic curves, node modes, break, join and reverse."),
            ("Shapes and text", "Rectangles, ellipses and editable text with fills and strokes."),
            ("Layers and groups", "Nested layers and groups, multi-path transforms and snapping."),
            ("Path operations", "Trim, offset contours, Booleans and compound shapes with holes."),
            ("Open files", "Local save and reopen, an SVG import subset and SVG export; full undo."),
        ],
        progress=[
            ("Stylus and touch", "Physical stylus, touch and Safari qualification."),
            ("Exact curves", "Analytic conics and exact curve Booleans."),
        ],
        planned=[
            ("Expressive brushes", "Pressure- and tilt-sensitive freehand brushes."),
            ("Raster canvas", "Painting layers alongside vector paths."),
            ("Markup", "Annotate CAD parts, maps and documents from Drive."),
        ],
        ai=[
            "Agents inspect the drawing, add layers, draw rectangles, ellipses, paths and text, transform and style shapes, delete and undo — each batch validated and saved through the normal flow.",
            "Locked and hidden content is protected from agent edits.",
        ],
        ai_example="“Draw a blue rectangle and an orange circle on Layer 1.”",
        studio_extra="Drawings live in Drive beside the parts and shows they explain, with versions and comments.",
        roadmap=[
            ("Alpha 0.1", "Vector sketching", "Pens, shapes, layers, path operations and SVG exchange."),
            ("Alpha 0.2", "Pen and touch", "Qualified stylus and touch input."),
            ("Beta", "Brushes", "Pressure-sensitive freehand brushes and raster layers."),
        ],
    ),
    dict(
        id="io", ai_status="planned", name="Aether IO", repo="Aether-IO",
        line="Electronics and wiring for motion hardware.",
        alt="Schematics, boards and harnesses for the machines you animate.",
        h1=("The electronics behind", "every moving part."),
        tagline="controllers · signals · wiring",
        lede="Aether IO is where the electronics live: the controllers, signals, wiring and connections between your animation and real hardware. This alpha is an interface draft — the electrical engine comes next.",
        what=[
            "Aether IO brings PCB design, component-level wiring, circuit testing and, eventually, firmware execution into the same suite as the parts and performances they drive.",
            "The alpha ships the workspace — schematic, board, simulation setup, 3D inspection and manufacturing preparation — so the workflow can be reviewed before the engine behind it is chosen. Nothing here claims simulation results yet.",
        ],
        works=[
            ("Interface draft", "Seven workspace routes on the shared Aether interface: schematic, board, simulation setup, 3D inspection, manufacturing preparation and more."),
            ("Agent pane", "Objects and checks on the left, the design in the centre, a conversation with your agent on the right."),
        ],
        progress=[
            ("Electrical document", "Symbol instances, pin maps, named nets, sheets, and separate schematic, board and assembly placement."),
        ],
        planned=[
            ("Circuit simulation", "A validated solver for DC and transient results behind a product-owned boundary."),
            ("PCB layout", "Footprints, layers, copper routing, ERC/DRC and verified Gerber/drill output."),
            ("Firmware in the loop", "Compile and emulate supported microcontrollers against the same circuit."),
            ("Harness wiring", "Assembly modules, cable harnesses and 3D preview with Aether CAD."),
        ],
        ai=[
            "The workspace is designed around an agent conversation from the start; AI suggestions will remain editable inputs, never hidden results.",
        ],
        ai_example="“Add a PCA9685 servo driver and wire channels 0–3 to the head servos.”",
        studio_extra="Boards and harnesses will live in Drive next to the CAD parts and animations they connect.",
        roadmap=[
            ("Alpha 0.1", "Interface draft", "The workspace and workflow, ready for review."),
            ("Alpha 0.2", "Electrical document", "Nets, pins and sheets with save and exchange."),
            ("Beta", "Simulate and lay out", "Circuit simulation and PCB layout with design-rule checks."),
        ],
    ),
    dict(
        id="vector", ai_status="planned", name="Aether Vector", repo="Aether-Vector",
        line="Vector illustration and graphic design.",
        alt="An open alternative to Adobe Illustrator and Affinity Designer.",
        h1=("Artwork that stays sharp", "at any size."),
        tagline="logos · icons · diagrams · artwork",
        lede="Aether Vector will be the suite's illustration app for logos, icons, diagrams and artwork. It is planned for after the first release; this alpha holds the app shell and shares the vector foundation already working in Aether Sketch.",
        what=[
            "Aether Vector is the professional illustration tool of the suite: precise paths, typography, symbols and export for print and screen.",
            "Its geometry comes from the shared Aether sketch foundation — the same paths, Booleans and contours used by Sketch, Map and CAD — so artwork moves between apps without conversion.",
        ],
        works=[
            ("App shell", "The application frame on the shared Aether interface, ready for the editor."),
            ("Shared vector foundation", "Paths, curves, Booleans and contours, proven in Aether Sketch."),
        ],
        progress=[],
        planned=[
            ("Illustration editor", "Pen, shapes, gradients, strokes and appearance stacks."),
            ("Typography", "Text on paths, font outlining and type controls."),
            ("Symbols and libraries", "Reusable symbols, swatches and shared libraries across a team."),
            ("Export", "SVG, PDF and raster export for print and screen."),
        ],
        ai=[
            "Vector will use the same agent tool contract as Sketch: inspect, draw, style and transform with normal undo.",
        ],
        ai_example="“Turn this logo into a one-colour icon set at 16, 24 and 32 px.”",
        studio_extra="Brand assets and libraries will live in Drive, shared and versioned across the team.",
        roadmap=[
            ("Alpha 0.1", "App shell", "The application frame and shared vector foundation."),
            ("After 1.0", "Illustration editor", "The full editor, typography and export."),
        ],
    ),
    dict(
        id="studio", ai_status="works", name="Aether Studio", repo="AetherStudio",
        line="Your team's server: accounts, shared files, versions and live collaboration.",
        alt="Aether Drive, accounts and PDM — on your own hardware.",
        h1=("Your company's", "design server."),
        tagline="one server · every app · every device",
        lede="Aether Studio runs on your own hardware — a Mac Studio in the office or a farm of servers — and gives every Aether app one place for accounts, files, versions, AI connections and live collaboration. Aether Drive ships inside it.",
        what=[
            "Aether Studio is the server behind the Aether apps. It hosts the apps, stores every document with full version history, manages accounts and permissions, and connects your AI providers once for every app.",
            "It is built for performance first: a native server designed for hundreds of simultaneous live connections on modest hardware, with Raspberry Pi players and any browser as clients.",
        ],
        works=[
            ("Aether Drive", "My files, Shared, Recycle bin, workspaces and organisations; drag-and-drop upload, previews and an Admin Center."),
            ("Versions and branches", "Branch storage, a visual version graph, releases and obsolescence, restore and recovery for every document."),
            ("Accounts and sharing", "One sign-in across every app, account preferences, permissions and shared workspaces."),
            ("Comments and tasks", "Discuss a document and assign work beside it."),
            ("AI connections", "Connect ChatGPT, Claude or Gemini once under Plugins → My connections; every app's AI advisor uses it."),
            ("CLI and MCP", "A native agent bridge with scoped grants, explicit receipts and revision-guarded commands for every app."),
            ("Player deployment", "Pairs and deploys Aether Map shows to Raspberry Pi players."),
        ],
        progress=[
            ("Concurrent editing", "Real-time co-editing inside each app, with conflict handling on branches."),
            ("Company network", "A trusted company-network address for every device on site."),
            ("Scale", "Measured performance for hundreds of live connections."),
        ],
        planned=[
            ("Desktop downloads", "Each app as a downloadable desktop app, standalone or connected."),
            ("Approvals", "Review and release approval workflows with audit history."),
            ("Fleet", "Set up, update and monitor players and controllers across sites."),
        ],
        ai=[
            "Studio owns the connection to your AI provider and grants each app's agent only the tools that app exposes.",
            "Every agent operation is scoped, revision-checked and recorded with a receipt, and the same tools are available from the command line and MCP.",
        ],
        ai_example="aether-agent run map.scene.create --operation-id create-side-scene < scene.json",
        studio_extra="",
        roadmap=[
            ("Alpha 0.1", "Server and Drive", "Native server, Drive, accounts, versions, comments, AI connections and the agent bridge."),
            ("Alpha 0.2", "Live together", "Concurrent editing and the company-network address."),
            ("Beta", "Downloads and approvals", "Desktop apps, approvals and fleet management."),
        ],
    ),
]

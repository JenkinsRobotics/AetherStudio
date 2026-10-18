# Importing Fusion 360 models with their features

Jonathan, 2026-10-04: *"Is it at all possible to support a Fusion 360 model
import that contains the CAD sketches, extrusions etc?"*

**Yes — but not by opening a `.f3d` file.** The route is an add-in running inside
Fusion that walks its timeline and writes our format. That is the only way
anyone gets editable features out of Fusion, and our side is unusually well
placed to receive them.

## 1. What Fusion will and will not let out

| Route | Carries sketches and features? | Verdict |
|---|---|---|
| `.f3d` / `.f3z` native file | — | **Proprietary and undocumented.** Don't |
| STEP, IGES, SAT, SMT | No — B-Rep solids only | Works today, geometry only |
| STL, OBJ, 3MF | No — meshes | Not relevant |
| DXF / DWG | Flat curves only, no 3D features | Partial, for sketches alone |
| **Fusion API add-in** | **Yes — the whole timeline** | **The answer** |

Autodesk publishes no specification for `.f3d`. It is a container around
Fusion's internal representation, it changes between releases, and anything
recovered from it would be Autodesk's internals rather than a feature tree we
could trust. Reverse-engineering it is the one approach to rule out.

What Autodesk *does* publish is the Fusion API. A Python add-in has
`design.timeline` — every feature in order, with its type and parameters — and
`sketch.sketchCurves` and `sketch.geometricConstraints` with the curves and
constraints as authored. An add-in reads those and writes an `.acpart`. This is
a well-trodden path; Fusion-to-other-CAD exporters are built this way.

## 1b. "Can we not just export a `.f3d` and reverse-engineer it?"

A fair question, and the answer is not simply "it's proprietary". It is that
doing so stacks three separate problems, and the one you actually care about is
the worst of them while the other two buy you nothing.

**The container.** Publicly undocumented, but containers usually yield. Assume
for argument that it opens.

**The geometry inside is the wrong family for our kernel.** Fusion models on
Autodesk Shape Manager, a descendant of ACIS. We model on OCCT. I checked what
the vendored FreeCAD can actually read: `Part/App` ships importers for BREP,
IGES and STEP, and **nothing for ACIS or SAT**. So extracted Shape Manager
geometry would need an ACIS reader written before a single face appeared on
screen — a substantial project on its own. And it would buy nothing, because
**Fusion already exports that same geometry as STEP, which we already import.**

**The timeline is the only part worth having, and it is the most opaque.** It is
Autodesk's own schema for their own application, with no published description,
no stability guarantee, and every reason to change between releases. An importer
built on it is a maintenance commitment against a target that moves whenever
Autodesk ships.

So the effort lands exactly backwards: the two tractable layers duplicate what
STEP already gives for free, and the valuable layer is the one with no
specification and no stability. Against that, the add-in reads the same timeline
through a documented API, in a few hundred lines, and keeps working across
releases.

There is also a licensing question. Autodesk's terms generally restrict
reverse-engineering, and shipping that capability in a product we intend to sell
is a commercial risk, not just a technical one. Worth a lawyer's opinion before
anyone writes code, not after.

**The one case reverse-engineering would serve**, and it is worth naming because
it is probably the real question: accepting a `.f3d` from someone who does not
have Fusion, or will not run an add-in, *and* needing their feature history. The
add-in route cannot serve that person — it needs a Fusion seat. But neither can
reverse engineering, realistically: they would get geometry, which a STEP export
gives them with one menu click and no risk. For that user the honest answer is
"send a STEP", and the feature history is simply not available to them at any
price we would sensibly pay.

## 2. Why our side is in good shape

This is the part that makes the project worth doing rather than merely possible.

**Our feature vocabulary already matches Fusion's core set.** `Aether CAD/src/features/`
holds extrude, revolve, sweep, loft, fillet, chamfer, shell, draft, mirror,
pattern, hole and boolean. That is essentially everything a typical Fusion part
uses.

**We have a real constraint solver**, not a sketch viewer:
`Aether CAD/aether-engine/src/sketch/solver/` is 5,832 lines supporting
coincident, concentric, midpoint, parallel, perpendicular, horizontal, vertical,
tangent, equal, symmetric, plus distance, angle, radius and diameter dimensions.
Against Fusion's constraint set that is fourteen of roughly seventeen.

**Our document format is a plain JSON feature list** — a declarative array where
a profile feature carries the sketch and later features reference it by id. It
is a direct write target for an add-in; no binary encoder is needed.

**Known gaps on our side**, each small and worth closing anyway:

- Constraints: **collinear**, **fix/unfix**, and **curvature (G2)** are absent.
- Curves: we have line, arc, circle, ellipse, bezier and point. Fusion also has
  **NURBS splines** and **conics**; a NURBS would have to be approximated or the
  curve type added.
- Features Fusion has that we do not: rib, web, thread, emboss, surface
  modelling and sheet metal. A part using these cannot round-trip fully.

## 3. The part that actually decides it

**Topological references.** A fillet is not "a 2mm fillet"; it is "a 2mm fillet
*on these edges*". Fusion names those edges with its own internal identifiers.
We identify them with geometric queries — the wheel example's fillet reads
`{"plane": "XY", "offsetMillimeters": 3}`.

Neither identifier survives the trip. Fusion's ids mean nothing in our rebuild,
and our queries do not exist in Fusion. Resolving "which edge did they mean"
after re-executing the sketch and the extrude is the classic persistent-naming
problem, and it is where this kind of importer fails rather than at the file
format.

That suggests splitting the work by how a feature identifies its input:

- **Geometry-defined features** — sketches, extrudes, revolves, sweeps, lofts,
  holes placed on sketch points. These are defined by numbers and a profile, so
  they translate cleanly and arrive fully editable. In most parts this is the
  large majority of the timeline.
- **Topology-referencing features** — fillets, chamfers, shells, drafts, face
  patterns. These need the edge resolved by geometric matching after rebuild —
  position, adjacent faces, convexity — with a confidence score. Where
  confidence is low, import the feature suppressed and say so, rather than
  silently filleting the wrong edge.

Also needing explicit mapping: units, user parameters and expressions (Fusion
allows `width/2 + 3`, so either evaluate to a number and lose the relationship,
or carry the expression), construction planes and axes, and timeline rollback
state. Assemblies and joints are a separate and larger problem than parts.

## 4. Suggested shape

1. **Today, no work:** export STEP from Fusion. Geometry arrives as one solid,
   not editable as features. This is already supported and is the right answer
   for "I just need the shape".
2. **Stage one:** a Fusion add-in writing `.acpart` for sketches, extrudes and
   revolves — the geometry-defined majority. Prove it on real parts and measure
   what fraction of each timeline survives.
3. **Stage two:** topology-referencing features with geometric edge resolution
   and an honest confidence report per feature.
4. **Stage three:** parameters and expressions, then assemblies.

A fair acceptance measure for stage one is the share of timeline features that
import editable, reported per part, with anything unresolved listed by name
rather than dropped.

## 4b. Parked: rebuilding the feature tree from geometry

Jonathan, 2026-10-04: *"Down the line I might want to implement an AI rebuilder
or recreator, but we can handle that in the future."* Parked, not dismissed —
and worth a note on why it is the strongest of the three routes, so the reasoning
survives until it is picked up.

**It sidesteps everything above.** Such a system reads B-Rep solids and proposes
a feature history: this face set is an extrude of that profile, this is a
revolve, these edges are a 2mm fillet. That means it works from **STEP**, which
we already import. So it is not a Fusion feature at all — it serves SolidWorks,
Onshape, Inventor, a supplier's STEP file and a decade-old archive equally. The
format question that dominates the rest of this document simply does not arise.

**It is an established field, not speculation.** Feature recognition from
boundary representation has decades of literature — graph-based methods over the
face-adjacency graph for prismatic features, with learned approaches more recent.
It is hard and partial, not unknown.

**We are unusually well positioned to emit the result.** Such a system is only
as useful as the vocabulary it writes into, and ours is already there: extrude,
revolve, sweep, loft, fillet, chamfer, shell, draft, mirror, pattern, hole, plus
a real constraint solver for the sketches it would need to infer. The hard part
of these projects is often that the target format cannot express the recovered
intent. Ours can.

**The discipline it needs is the same one §3 and §5 ask for.** A recogniser is
probabilistic: it will propose a fillet that was really a chamfer, or miss that
two bosses were one patterned feature. So it must propose rather than assert —
features arriving with a confidence, the person confirming or rejecting, and
anything unrecognised left as the imported solid rather than silently reshaped.
A recogniser that quietly guesses wrong is worse than no recogniser, for exactly
the reason a silent importer is.

Sequencing note: this is strictly *after* a working geometry import and the
feature vocabulary being stable, because it writes into that vocabulary. It also
makes the Fusion add-in less urgent rather than more — if geometry alone can be
rebuilt into editable features, the add-in becomes a fidelity optimisation for
people who happen to own Fusion, not the only road in.

## 5. Two cautions

**Report what did not survive.** An importer that silently drops a feature is
worse than one that refuses, because the person finds out when a dimension
change rebuilds the part wrongly. Every skipped or low-confidence feature should
be visible in the tree.

**Direction of effort.** This is import fidelity, which the platform review
names as the suite's real compatibility moat — it is how someone's existing work
gets in. It is worth more than most new features. But it is also a long tail:
the first eighty per cent of a typical timeline is achievable, and the last
twenty per cent is where every CAD interop project spends most of its life.

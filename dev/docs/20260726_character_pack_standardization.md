# Character pack format — needs standardizing

> **Status:** open. Two formats describe the same character today.
> Dated 2026-07-26. Nothing here is implemented.
>
> **Companion note:** the same doc ships in JaegerAnimation
> (`dev/docs/20260726_character_pack_standardization.md`). This is a
> two-project decision; neither side should settle it alone.

## Why this exists

Anima Studio **authors** characters. JaegerAnimation **runs** them. The
character pack is the only thing that crosses between the two projects —
neither imports the other, by design, and that is not going to change:
Anima Studio also targets its own Swift app and ESP32 firmware, so it can
never depend on JaegerOS.

That makes the pack format the single load-bearing contract. It is
currently **two formats**.

## The concrete case

`examples/assets/2d/packs/emotes/` — nine pixel-art emotions in two mouth
states on one 9x2 sheet. Deliberately placed carrying JaegerAnimation's
manifest **unconverted**, so the standardization work has one real
character described both ways to argue against instead of a hypothetical.

The same character also ships inside JaegerAnimation at
`jaeger_animation/assets/characters/emotes/`.

## How the two differ

| | AnimaCore `pack/v1` | JaegerAnimation `character/v1` |
|---|---|---|
| Defined in | `aether_animation/pack.py` | `jaeger_animation/characters.py` |
| Manifest | `pack.yaml` | `character.yaml` |
| Identity | `id` | `character` |
| Unit of address | **slot** — a flat name | **expression x mouth state** — two axes |
| Slot value | `{file, columns, rows, index}` | `{column: n}` + a shared row axis |
| Adapter | `default_adapter` on the pack | `render.adapter` |
| Grid | per slot | once, in `render.grid` |
| Default | `default_slot`, `preview_slot` | `default_expression`, `default_mouth` |
| Kind | *(none)* | `kind:` — sprite_sheet / clip_set / procedural / rig |
| Validation | `id` non-empty; defaults must exist | strict: schema, kind, asset exists, columns inside the grid, defaults declared |

Both loaders read the shipped character successfully **in their own
format**. Neither reads the other's.

## The real disagreement

Not naming — naming is trivial to settle. The substance:

**1. One axis or two.** `pack/v1` has a flat slot namespace
(`happy_closed` is just a string). `character/v1` splits expression from
mouth state, so a caller can hold a mood and flap the mouth
independently. Two axes make lip-sync expressible; one axis makes
arbitrary slot sets expressible. A pack of unrelated one-off animations
does not have a second axis, and forcing one on it is wrong.

**2. Where the grid lives.** Per-slot (`pack/v1`) allows one pack to span
several sheets with different layouts. Once-per-pack (`character/v1`) is
less repetitive and cannot drift between slots. These trade off directly.

**3. Whether `kind` belongs in the pack.** `character/v1` declares
`sprite_sheet | clip_set | procedural | rig`, which is what tells a
runtime whether it can play the pack at all. `pack/v1` infers it from
`default_adapter`. The rig case is the interesting one — Anima Studio's
`.character.anima` mechanism rigs are a genuinely different thing from a
sprite sheet, and a runtime that cannot drive a rig should be able to say
so before trying.

## What we need to do

1. **Decide axes.** Probably: a flat slot map is the primitive, with an
   *optional* declared axis set (`expression` x `mouth`) layered on top,
   so a lip-sync face and a bag of one-off clips both fit.
2. **Decide grid placement.** Likely per-asset with a pack-level default,
   which collapses to `character/v1`'s brevity for the common case
   without losing `pack/v1`'s multi-sheet capability.
3. **Adopt `kind`** — a runtime must be able to refuse a pack it cannot
   play, rather than rendering nothing.
4. **Agree validation strictness.** JaegerAnimation's loader is strict
   and names the offending file (a pack that silently renders the wrong
   face is worse than one that refuses). AnimaCore's is permissive.
   Strict is the right default for a format crossing project boundaries.
5. **Write ONE schema doc**, owned jointly, and have both loaders cite
   it.
6. **Keep the `emotes` pack as the conformance fixture** — one character,
   both runtimes, byte-identical output. That is the test that proves the
   format works rather than merely being agreed.

## Why not just converge now

Two independent implementations of one format is the strongest test a
format can get, and both are still young enough to be learning what they
need. Converging early would freeze whichever set of assumptions happened
to ship first. Converge when a real consumer needs one pack to run in
both places — Mochi and JP01 are that consumer, and neither is there yet.

**Do not** resolve this by making one project import the other. The
independence is the point.

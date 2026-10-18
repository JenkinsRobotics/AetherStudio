/**
 * `@aether/ui/animation-mockup-widgets` — the Aether Animation Mockup kit, ported from the
 * SwiftUI mockup that lived at `dev/archive/the archived native studio app` (removed
 * 2026-09-23 once this port was accepted; it is in git history) one struct to
 * one component. Namespaced on purpose: several names (StatusBar, SearchField,
 * DocumentTabs, Slider…) also exist in the main entry as different designs.
 * They are additional variants, kept side by side until the consolidation pass
 * in dev/docs/roadmap/Animation_Mockup_Web_Port.md picks the survivors.
 */
import "./kit/widgets.css";

export * from "./kit/icons";
export * from "./kit/state";
export * from "./kit/widgets";
export * from "./kit/viewport";
export * from "./kit/graph";
export * from "./kit/tree";
export * from "./kit/shell";

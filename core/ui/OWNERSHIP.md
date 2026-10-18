# Shared UI ownership audit — 2026-10-09

The source audit found no CAD/Animation engine import and no product API endpoint
in shared UI. `FilePreview` fetches a URL supplied by its caller, which is generic
preview behavior. Application catalog/network access is in the session package.
CAD's engine-backed gallery examples already live in CAD.

| Widget group | Disposition and boundary |
| --- | --- |
| HarnessConnectorCard, wire/pin presentation | Retain shared SVG presentation used by IO and the CAD harness reference; products own topology, electrical rules and connections. |
| CircuitSymbol | Retain the shared artwork renderer. IO owns circuit data and behavior. |
| SignalMonitor | Retain normalized trace presentation. Callers supply values; no synthetic signal or device protocol is produced. |
| MaterialBrowser and MaterialEditor | Retain color/channel/list presentation shared by reference workspaces. Products own material assignment and renderer settings. |
| RelationEditor | Retain callback-driven fields. Animation owns supported kinds, compatibility, units, validation and evaluated relationships. |
| SequenceEditor | Retain the explicitly labelled local authoring specimen used by the UI gallery/tests. It is not a production timeline engine or persisted document; production apps own timeline operations. |

These widgets do not authorize importing product engines into UI. Their names
are not a reason to duplicate their presentation in each product. New domain
operations must be implemented in a product adapter. Local examples remain
examples, never the canonical evaluator or storage format.

// Presentation inventory transcribed from UIDevVariantBoardCatalog.swift.
export const nativeVariants = [
  {
    "id": "documentChrome",
    "title": "Document Header",
    "detail": "Project identity, save state, and live output.",
    "family": "workspaceChrome",
    "width": 1280,
    "height": 44,
    "state": "DOCUMENT"
  },
  {
    "id": "workspaceRibbon",
    "title": "Workspace + Ribbon",
    "detail": "Workspace selector with contextual creation tools.",
    "family": "workspaceChrome",
    "width": 1280,
    "height": 150,
    "state": "EXPANDED"
  },
  {
    "id": "compactWorkspaceChrome",
    "title": "Compact Workspace",
    "detail": "Collapsed command row for viewport-first work.",
    "family": "workspaceChrome",
    "width": 1280,
    "height": 82,
    "state": "COMPACT"
  },
  {
    "id": "navigatorEmpty",
    "title": "Navigator \u00b7 Empty",
    "detail": "First-use structure with a clear next action.",
    "family": "sidePanels",
    "width": 320,
    "height": 520,
    "state": "EMPTY"
  },
  {
    "id": "navigatorHierarchy",
    "title": "Navigator \u00b7 Populated",
    "detail": "Groups, components, mates, and assets.",
    "family": "sidePanels",
    "width": 320,
    "height": 520,
    "state": "ACTIVE"
  },
  {
    "id": "agentDocked",
    "title": "Aether Agent \u00b7 Docked",
    "detail": "In-app assistant constrained to the workspace.",
    "family": "sidePanels",
    "width": 360,
    "height": 560,
    "state": "DOCKED"
  },
  {
    "id": "componentInspector",
    "title": "Component",
    "detail": "Identity, transform, visibility, and selection actions.",
    "family": "inspectors",
    "width": 340,
    "height": 520,
    "state": "SELECTED"
  },
  {
    "id": "mateInspector",
    "title": "Mate",
    "detail": "Type, connectors, offsets, limits, and solve actions.",
    "family": "inspectors",
    "width": 350,
    "height": 540,
    "state": "EDITING"
  },
  {
    "id": "appearanceInspector",
    "title": "Appearance",
    "detail": "Palette, material, opacity, and quality controls.",
    "family": "inspectors",
    "width": 340,
    "height": 520,
    "state": "APPEARANCE"
  },
  {
    "id": "hardwareInspector",
    "title": "Hardware",
    "detail": "Driver, safety, device, channel, and heartbeat state.",
    "family": "inspectors",
    "width": 360,
    "height": 500,
    "state": "OFFLINE"
  },
  {
    "id": "dopeSheetTimeline",
    "title": "Dopesheet",
    "detail": "Dense rows, frame ruler, keys, and blue playhead.",
    "family": "timelines",
    "width": 1080,
    "height": 460,
    "state": "KEYFRAMES"
  },
  {
    "id": "motionCurveTimeline",
    "title": "Motion Curves",
    "detail": "Value-aware paths connecting authored waypoints.",
    "family": "timelines",
    "width": 1080,
    "height": 460,
    "state": "CURVES"
  },
  {
    "id": "showControlTimeline",
    "title": "Show Control",
    "detail": "Character, audio, video, and event lanes.",
    "family": "timelines",
    "width": 1080,
    "height": 420,
    "state": "SHOW"
  },
  {
    "id": "emptyTimeline",
    "title": "Empty Timeline",
    "detail": "First track action and transport without authored motion.",
    "family": "timelines",
    "width": 1080,
    "height": 300,
    "state": "EMPTY"
  },
  {
    "id": "commandToolbar",
    "title": "Command Toolbar",
    "detail": "Default grouped viewport and authoring commands.",
    "family": "toolbars",
    "width": 720,
    "height": 84,
    "state": "DEFAULT"
  },
  {
    "id": "selectionToolbar",
    "title": "Selection Toolbar",
    "detail": "Selected tools retain icon, label, and state.",
    "family": "toolbars",
    "width": 720,
    "height": 84,
    "state": "SELECTED"
  },
  {
    "id": "disabledToolbar",
    "title": "Unavailable Tools",
    "detail": "Planned commands remain legible and explainable.",
    "family": "toolbars",
    "width": 720,
    "height": 84,
    "state": "DISABLED"
  },
  {
    "id": "verticalToolRail",
    "title": "Vertical Tool Rail",
    "detail": "Compact mode and property-family navigation.",
    "family": "toolbars",
    "width": 76,
    "height": 520,
    "state": "VERTICAL"
  },
  {
    "id": "informationDialog",
    "title": "Information",
    "detail": "One blocking message with one safe exit.",
    "family": "dialogsAndMenus",
    "width": 360,
    "height": 180,
    "state": "MODAL"
  },
  {
    "id": "confirmationDialog",
    "title": "Confirmation",
    "detail": "Named consequence, Cancel, and destructive action.",
    "family": "dialogsAndMenus",
    "width": 400,
    "height": 230,
    "state": "DESTRUCTIVE"
  },
  {
    "id": "graphicsPopover",
    "title": "Graphics Popover",
    "detail": "Anchored render and viewport settings.",
    "family": "dialogsAndMenus",
    "width": 320,
    "height": 300,
    "state": "POPOVER"
  },
  {
    "id": "componentContextMenu",
    "title": "Component Menu",
    "detail": "CAD-style grouped commands and destructive tail.",
    "family": "dialogsAndMenus",
    "width": 300,
    "height": 440,
    "state": "CONTEXT"
  },
  {
    "id": "emptyWorkspace",
    "title": "Empty Workspace",
    "detail": "Clear start action without fake content.",
    "family": "statusAndFeedback",
    "width": 460,
    "height": 280,
    "state": "EMPTY"
  },
  {
    "id": "processingStatus",
    "title": "Processing",
    "detail": "Progress, current operation, and cancellation.",
    "family": "statusAndFeedback",
    "width": 400,
    "height": 200,
    "state": "WORKING"
  },
  {
    "id": "connectedStatus",
    "title": "Hardware Connected",
    "detail": "Positive device and heartbeat confirmation.",
    "family": "statusAndFeedback",
    "width": 400,
    "height": 190,
    "state": "READY"
  },
  {
    "id": "emergencyStatus",
    "title": "Emergency Stop",
    "detail": "Safety state dominates every secondary action.",
    "family": "statusAndFeedback",
    "width": 440,
    "height": 220,
    "state": "CRITICAL"
  }
] as const;

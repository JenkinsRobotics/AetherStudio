// Source snapshot: archived Workspaces/WorkspaceRibbonCatalog.swift.
// nil native actions remain explicitly planned; these are presentation contracts only.
export const nativeRibbonCatalog = {
  "assets": [
    {
      "label": "Create",
      "commands": [
        {
          "label": "3D Character",
          "symbol": "cube",
          "help": "Start a new 3D character \u2014 build its rig, mates, DOF, and limits.",
          "action": "createCharacter3D"
        },
        {
          "label": "2D Character",
          "symbol": "square.on.square",
          "help": "Start a new 2D character \u2014 surfaces, media, and procedural faces.",
          "action": "createCharacter2D"
        },
        {
          "label": "VR Character",
          "symbol": "faceid",
          "help": "Start a new VR character \u2014 a face-tracked live avatar.",
          "action": "createCharacterVR"
        }
      ]
    },
    {
      "label": "Import",
      "commands": [
        {
          "label": "Character",
          "symbol": "figure.stand.line.dotted.figure.stand",
          "help": "Load and validate a canonical .character.anima file through Aether Core.",
          "action": "importAetherCharacter"
        },
        {
          "label": "3D Model",
          "symbol": "cube.transparent",
          "help": "Import a USD-family, STL, or OBJ model.",
          "action": "importModel"
        },
        {
          "label": "Audio",
          "symbol": "waveform",
          "help": "Import reference or show audio.",
          "action": "importAudio"
        },
        {
          "label": "Video",
          "symbol": "play.rectangle",
          "help": "Import video for screens or reference.",
          "action": "importVideo"
        },
        {
          "label": "Image",
          "symbol": "photo",
          "help": "Import an image or texture.",
          "action": "importImage"
        },
        {
          "label": "LED Layout",
          "symbol": "circle.grid.3x3",
          "help": "Import an LED or pixel layout.",
          "action": null
        },
        {
          "label": "Batch",
          "symbol": "square.stack.3d.up",
          "help": "Import several compatible assets together.",
          "action": null
        }
      ]
    },
    {
      "label": "Manage",
      "commands": [
        {
          "label": "Relink",
          "symbol": "link",
          "help": "Relink a missing source file.",
          "action": null
        },
        {
          "label": "Replace",
          "symbol": "arrow.triangle.2.circlepath",
          "help": "Replace an asset while preserving references.",
          "action": null
        },
        {
          "label": "Reimport",
          "symbol": "arrow.clockwise",
          "help": "Reload an asset from its source.",
          "action": null
        },
        {
          "label": "Reveal",
          "symbol": "magnifyingglass",
          "help": "Reveal the source file in Finder.",
          "action": null
        },
        {
          "label": "Folder",
          "symbol": "folder.badge.plus",
          "help": "Create an asset folder.",
          "action": null
        },
        {
          "label": "Duplicate",
          "symbol": "plus.square.on.square",
          "help": "Duplicate the selected asset.",
          "action": null
        }
      ]
    },
    {
      "label": "Prepare",
      "commands": [
        {
          "label": "Units",
          "symbol": "ruler",
          "help": "Inspect or convert source units.",
          "action": null
        },
        {
          "label": "Up Axis",
          "symbol": "axis.3d",
          "help": "Convert the source up axis.",
          "action": null
        },
        {
          "label": "Origin",
          "symbol": "scope",
          "help": "Inspect or reset the model origin.",
          "action": null
        },
        {
          "label": "Hierarchy",
          "symbol": "list.bullet.indent",
          "help": "Inspect the imported model hierarchy.",
          "action": null
        },
        {
          "label": "Map Nodes",
          "symbol": "point.3.connected.trianglepath.dotted",
          "help": "Map source nodes to semantic components.",
          "action": null
        },
        {
          "label": "Validate",
          "symbol": "checkmark.shield",
          "help": "Validate asset compatibility and references.",
          "action": null
        }
      ]
    }
  ],
  "animate": [
    {
      "label": "Transport",
      "commands": [
        {
          "label": "Stop",
          "symbol": "stop.fill",
          "help": "Stop playback and return to the start.",
          "action": "stopPlayback"
        },
        {
          "label": "Play",
          "symbol": "play.fill",
          "help": "Play or pause the active animation.",
          "action": "togglePlayback"
        },
        {
          "label": "Loop",
          "symbol": "repeat",
          "help": "Loop preview playback.",
          "action": "toggleLoop"
        },
        {
          "label": "Previous Key",
          "symbol": "backward.end",
          "help": "Move to the previous keyframe.",
          "action": "previousKeyframe"
        },
        {
          "label": "Next Key",
          "symbol": "forward.end",
          "help": "Move to the next keyframe.",
          "action": "nextKeyframe"
        },
        {
          "label": "Frame",
          "symbol": "arrow.up.left.and.down.right.magnifyingglass",
          "help": "Frame the selected model node.",
          "action": "frameSelection"
        },
        {
          "label": "Grid",
          "symbol": "grid",
          "help": "Show or hide the viewport grid.",
          "action": "toggleGrid"
        }
      ]
    },
    {
      "label": "Keyframes",
      "commands": [
        {
          "label": "Add Key",
          "symbol": "diamond.fill",
          "help": "Add a keyframe at the playhead.",
          "action": null
        },
        {
          "label": "Delete",
          "symbol": "trash",
          "help": "Delete selected keyframes.",
          "action": null
        },
        {
          "label": "Copy",
          "symbol": "doc.on.doc",
          "help": "Copy selected keyframes.",
          "action": null
        },
        {
          "label": "Paste",
          "symbol": "doc.on.clipboard",
          "help": "Paste keyframes at the playhead.",
          "action": null
        },
        {
          "label": "Auto Key",
          "symbol": "record.circle",
          "help": "Create keys when animated values change.",
          "action": null
        },
        {
          "label": "Snap",
          "symbol": "dot.scope",
          "help": "Snap keyframes to display frames.",
          "action": null
        },
        {
          "label": "Reverse",
          "symbol": "arrow.left.arrow.right",
          "help": "Reverse selected motion timing.",
          "action": null
        }
      ]
    },
    {
      "label": "Curves",
      "commands": [
        {
          "label": "Hold",
          "symbol": "step.forward",
          "help": "Use stepped hold interpolation.",
          "action": null
        },
        {
          "label": "Linear",
          "symbol": "line.diagonal",
          "help": "Use linear interpolation.",
          "action": null
        },
        {
          "label": "B\u00e9zier",
          "symbol": "scribble.variable",
          "help": "Use editable B\u00e9zier interpolation.",
          "action": null
        },
        {
          "label": "Ease In",
          "symbol": "arrow.right.to.line.compact",
          "help": "Ease into selected keys.",
          "action": null
        },
        {
          "label": "Ease Out",
          "symbol": "arrow.left.to.line.compact",
          "help": "Ease out of selected keys.",
          "action": null
        },
        {
          "label": "Graph",
          "symbol": "chart.xyaxis.line",
          "help": "Open the animation graph presentation.",
          "action": null
        }
      ]
    },
    {
      "label": "Tracks",
      "commands": [
        {
          "label": "Add Track",
          "symbol": "plus.rectangle.on.folder",
          "help": "Add a motion track.",
          "action": null
        },
        {
          "label": "Group",
          "symbol": "folder",
          "help": "Group selected tracks.",
          "action": null
        },
        {
          "label": "Mute",
          "symbol": "speaker.slash",
          "help": "Mute selected tracks.",
          "action": null
        },
        {
          "label": "Solo",
          "symbol": "headphones",
          "help": "Solo selected tracks.",
          "action": null
        },
        {
          "label": "Lock",
          "symbol": "lock",
          "help": "Lock selected tracks.",
          "action": null
        },
        {
          "label": "Layers",
          "symbol": "square.3.layers.3d",
          "help": "Create or manage motion layers.",
          "action": null
        },
        {
          "label": "Timeline",
          "symbol": "rectangle.bottomthird.inset.filled",
          "help": "Show or hide the timeline.",
          "action": "toggleBottomEditor"
        }
      ]
    },
    {
      "label": "Reference",
      "commands": [
        {
          "label": "Audio",
          "symbol": "waveform",
          "help": "Add reference audio and its waveform.",
          "action": null
        },
        {
          "label": "Video",
          "symbol": "play.rectangle",
          "help": "Add reference video.",
          "action": null
        },
        {
          "label": "Marker",
          "symbol": "bookmark",
          "help": "Add a timeline marker.",
          "action": null
        },
        {
          "label": "Lip Sync",
          "symbol": "mouth",
          "help": "Add a lip-sync authoring track.",
          "action": null
        },
        {
          "label": "Beat",
          "symbol": "metronome",
          "help": "Detect or author beat markers.",
          "action": null
        }
      ]
    }
  ],
  "show": [
    {
      "label": "Sequence",
      "commands": [
        {
          "label": "Character",
          "symbol": "figure.wave",
          "help": "Add a character track.",
          "action": null
        },
        {
          "label": "Audio",
          "symbol": "waveform",
          "help": "Add an audio track.",
          "action": null
        },
        {
          "label": "Video",
          "symbol": "play.rectangle",
          "help": "Add a video track.",
          "action": null
        },
        {
          "label": "Screen",
          "symbol": "display",
          "help": "Add a simulated screen track.",
          "action": null
        },
        {
          "label": "LED",
          "symbol": "circle.grid.3x3",
          "help": "Add an LED-matrix track.",
          "action": null
        },
        {
          "label": "Event",
          "symbol": "bolt.circle",
          "help": "Add an event track.",
          "action": null
        }
      ]
    },
    {
      "label": "Clips",
      "commands": [
        {
          "label": "Animation",
          "symbol": "figure.walk.motion",
          "help": "Add an animation clip.",
          "action": null
        },
        {
          "label": "Trim",
          "symbol": "timeline.selection",
          "help": "Trim the selected clip.",
          "action": null
        },
        {
          "label": "Split",
          "symbol": "scissors",
          "help": "Split a clip at the playhead.",
          "action": null
        },
        {
          "label": "Loop",
          "symbol": "repeat",
          "help": "Loop the selected clip.",
          "action": null
        },
        {
          "label": "Crossfade",
          "symbol": "waveform.path.ecg.rectangle",
          "help": "Crossfade compatible clips.",
          "action": null
        },
        {
          "label": "Speed",
          "symbol": "gauge.with.dots.needle.50percent",
          "help": "Change clip playback speed.",
          "action": null
        }
      ]
    },
    {
      "label": "Events",
      "commands": [
        {
          "label": "Trigger",
          "symbol": "bolt.circle",
          "help": "Emit a one-shot trigger.",
          "action": null
        },
        {
          "label": "On / Off",
          "symbol": "switch.2",
          "help": "Author a Boolean event.",
          "action": null
        },
        {
          "label": "Curve",
          "symbol": "point.topleft.down.curvedto.point.bottomright.up",
          "help": "Author a numeric event curve.",
          "action": null
        },
        {
          "label": "Message",
          "symbol": "text.bubble",
          "help": "Send a text or message event.",
          "action": null
        },
        {
          "label": "Hardware",
          "symbol": "cable.connector",
          "help": "Send a bounded hardware command.",
          "action": null
        },
        {
          "label": "Network",
          "symbol": "network",
          "help": "Send a network event through a configured plugin.",
          "action": null
        }
      ]
    },
    {
      "label": "Sync",
      "commands": [
        {
          "label": "Timecode",
          "symbol": "clock",
          "help": "Configure show timecode.",
          "action": null
        },
        {
          "label": "Marker",
          "symbol": "bookmark",
          "help": "Add a show marker.",
          "action": null
        },
        {
          "label": "Pre-roll",
          "symbol": "backward.frame",
          "help": "Configure show pre-roll.",
          "action": null
        },
        {
          "label": "Scene",
          "symbol": "rectangle.3.group",
          "help": "Group clips into a scene.",
          "action": null
        },
        {
          "label": "Timeline",
          "symbol": "rectangle.bottomthird.inset.filled",
          "help": "Show or hide the show timeline.",
          "action": "toggleBottomEditor"
        },
        {
          "label": "Grid",
          "symbol": "grid",
          "help": "Show or hide the preview grid.",
          "action": "toggleGrid"
        }
      ]
    }
  ],
  "nodes": [
    {
      "label": "Flow",
      "commands": [
        {
          "label": "Start",
          "symbol": "play.fill",
          "help": "Add the single entry point for a scene graph.",
          "action": null
        },
        {
          "label": "End",
          "symbol": "stop.fill",
          "help": "Add the terminal point for a scene graph.",
          "action": null
        },
        {
          "label": "Sequence",
          "symbol": "arrow.right.to.line.compact",
          "help": "Run child actions in order.",
          "action": null
        },
        {
          "label": "Parallel",
          "symbol": "arrow.triangle.branch",
          "help": "Run child actions together.",
          "action": null
        },
        {
          "label": "IF / ELSE",
          "symbol": "arrow.triangle.swap",
          "help": "Choose a path from a structured condition.",
          "action": null
        },
        {
          "label": "Loop",
          "symbol": "repeat",
          "help": "Repeat a structured group of scene actions.",
          "action": null
        }
      ]
    },
    {
      "label": "Actions",
      "commands": [
        {
          "label": "Animation Clip",
          "symbol": "figure.walk.motion",
          "help": "Play an authored character clip.",
          "action": null
        },
        {
          "label": "Pose",
          "symbol": "figure.stand",
          "help": "Move the character to a named or inline pose.",
          "action": null
        },
        {
          "label": "Wait",
          "symbol": "timer",
          "help": "Pause scene execution for a duration.",
          "action": null
        },
        {
          "label": "Wait for Event",
          "symbol": "hourglass",
          "help": "Pause until a named event arrives.",
          "action": null
        },
        {
          "label": "Emit Event",
          "symbol": "bolt.circle",
          "help": "Publish a named scene event.",
          "action": null
        },
        {
          "label": "Set Variable",
          "symbol": "equal.circle",
          "help": "Set a declared scene variable.",
          "action": null
        }
      ]
    },
    {
      "label": "Graph",
      "commands": [
        {
          "label": "Select",
          "symbol": "cursorarrow",
          "help": "Select and move nodes on the canvas.",
          "action": null
        },
        {
          "label": "Hand",
          "symbol": "hand.draw",
          "help": "Pan across a larger node canvas.",
          "action": null
        },
        {
          "label": "Connect",
          "symbol": "cable.connector",
          "help": "Connect compatible flow and data ports.",
          "action": null
        },
        {
          "label": "Frame All",
          "symbol": "arrow.up.left.and.down.right.magnifyingglass",
          "help": "Frame the complete graph.",
          "action": null
        },
        {
          "label": "Validate",
          "symbol": "checkmark.shield",
          "help": "Validate graph structure and availability.",
          "action": null
        }
      ]
    },
    {
      "label": "Program Logic",
      "commands": [
        {
          "label": "Single-Line IF",
          "symbol": "questionmark.diamond",
          "help": "Concept: guard one action with a condition.",
          "action": null
        },
        {
          "label": "SELECT",
          "symbol": "list.number",
          "help": "Concept: choose the first matching case without fallthrough.",
          "action": null
        },
        {
          "label": "CALL",
          "symbol": "rectangle.stack",
          "help": "Concept: run a shared subroutine and return.",
          "action": null
        },
        {
          "label": "WAIT Until",
          "symbol": "hourglass",
          "help": "Concept: pause on a level-triggered condition.",
          "action": null
        },
        {
          "label": "JMP (Import)",
          "symbol": "arrow.turn.up.right",
          "help": "Import reference only: Aether replaces JMP with Loop, SELECT, or CALL.",
          "action": null
        },
        {
          "label": "LBL (Import)",
          "symbol": "tag",
          "help": "Import reference only: arbitrary labels cannot compile into a structured graph.",
          "action": null
        }
      ]
    },
    {
      "label": "Conditions",
      "commands": [
        {
          "label": "AND",
          "symbol": "circle.grid.cross",
          "help": "Concept: true when both typed conditions are true.",
          "action": null
        },
        {
          "label": "OR",
          "symbol": "circle.grid.2x2",
          "help": "Concept: true when either typed condition is true.",
          "action": null
        },
        {
          "label": "XOR",
          "symbol": "arrow.triangle.branch",
          "help": "Concept: true when exactly one condition is true.",
          "action": null
        },
        {
          "label": "NOT",
          "symbol": "exclamationmark.circle",
          "help": "Concept: invert a typed condition.",
          "action": null
        }
      ]
    },
    {
      "label": "I/O & Registers",
      "commands": [
        {
          "label": "Read Input",
          "symbol": "arrow.down.to.line",
          "help": "Concept: read a declared external scene input.",
          "action": null
        },
        {
          "label": "Write Output",
          "symbol": "arrow.up.from.line",
          "help": "Concept: write a mapped Boolean or numeric output.",
          "action": null
        },
        {
          "label": "Register",
          "symbol": "number.square",
          "help": "Concept: read or write a named numeric value.",
          "action": null
        },
        {
          "label": "Flag",
          "symbol": "flag",
          "help": "Concept: read or write a named Boolean value.",
          "action": null
        },
        {
          "label": "Position",
          "symbol": "mappin.and.ellipse",
          "help": "Concept: read or write a named pose value.",
          "action": null
        }
      ]
    },
    {
      "label": "Background",
      "commands": [
        {
          "label": "Monitor",
          "symbol": "waveform.path.ecg",
          "help": "Concept: continuously scan an edge-triggered interlock.",
          "action": null
        },
        {
          "label": "End Scene",
          "symbol": "hand.raised.fill",
          "help": "Concept: safely terminate a scene from a monitor.",
          "action": null
        }
      ]
    },
    {
      "label": "Inputs",
      "commands": [
        {
          "label": "Text",
          "symbol": "text.cursor",
          "help": "Concept: receive operator or plugin-provided text.",
          "action": null
        },
        {
          "label": "Microphone",
          "symbol": "mic",
          "help": "Concept: receive a live microphone audio stream.",
          "action": null
        },
        {
          "label": "Event",
          "symbol": "bolt.horizontal.circle",
          "help": "Concept: receive a scene, OSC, or MIDI event.",
          "action": null
        },
        {
          "label": "Hardware",
          "symbol": "switch.2",
          "help": "Concept: receive a sensor, button, or controller value.",
          "action": null
        }
      ]
    },
    {
      "label": "Voice & AI",
      "commands": [
        {
          "label": "STT",
          "symbol": "captions.bubble",
          "help": "Concept: convert an audio stream to text.",
          "action": null
        },
        {
          "label": "LLM",
          "symbol": "brain.head.profile",
          "help": "Concept: send text and context to an LLM provider.",
          "action": null
        },
        {
          "label": "Memory",
          "symbol": "books.vertical",
          "help": "Concept: retain bounded conversation context.",
          "action": null
        },
        {
          "label": "Tool Call",
          "symbol": "wrench.and.screwdriver",
          "help": "Concept: invoke an approved plugin tool.",
          "action": null
        },
        {
          "label": "TTS",
          "symbol": "speaker.wave.2",
          "help": "Concept: convert text to a voice audio stream.",
          "action": null
        },
        {
          "label": "AI Behavior",
          "symbol": "sparkles",
          "help": "Concept: select a bounded character behavior.",
          "action": null
        }
      ]
    },
    {
      "label": "Outputs",
      "commands": [
        {
          "label": "Audio Clip",
          "symbol": "waveform",
          "help": "Concept: provide an audio asset stream.",
          "action": null
        },
        {
          "label": "Audio",
          "symbol": "speaker.wave.2",
          "help": "Concept: send audio to an output device.",
          "action": null
        },
        {
          "label": "Motion",
          "symbol": "figure.walk.motion",
          "help": "Concept: send bounded character motion.",
          "action": null
        },
        {
          "label": "Event",
          "symbol": "bolt.circle",
          "help": "Concept: emit an external event.",
          "action": null
        },
        {
          "label": "Screen",
          "symbol": "display",
          "help": "Concept: send content to a simulated or physical screen.",
          "action": null
        },
        {
          "label": "LED",
          "symbol": "circle.grid.3x3",
          "help": "Concept: send color data to an LED matrix.",
          "action": null
        },
        {
          "label": "Hardware",
          "symbol": "cable.connector",
          "help": "Concept: send a safely mapped hardware value.",
          "action": null
        }
      ]
    }
  ],
  "hardware": [
    {
      "label": "Connection",
      "commands": [
        {
          "label": "Connect",
          "symbol": "bolt.horizontal.circle",
          "help": "Connect to a configured hardware driver.",
          "action": null
        },
        {
          "label": "Rescan",
          "symbol": "arrow.clockwise",
          "help": "Rescan serial and network devices.",
          "action": null
        },
        {
          "label": "Serial",
          "symbol": "cable.connector.horizontal",
          "help": "Configure a serial device.",
          "action": null
        },
        {
          "label": "Network",
          "symbol": "network",
          "help": "Discover or configure a network device.",
          "action": null
        },
        {
          "label": "Diagnostics",
          "symbol": "stethoscope",
          "help": "Open connection diagnostics.",
          "action": null
        }
      ]
    },
    {
      "label": "Outputs",
      "commands": [
        {
          "label": "Servo",
          "symbol": "capsule",
          "help": "Add a standard servo output.",
          "action": null
        },
        {
          "label": "PCA9685",
          "symbol": "cpu",
          "help": "Add a PCA9685 servo controller.",
          "action": null
        },
        {
          "label": "Stepper",
          "symbol": "move.3d",
          "help": "Add a stepper output.",
          "action": null
        },
        {
          "label": "DYNAMIXEL",
          "symbol": "hexagon",
          "help": "Add a DYNAMIXEL output.",
          "action": null
        },
        {
          "label": "Digital",
          "symbol": "switch.2",
          "help": "Add a digital output.",
          "action": null
        },
        {
          "label": "PWM",
          "symbol": "waveform.path",
          "help": "Add a PWM output.",
          "action": null
        },
        {
          "label": "LED",
          "symbol": "circle.grid.3x3",
          "help": "Add an LED controller.",
          "action": null
        },
        {
          "label": "Screen",
          "symbol": "display",
          "help": "Add a screen controller.",
          "action": null
        },
        {
          "label": "Plugin",
          "symbol": "puzzlepiece.extension",
          "help": "Add a custom output plugin.",
          "action": null
        }
      ]
    },
    {
      "label": "Mapping",
      "commands": [
        {
          "label": "Map DOF",
          "symbol": "point.3.connected.trianglepath.dotted",
          "help": "Map a rig DOF to an output channel.",
          "action": "showOutputMappings"
        },
        {
          "label": "Range",
          "symbol": "slider.horizontal.below.rectangle",
          "help": "Set minimum and maximum output.",
          "action": "showOutputMappings"
        },
        {
          "label": "Reverse",
          "symbol": "arrow.left.arrow.right",
          "help": "Reverse output direction.",
          "action": "showOutputMappings"
        },
        {
          "label": "Neutral",
          "symbol": "scope",
          "help": "Set the neutral output value.",
          "action": null
        },
        {
          "label": "Deadband",
          "symbol": "minus.plus.batteryblock",
          "help": "Set an output deadband.",
          "action": null
        },
        {
          "label": "Curve",
          "symbol": "chart.xyaxis.line",
          "help": "Shape the output response curve.",
          "action": null
        },
        {
          "label": "Velocity",
          "symbol": "speedometer",
          "help": "Limit output velocity.",
          "action": null
        },
        {
          "label": "Acceleration",
          "symbol": "gauge.open.with.lines.needle.33percent",
          "help": "Limit output acceleration.",
          "action": null
        },
        {
          "label": "Smoothing",
          "symbol": "waveform.path.ecg",
          "help": "Configure output smoothing.",
          "action": null
        }
      ]
    },
    {
      "label": "Calibration",
      "commands": [
        {
          "label": "Jog",
          "symbol": "arrow.left.and.right",
          "help": "Jog a selected output safely.",
          "action": null
        },
        {
          "label": "Neutral",
          "symbol": "scope",
          "help": "Move the selected output to neutral.",
          "action": null
        },
        {
          "label": "Sweep",
          "symbol": "arrow.triangle.2.circlepath",
          "help": "Sweep within configured safe limits.",
          "action": null
        },
        {
          "label": "Set Min",
          "symbol": "arrow.down.to.line",
          "help": "Capture the physical minimum.",
          "action": null
        },
        {
          "label": "Set Max",
          "symbol": "arrow.up.to.line",
          "help": "Capture the physical maximum.",
          "action": null
        },
        {
          "label": "Test Channel",
          "symbol": "play.square",
          "help": "Test one mapped channel.",
          "action": null
        },
        {
          "label": "Test Rig",
          "symbol": "figure.walk.motion",
          "help": "Exercise the complete mechanism virtually first.",
          "action": null
        }
      ]
    },
    {
      "label": "Safety",
      "commands": [
        {
          "label": "Arm",
          "symbol": "power",
          "help": "Arm hardware output after safety checks.",
          "action": null
        },
        {
          "label": "E-Stop",
          "symbol": "stop.circle.fill",
          "help": "Immediately stop and disarm output.",
          "action": null
        },
        {
          "label": "Failsafe",
          "symbol": "heart.text.square",
          "help": "Configure heartbeat and timeout behavior.",
          "action": null
        },
        {
          "label": "Safe Pose",
          "symbol": "figure.stand",
          "help": "Configure the safe fallback pose.",
          "action": null
        },
        {
          "label": "Limits",
          "symbol": "shield.lefthalf.filled",
          "help": "Review enforced output limits.",
          "action": null
        },
        {
          "label": "Reset Fault",
          "symbol": "arrow.counterclockwise.circle",
          "help": "Reset a resolved hardware fault.",
          "action": null
        }
      ]
    },
    {
      "label": "Monitor",
      "commands": [
        {
          "label": "Channels",
          "symbol": "list.number",
          "help": "Monitor live channel targets.",
          "action": null
        },
        {
          "label": "Position",
          "symbol": "scope",
          "help": "Compare commanded and reported position.",
          "action": null
        },
        {
          "label": "Health",
          "symbol": "heart.text.square",
          "help": "Monitor driver health.",
          "action": null
        },
        {
          "label": "Latency",
          "symbol": "timer",
          "help": "Monitor communication latency.",
          "action": null
        },
        {
          "label": "Logs",
          "symbol": "doc.text.magnifyingglass",
          "help": "Open filterable hardware logs.",
          "action": null
        },
        {
          "label": "Export",
          "symbol": "square.and.arrow.up",
          "help": "Export hardware logs.",
          "action": null
        },
        {
          "label": "Firmware",
          "symbol": "memorychip",
          "help": "Inspect device firmware information.",
          "action": null
        }
      ]
    }
  ]
} as const;

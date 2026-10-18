/// <reference types="vite/client" />
const catalog = {
  "../../assets/themes/viewports/blueprint.json": {
    "$schema": "aether-viewport/v1",
    "id": "blueprint",
    "name": "Blueprint",
    "description": "Drafting blue with white lines: sketch geometry and constraints in chalk.",
    "modes": {
      "dark": {
        "viewport-bg-top": "#123a66",
        "viewport-bg-bottom": "#0a2747",
        "viewport-grid": "rgba(255, 255, 255, 0.1)",
        "viewport-grid-axis": "rgba(255, 255, 255, 0.28)",
        "viewport-part": "#5f8fc4",
        "viewport-part-shade": "#2f5f93",
        "viewport-part-edge": "rgba(255, 255, 255, 0.35)",
        "viewport-cavity": "#0c2a4c",
        "viewport-sketch": "#ffffff",
        "viewport-sketch-constrained": "#dbeafe",
        "viewport-construction": "#ffd166",
        "viewport-selection": "#ffd166",
        "viewport-hover": "#ffe59a"
      },
      "light": {
        "viewport-bg-top": "#1d4f86",
        "viewport-bg-bottom": "#123a66",
        "viewport-grid": "rgba(255, 255, 255, 0.1)",
        "viewport-grid-axis": "rgba(255, 255, 255, 0.28)",
        "viewport-part": "#7aa6d6",
        "viewport-part-shade": "#3f6fa3",
        "viewport-part-edge": "rgba(255, 255, 255, 0.35)",
        "viewport-cavity": "#153e6b",
        "viewport-sketch": "#ffffff",
        "viewport-sketch-constrained": "#dbeafe",
        "viewport-construction": "#ffd166",
        "viewport-selection": "#ffd166",
        "viewport-hover": "#ffe59a"
      }
    }
  },
  "../../assets/themes/viewports/cad-light.json": {
    "$schema": "aether-viewport/v1",
    "id": "cad-light",
    "name": "CAD Light",
    "description": "A pale workbench stage with dark grid lines \u2014 the native CAD Light preview.",
    "modes": {
      "dark": {
        "viewport-bg-top": "#d3dae0",
        "viewport-bg-bottom": "#bcc5cd",
        "viewport-grid": "rgba(41, 41, 41, 0.25)",
        "viewport-grid-axis": "rgba(31, 31, 31, 0.4)",
        "viewport-part": "#f2f4f7",
        "viewport-part-shade": "#aab3bd",
        "viewport-part-edge": "rgba(0, 0, 0, 0.14)",
        "viewport-cavity": "#8f98a3",
        "viewport-sketch": "#24466e",
        "viewport-sketch-constrained": "#12203a",
        "viewport-construction": "#c2410c",
        "viewport-selection": "#1d4ed8",
        "viewport-hover": "#3b82f6"
      },
      "light": {
        "viewport-bg-top": "#d3dae0",
        "viewport-bg-bottom": "#bcc5cd",
        "viewport-grid": "rgba(41, 41, 41, 0.25)",
        "viewport-grid-axis": "rgba(31, 31, 31, 0.4)",
        "viewport-part": "#f2f4f7",
        "viewport-part-shade": "#aab3bd",
        "viewport-part-edge": "rgba(0, 0, 0, 0.14)",
        "viewport-cavity": "#8f98a3",
        "viewport-sketch": "#24466e",
        "viewport-sketch-constrained": "#12203a",
        "viewport-construction": "#c2410c",
        "viewport-selection": "#1d4ed8",
        "viewport-hover": "#3b82f6"
      }
    }
  },
  "../../assets/themes/viewports/graphite.json": {
    "$schema": "aether-viewport/v1",
    "id": "graphite",
    "name": "Graphite",
    "description": "Mid-grey studio stage, the native PreviewAppearance default.",
    "modes": {
      "dark": {
        "viewport-bg-top": "#3a3f47",
        "viewport-bg-bottom": "#1f2329",
        "viewport-grid": "rgba(255, 255, 255, 0.06)",
        "viewport-grid-axis": "rgba(255, 255, 255, 0.18)"
      },
      "light": {
        "viewport-bg-top": "#d9dde3",
        "viewport-bg-bottom": "#b9bfc8",
        "viewport-grid": "rgba(0, 0, 0, 0.08)",
        "viewport-grid-axis": "rgba(0, 0, 0, 0.2)"
      }
    }
  },
  "../../assets/themes/viewports/midnight.json": {
    "$schema": "aether-viewport/v1",
    "id": "midnight",
    "name": "Midnight",
    "description": "Near-black stage with a faint grid; parts read as lit metal.",
    "modes": {
      "dark": {
        "viewport-bg-top": "#0d121b",
        "viewport-bg-bottom": "#04060a",
        "viewport-grid": "rgba(255, 255, 255, 0.05)",
        "viewport-grid-axis": "rgba(255, 255, 255, 0.16)"
      },
      "light": {
        "viewport-bg-top": "#1a2130",
        "viewport-bg-bottom": "#0b0f17",
        "viewport-grid": "rgba(255, 255, 255, 0.05)",
        "viewport-grid-axis": "rgba(255, 255, 255, 0.16)",
        "viewport-part": "#8a94a3",
        "viewport-part-shade": "#3a424d",
        "viewport-cavity": "#1c2230",
        "viewport-sketch": "#7fbcff",
        "viewport-sketch-constrained": "#ffffff"
      }
    }
  },
  "../../assets/themes/viewports/model-studio.json": {
    "$schema": "aether-viewport/v1",
    "id": "model-studio",
    "name": "Model Studio",
    "description": "Dark studio stage; choose the Model Studio rendering preset in CAD for its lighting and surface finish.",
    "modes": {
      "dark": {
        "viewport-bg-top": "#101112",
        "viewport-bg-bottom": "#101112",
        "viewport-grid": "#303436",
        "viewport-grid-axis": "#555954",
        "viewport-part": "#c6c9c7",
        "viewport-part-edge": "#151b1d",
        "viewport-sketch": "#aee2ff"
      },
      "light": {
        "viewport-bg-top": "#101112",
        "viewport-bg-bottom": "#101112",
        "viewport-grid": "#303436",
        "viewport-grid-axis": "#555954",
        "viewport-part": "#c6c9c7",
        "viewport-part-edge": "#151b1d",
        "viewport-sketch": "#aee2ff"
      }
    }
  },
  "../../assets/themes/viewports/onshape.json": {
    "$schema": "aether-viewport/v1",
    "id": "onshape",
    "name": "Studio Grey",
    "description": "The shipped default stage: near-white with a quiet grid.",
    "modes": {
      "dark": {
        "viewport-bg-top": "#f6f8f9",
        "viewport-bg-bottom": "#e9edf0",
        "viewport-grid": "rgba(154, 164, 173, 0.18)",
        "viewport-grid-axis": "rgba(127, 138, 148, 0.35)",
        "viewport-part": "#f7f9fb",
        "viewport-part-shade": "#b9c3cd",
        "viewport-part-edge": "rgba(0, 0, 0, 0.12)",
        "viewport-cavity": "#9aa4ad",
        "viewport-sketch": "#24466e",
        "viewport-sketch-constrained": "#12203a",
        "viewport-construction": "#e6aa64",
        "viewport-selection": "#1d4ed8",
        "viewport-hover": "#3b82f6"
      },
      "light": {
        "viewport-bg-top": "#f6f8f9",
        "viewport-bg-bottom": "#e9edf0",
        "viewport-grid": "rgba(154, 164, 173, 0.18)",
        "viewport-grid-axis": "rgba(127, 138, 148, 0.35)",
        "viewport-part": "#f7f9fb",
        "viewport-part-shade": "#b9c3cd",
        "viewport-part-edge": "rgba(0, 0, 0, 0.12)",
        "viewport-cavity": "#9aa4ad",
        "viewport-sketch": "#24466e",
        "viewport-sketch-constrained": "#12203a",
        "viewport-construction": "#e6aa64",
        "viewport-selection": "#1d4ed8",
        "viewport-hover": "#3b82f6"
      }
    }
  },
  "../../assets/themes/viewports/paper.json": {
    "$schema": "aether-viewport/v1",
    "id": "paper",
    "name": "Paper",
    "description": "A white drafting sheet: light stage in either interface mode, ink sketch lines.",
    "modes": {
      "dark": {
        "viewport-bg-top": "#fbfbfa",
        "viewport-bg-bottom": "#ebeae5",
        "viewport-grid": "rgba(0, 0, 0, 0.06)",
        "viewport-grid-axis": "rgba(0, 0, 0, 0.16)",
        "viewport-part": "#f2f1ec",
        "viewport-part-shade": "#c9c7bf",
        "viewport-part-edge": "rgba(0, 0, 0, 0.12)",
        "viewport-cavity": "#b3b1a9",
        "viewport-sketch": "#1d4ed8",
        "viewport-sketch-constrained": "#111111",
        "viewport-construction": "#c2410c",
        "viewport-selection": "#1d4ed8",
        "viewport-hover": "#3b82f6"
      },
      "light": {
        "viewport-bg-top": "#fbfbfa",
        "viewport-bg-bottom": "#ebeae5",
        "viewport-grid": "rgba(0, 0, 0, 0.06)",
        "viewport-grid-axis": "rgba(0, 0, 0, 0.16)",
        "viewport-part": "#f2f1ec",
        "viewport-part-shade": "#c9c7bf",
        "viewport-part-edge": "rgba(0, 0, 0, 0.12)",
        "viewport-cavity": "#b3b1a9",
        "viewport-sketch": "#1d4ed8",
        "viewport-sketch-constrained": "#111111",
        "viewport-construction": "#c2410c",
        "viewport-selection": "#1d4ed8",
        "viewport-hover": "#3b82f6"
      }
    }
  }
};
export default catalog;

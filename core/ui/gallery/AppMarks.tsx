import { useState } from "react";
import { createRoot } from "react-dom/client";
import { appMarkSources } from "@aether/assets/branding/marks/sources";
import { AppWordmark } from "../src/AppWordmark";
import { AppMark, type AppMarkName } from "../src/AppMark";
import { SelectField } from "../src/SelectField";
import "../tokens/tokens.css";
import "../src/widgets.css";
import "./AppMarks.css";

const names: Record<AppMarkName, string> = {
  studio: "Studio", cad: "CAD", animation: "Animation", ui: "UI", map: "Map",
  sketch: "Sketch", vector: "Vector", io: "IO", drive: "Drive",
};

function AppMarks() {
  const [size, setSize] = useState(64);
  return <main className="app-marks-page">
    <header>
      <div><p className="app-marks-eyebrow">AETHER UI · BRAND ASSETS</p>
        <h1>Every A, on its own.</h1>
        <p>Transparent application marks for direct placement on any UI surface.</p></div>
      <label>Preview size <SelectField value={String(size)} onChange={event => setSize(Number(event.target.value))}
        options={[24, 32, 64, 96].map(value => ({ value: String(value), label: `${value} px` }))} /></label>
    </header>
    <div className="app-marks-grid">
      {(Object.keys(names) as AppMarkName[]).map(app => <article key={app}>
        <div className="app-marks-identity"><h2><AppWordmark app={app} size={32} /></h2>
          <a href={appMarkSources[app]} download={`aether-${app}-mark.png`}>PNG ↓</a></div>
        <div className="app-marks-surfaces">
          {(["light", "dark", "transparent"] as const).map(surface => <figure key={surface}>
            <div className={`app-marks-surface app-marks-surface--${surface}`}>
              <AppMark app={app} size={size} alt={`Aether ${names[app]} mark on ${surface}`} />
            </div><figcaption>{surface === "transparent" ? "Alpha" : surface}</figcaption>
          </figure>)}
        </div>
      </article>)}
    </div>
    <footer><code>{'<AppMark app="cad" size={32} />'}</code><span>Separate from AppIcon · 1254 × 1254 RGBA PNG</span></footer>
  </main>;
}

createRoot(document.getElementById("root")!).render(<AppMarks />);

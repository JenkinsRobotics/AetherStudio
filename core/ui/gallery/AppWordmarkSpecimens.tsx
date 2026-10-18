import { useState } from "react";
import { appWordmarkData } from "@aether/assets/branding/wordmarks/data";
import { appWordmarkDownloads, appWordmarkArchive } from "@aether/assets/branding/wordmarks/downloads";
import { AppWordmark, SelectField, type AppWordmarkName } from "../src";
import "./AppWordmarkSpecimens.css";
export function AppWordmarkSpecimens(){
 const [size,setSize]=useState(36);
 return <div className="app-wordmark-specimens">
  <div className="app-wordmark-intro"><div><p>One header identity for every app. Each keeps its own A, paired with the same bold Aether and lighter product name.</p><p className="app-wordmark-note">Transparent artwork · original marks · light and dark versions</p></div><a className="aui-button" href={appWordmarkArchive} download="aether-header-logos.zip">Download all 9 logos</a></div>
  <div className="app-wordmark-hero"><AppWordmark app="cad" appearance="light" size={104}/></div>
  <div className="app-wordmark-controls"><h3>All application variants</h3><label>Header size<SelectField aria-label="Header logo size" value={size} options={[28,36,40].map(value=>({value:String(value),label:`${value} px${value===36?' · standard':''}`}))} onChange={event=>setSize(Number(event.target.value))}/></label></div>
  <div className="app-wordmark-grid">{(Object.keys(appWordmarkData.apps) as AppWordmarkName[]).map(app=><article key={app} aria-label={`Aether ${appWordmarkData.apps[app].name} logo variants`}><h4>Aether {appWordmarkData.apps[app].name}</h4>{(["light","dark"] as const).map(appearance=><div key={appearance} className={`app-wordmark-example app-wordmark-example--${appearance}`}><div className="app-wordmark-header"><AppWordmark app={app} size={size} appearance={appearance}/></div><div className="app-wordmark-downloads"><span>{appearance==='light'?'Light header':'Dark header'}</span><a href={appWordmarkDownloads[app][appearance].svg} download={`aether-${app}-${appearance}.svg`}>SVG</a><a href={appWordmarkDownloads[app][appearance].png} download={`aether-${app}-${appearance}.png`}>PNG</a></div></div>)}</article>)}</div>
 </div>;
}

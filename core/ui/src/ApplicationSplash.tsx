import {useId, type ReactNode} from 'react';
import './ApplicationSplash.css';

export type SplashPhase = 'pending' | 'running' | 'done' | 'failed';
export interface SplashStage { id:string; title:string; detail?:string; phase:SplashPhase }
export interface ApplicationSplashProps {
  appName:string;
  tagline?:string;
  version?:string;
  artworkUrl?:string;
  headline:string;
  detail?:string;
  /** Actual startup fraction 0–1. Omit when progress cannot be measured. */
  progress?:number;
  state?:'loading'|'ready'|'offline'|'error';
  stages?:readonly SplashStage[];
  footnote?:string;
  /** Product-owned actions, such as retry or continue offline. */
  actions?:ReactNode;
}
const phaseLabels:Record<SplashPhase,string>={pending:'Waiting',running:'Loading',done:'Ready',failed:'Unavailable'};
/** Presentation only: the owning application reports real startup state and decides when to dismiss. */
export function ApplicationSplash({appName,tagline,version,artworkUrl,headline,detail,progress,state='loading',stages=[],footnote,actions}:ApplicationSplashProps) {
  const id=useId();
  const fraction=typeof progress==='number'&&Number.isFinite(progress)?Math.min(1,Math.max(0,progress)):undefined;
  return <section className="aui-application-splash" data-state={state} aria-labelledby={id} aria-busy={state==='loading'}>
    <div className="aui-splash-art" aria-hidden="true">{artworkUrl&&<img src={artworkUrl} alt=""/>}</div>
    <div className="aui-splash-brand"><span>Aether</span>{version&&<span>{version}</span>}</div>
    <div className="aui-splash-panel">
      <div className="aui-splash-copy">
        {tagline&&<p className="aui-splash-tagline">{tagline}</p>}
        <h1 id={id}>{appName}</h1>
        <div className="aui-splash-status" role={state==='error'?'alert':'status'} aria-live={state==='error'?'assertive':'polite'} aria-atomic="true"><h2>{headline}</h2>{detail&&<p>{detail}</p>}</div>
        <div className="aui-splash-progress-row"><progress aria-label={`${appName} startup progress`} max={1} value={fraction}/><span aria-hidden="true">{fraction===undefined?'':`${Math.round(fraction*100)}%`}</span></div>
        {footnote&&<p className="aui-splash-footnote">{footnote}</p>}
        {actions&&<div className="aui-splash-actions">{actions}</div>}
      </div>
      {stages.length>0&&<ol className="aui-splash-stages" aria-label="Startup stages">{stages.map(stage=><li key={stage.id} data-phase={stage.phase}><span className="aui-splash-dot" aria-hidden="true"/><div><div className="aui-splash-stage-title"><strong>{stage.title}</strong><span>{phaseLabels[stage.phase]}</span></div>{stage.detail&&<p>{stage.detail}</p>}</div></li>)}</ol>}
    </div>
  </section>;
}

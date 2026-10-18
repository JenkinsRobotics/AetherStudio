import { demoAppsURL } from "./demo-location";
import {useState} from 'react';
import {ApplicationSplash, type SplashStage} from '../src/ApplicationSplash';
import {Button} from '../src/Button';
import gripper from '@aether/assets/branding/splash-backgrounds/cad/cad-gripper.png';
import wheel from '@aether/assets/branding/splash-backgrounds/cad/cad-wheel-hub.png';
import enclosure from '@aether/assets/branding/splash-backgrounds/cad/cad-enclosure.png';

export function SplashDemo() {
 const backgrounds=[{name:'Robotic gripper',url:gripper},{name:'Wheel and hub',url:wheel},{name:'Electronics enclosure',url:enclosure}];
 const [background,setBackground]=useState(backgrounds[0]);
 const [state,setState]=useState<'loading'|'ready'|'offline'|'error'>('loading');
 const stages:SplashStage[]=[
  {id:'interface',title:'Interface',detail:'Shared controls and themes',phase:'done'},
  {id:'preferences',title:'Your preferences',detail:'Appearance and workspace layout',phase:'done'},
  {id:'workspace',title:'Workspace',detail:state==='loading'?'Preparing your tools':'Tools ready',phase:state==='loading'?'running':'done'},
  {id:'services',title:'Studio connection',detail:state==='offline'?'Local files remain available':state==='error'?'Connection could not be established':state==='ready'?'Connected':'Waiting for workspace',phase:state==='ready'?'done':state==='error'||state==='offline'?'failed':'pending'},
 ];
 return <main style={{minHeight:'100%',boxSizing:'border-box',padding:'36px 20px',display:'grid',placeContent:'center',gridTemplateColumns:'minmax(0,840px)',gap:24,background:'#0c1119',color:'#d8e6f3',fontFamily:'var(--aether-font-family,system-ui)'}}>
  <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:24}}><div><strong>Application splash</strong><p style={{fontSize:12,opacity:.7,margin:'6px 0 0'}}>CAD background collection · sample startup states</p></div><a style={{color:'#91d8ff'}} href={demoAppsURL()}>Back to demo apps</a></header>
  <ApplicationSplash appName="Aether CAD" tagline="From an idea to something real" version="Development preview" artworkUrl={background.url}
   state={state} headline={{loading:'Preparing your workspace',ready:'Ready to create',offline:'Ready to work offline',error:'Unable to connect to Studio'}[state]}
   detail={{loading:'Bringing your tools and preferences together.',ready:'Everything is in place. Make something yours.',offline:'Your local tools are ready. Sync can wait.',error:'Check your connection, then try again.'}[state]}
   progress={state==='loading'?.62:state==='error'?.82:1} stages={stages}
   footnote="A space for your next idea."
   actions={state==='error'?<><Button onClick={()=>setState('loading')}>Try again</Button><Button onClick={()=>setState('offline')}>Continue offline</Button></>:undefined}/>
  <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}} aria-label="Preview startup state"><span style={{fontSize:12,marginRight:8}}>Preview state</span>{(['loading','ready','offline','error'] as const).map(value=><Button key={value} active={state===value} onClick={()=>setState(value)}>{value[0].toUpperCase()+value.slice(1)}</Button>)}</div>
  <div style={{display:'flex',flexWrap:'wrap',gap:12}} aria-label="Splash backgrounds">{backgrounds.map(item=><button key={item.name} onClick={()=>setBackground(item)} aria-pressed={background.name===item.name} style={{width:130,padding:0,overflow:'hidden',borderRadius:8,border:background.name===item.name?'2px solid #78d8ff':'2px solid #ffffff26',background:'#162232',color:'#e6f2ff',cursor:'pointer'}}><img src={item.url} alt="" style={{display:'block',width:'100%',aspectRatio:'16/9',objectFit:'cover'}}/><span style={{display:'block',padding:8}}>{item.name}</span></button>)}</div>
 </main>;
}

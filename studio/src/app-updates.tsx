import type {ApplicationUpdate} from '@aether/ui';
import {AppUpdateArtwork} from './AppUpdateArtwork';
type Feature = Omit<ApplicationUpdate,'artwork'> & {scene: Parameters<typeof AppUpdateArtwork>[0]['scene']};
// Editorial copy lives with the hosted app library, separate from the shared UI widget.
// Evidence: product source + Aether_Map_Lazy_Lighting_Acceptance, Aether_Sketch_Standard.
const features: Record<'map'|'animation'|'io'|'sketch'|'studio', Feature[]> = {
 studio:[
  {id:'apps',title:'Your tools, together',description:'Open your enabled Aether applications from one account and workspace.',status:'Available',scene:'library',color:'#a8cbbd'},
  {id:'files',title:'Keep your team organized',description:'Use Drive to browse personal files and shared organization workspaces across apps.',status:'Available',scene:'library',color:'#b7c8e6'},
  {id:'desktop',title:'A home on your desktop',description:'Native desktop packaging is planned, with app-specific local file and engine connections.',status:'Planned',scene:'library',color:'#edc29e'},
 ],
 map:[
  {id:'surfaces',title:'Make every surface a canvas',description:'Position and warp projection surfaces to fit the physical shapes in your show.',status:'Available',scene:'projection',color:'#bbb4e3'},
  {id:'effects',title:'Shape your visual look',description:'Layer source effects such as blur, rotation and color cycling, with controls saved in your show.',status:'Available',scene:'effects',color:'#edc79d'},
  {id:'more-effects',title:'More ways to transform light',description:'Kaleidoscope, fisheye and vintage effects are planned additions to the visual effects collection.',status:'Planned',scene:'effects',color:'#9ebfcf'},
 ],
 animation:[
  {id:'rig',title:'Give your character structure',description:'Inspect a character’s joints and adjust its pose in the rigging workspace.',status:'Available',scene:'rig',color:'#a8cbbd'},
  {id:'playback',title:'See motion over time',description:'Scrub and play existing clips with joint tracks shown on the timeline. Track editing is still in development.',status:'Available',scene:'timeline',color:'#bac9e4'},
  {id:'authoring',title:'Build the next performance',description:'Create and edit motion clips directly in the web timeline as the authoring tools expand.',status:'Planned',scene:'timeline',color:'#ecc19d'},
 ],
 io:[
  {id:'circuits',title:'Connect your ideas',description:'Place components and draw wires in the early circuit editor. Save your design as an Aether IO document.',status:'Preview',scene:'circuit',color:'#a6cbbb'},
  {id:'simulation',title:'Test before you build',description:'Circuit simulation is planned. The current interface is not connected to a circuit solver.',status:'Planned',scene:'circuit',color:'#b9c9e6'},
  {id:'fabrication',title:'From board to build',description:'Fabrication and assembly exports are planned as board and footprint support develops.',status:'Planned',scene:'board',color:'#e6c28e'},
 ],
 sketch:[
  {id:'paths',title:'Find the perfect curve',description:'Draw editable paths, adjust their nodes and organize your artwork into layers.',status:'Available',scene:'paths',color:'#abc6df'},
  {id:'paint',title:'Color with more control',description:'Use gradient fills, stroke styles and clipping groups to refine your vector artwork.',status:'Available',scene:'paint',color:'#efc2a9'},
  {id:'brushes',title:'A more expressive brush',description:'Pressure-sensitive raster brushes, textured paint and image layers are planned. Today’s Pencil creates editable vector paths.',status:'Planned',scene:'paint',color:'#b7cfb2'},
 ],
};
export const APP_UPDATES = Object.fromEntries(Object.entries(features).map(([app,items])=>[app,items.map(({scene,...item})=>({...item,artwork:<AppUpdateArtwork scene={scene}/>}))])) as Record<keyof typeof features,ApplicationUpdate[]>;

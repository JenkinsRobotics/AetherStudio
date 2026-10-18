import presenter from "@aether/assets/illustrations/avatar-studio/presenter.png";
import woodland from "@aether/assets/illustrations/avatar-studio/woodland.png";
export { presenter, woodland };
export const SCENES = [
  { id:"forest", label:"Forest room", detail:"Soft daylight", image:woodland, filter:"brightness(.72) saturate(.75)", background:"#142725" },
  { id:"moonlight", label:"Moonlit grove", detail:"Cool evening", image:woodland, filter:"brightness(.42) saturate(.6) hue-rotate(28deg)", background:"#152634" },
  { id:"studio", label:"Studio", detail:"Warm charcoal", image:undefined, filter:undefined, background:"radial-gradient(ellipse at 50% 35%, #485452, #151919 75%)" },
  { id:"sunset", label:"Golden hour", detail:"Amber woodland", image:woodland, filter:"sepia(.65) saturate(.9) brightness(.8)", background:"#3c3326" },
];
export const LOOKS = [
  { id:"original", label:"Silver", detail:"Original look", filter:"none" },
  { id:"warm", label:"Amber", detail:"Warm finish", filter:"sepia(.28) saturate(1.2)" },
  { id:"cool", label:"Moonstone", detail:"Cool finish", filter:"hue-rotate(175deg) saturate(.5)" },
  { id:"mono", label:"Graphite", detail:"Monochrome", filter:"grayscale(1)" },
];
export const OUTPUTS = [
  { id:"1080", label:"1920 × 1080", width:1920, height:1080 },
  { id:"720", label:"1280 × 720", width:1280, height:720 },
  { id:"1440", label:"2560 × 1440", width:2560, height:1440 },
  { id:"portrait", label:"1080 × 1920", width:1080, height:1920 },
  { id:"square", label:"1080 × 1080", width:1080, height:1080 },
];
export type Stroke = { color:string; width:number; points:readonly [number,number][] };
export type SceneState = { scene:string; look:string; output:string; zoom:number; offset:number; mirrored:boolean; strokes:readonly Stroke[]; caption:string; captionColor:string };
export const INITIAL:SceneState = {scene:"forest",look:"original",output:"1080",zoom:100,offset:0,mirrored:false,strokes:[],caption:"",captionColor:"#f38239"};

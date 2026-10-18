import { LOOKS, OUTPUTS, SCENES, presenter, type SceneState } from "./data";
export function coverRect(sw:number,sh:number,dw:number,dh:number) { const scale=Math.max(dw/sw,dh/sh);return {x:(dw-sw*scale)/2,y:(dh-sh*scale)/2,width:sw*scale,height:sh*scale}; }
const loadImage=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error("Could not load scene artwork."));image.src=src;});
export async function exportScene(state:SceneState) {
  const scene=SCENES.find(item=>item.id===state.scene)!, look=LOOKS.find(item=>item.id===state.look)!,output=OUTPUTS.find(item=>item.id===state.output)!;
  const canvas=document.createElement("canvas"); canvas.width=output.width;canvas.height=output.height;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Image export is unavailable in this browser.");
  const [avatar,background]=await Promise.all([loadImage(presenter),scene.image?loadImage(scene.image):Promise.resolve(null)]);
  const w=output.width,h=output.height;
  if(background){const box=coverRect(background.width,background.height,w,h);ctx.filter=scene.filter??"none";ctx.drawImage(background,box.x,box.y,box.width,box.height);}
  else {const gradient=ctx.createRadialGradient(w/2,h*.35,0,w/2,h*.35,Math.max(w,h)*.75);gradient.addColorStop(0,"#485452");gradient.addColorStop(1,"#151919");ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);}
  ctx.filter=look.filter;const ah=h*1.5,aw=ah*avatar.width/avatar.height,scale=state.zoom/100;
  ctx.save();ctx.translate(w*(.5+state.offset/100),h*.02+ah*.3);ctx.scale(scale*(state.mirrored?-1:1),scale);ctx.drawImage(avatar,-aw/2,-ah*.3,aw,ah);ctx.restore();ctx.filter="none";
  for(const stroke of state.strokes){if(!stroke.points.length)continue;ctx.beginPath();ctx.strokeStyle=stroke.color;ctx.lineWidth=stroke.width*w/1000;ctx.lineCap="round";ctx.lineJoin="round";stroke.points.forEach(([x,y],i)=>i?ctx.lineTo(x*w,y*h):ctx.moveTo(x*w,y*h));ctx.stroke();}
  ctx.fillStyle=state.captionColor;ctx.font=`600 ${34*w/1000}px sans-serif`;ctx.fillText(state.caption,w*.065,h*.82);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("Could not create the image.")),"image/png"));
  return {blob,fileName:`aether-avatar-${scene.id}-${w}x${h}.png`,width:w,height:h};
}

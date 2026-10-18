import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Button, ViewportNavigationCube, type StandardViewportView, type ViewportOrientation } from "../src/index";
import type { AppearanceValue } from "../src/ConceptWidgets";
import type { PartRow } from "./AnimationStudioCatalog";
import { useAnimationStudioPreference } from "./AnimationStudioPreferences";

export interface StudioCameraSnapshot { position:number[];up:number[];target:number[];zoom:number;projection:string;fieldOfView:string; }
export interface StudioCameraStore { current:StudioCameraSnapshot|null; previous:StudioCameraSnapshot|null; named:Map<string,StudioCameraSnapshot>; requestSerial?:number; }
export const createStudioCameraStore=():StudioCameraStore=>({current:null,previous:null,named:new Map()});

/** Gallery-owned geometry fixture. No CAD engine, rig evaluator, or product document. */
export function StudioModelPreview({parts, selectedID, onSelect, appearance, exploded = false, manipulator = false, cameraRequest,cameraStore}: {
  parts: readonly PartRow[]; selectedID?: string; onSelect?: (id: string) => void;
  appearance: AppearanceValue; exploded?: boolean; manipulator?: boolean;
  cameraRequest?: {command:string;serial:number};cameraStore?:StudioCameraStore;
}) {
  const host = useRef<HTMLDivElement>(null);
  const transforms=useRef(new Map<string,{position:number[];rotation:number[];scale:number[]}>());
  const [transformMode,setTransformMode]=useState<"translate"|"rotate"|"scale">("translate");
  const [transformValue,setTransformValue]=useState("X 0 · Y 0 · Z 0");
  const localCameraStore=useRef(createStudioCameraStore());
  const store=cameraStore??localCameraStore.current;
  const [ready, setReady] = useState(false);
  const [orientation, setOrientation] = useState<ViewportOrientation>([0,0,0,1]);
  const controls = useRef<{fit:()=>void;view:(view:StandardViewportView)=>void;nudge:(x:number,y:number)=>void;roll:(n:number)=>void} | undefined>(undefined);
  const cameraCommands=useRef<(command:string)=>void>(()=>{});
  const callbacks = useRef(onSelect); callbacks.current = onSelect;
  const [showCube] = useAnimationStudioPreference("view-cube", true);
  const [showOrigin] = useAnimationStudioPreference("origin", true);
  const [showGrid] = useAnimationStudioPreference("floor-grid", true);
  const [background] = useAnimationStudioPreference<string>("background","#e8eaee");
  const [roughness] = useAnimationStudioPreference<number>("roughness",.48);
  const [metallic] = useAnimationStudioPreference<number>("metallic",.02);
  const [intensity] = useAnimationStudioPreference<number>("lighting-intensity",1);
  const [style] = useAnimationStudioPreference<string>("render-style", "Shaded");
  const [edges] = useAnimationStudioPreference("feature-edges", true);
  const [edgeColor] = useAnimationStudioPreference<string>("edge-color","#5e6670");
  const [gridOpacity] = useAnimationStudioPreference<number>("grid-opacity",.24);
  const [reverseZoom] = useAnimationStudioPreference("reverse-zoom", false);
  const [projection,setProjection] = useAnimationStudioPreference<string>("projection","Perspective");
  const [fieldOfView,setFieldOfView] = useAnimationStudioPreference<string>("field-of-view","45");
  const [navigation] = useAnimationStudioPreference<string>("camera-navigation","Orbit");
  const [orbitSpeed] = useAnimationStudioPreference<string>("orbit-speed","Standard");
  const [panSpeed] = useAnimationStudioPreference<string>("pan-speed","Standard");
  const [zoomSpeed] = useAnimationStudioPreference<string>("zoom-speed","Reduced");
  const [backgroundMode] = useAnimationStudioPreference<string>("background-mode","Solid");
  const [secondaryBackground] = useAnimationStudioPreference<string>("background-secondary","#adb5bf");
  const [sectionEnabled] = useAnimationStudioPreference("section-enabled", false);
  const [sectionAxis] = useAnimationStudioPreference<string>("section-axis","X");
  const [sectionPosition] = useAnimationStudioPreference<number>("section-position",0);
  const [edgeDisplay] = useAnimationStudioPreference<string>("edge-display","Feature edges");
  const [gridSpacing] = useAnimationStudioPreference<number>("grid-spacing",.1);
  const [gridExtent] = useAnimationStudioPreference<number>("grid-extent",10);
  const [selectionColor] = useAnimationStudioPreference<string>("selection-color","#ff982b");
  const [environmentRotation] = useAnimationStudioPreference<number>("environment-rotation",0);
  const [keyColor] = useAnimationStudioPreference<string>("key-color","#fff7e8");
  const [keyIntensity] = useAnimationStudioPreference<number>("key-intensity",3000);
  const [fillColor] = useAnimationStudioPreference<string>("fill-color","#c7e0ff");
  const [fillIntensity] = useAnimationStudioPreference<number>("fill-intensity",840);
  const [rimColor] = useAnimationStudioPreference<string>("rim-color","#ffffff");
  const [rimIntensity] = useAnimationStudioPreference<number>("rim-intensity",1500);
  useEffect(() => {
    const element=host.current;
    if (!element || typeof WebGL2RenderingContext === "undefined") return;
    let renderer: THREE.WebGLRenderer;
    try { renderer=new THREE.WebGLRenderer({antialias:true,alpha:true}); } catch { return; }
    const previousCamera=store.current;
    const scene=new THREE.Scene(); scene.background=backgroundMode==="Solid" ? new THREE.Color(background) : null;
    element.style.background=backgroundMode==="Gradient" ? `linear-gradient(${background},${secondaryBackground})` : "transparent";
    renderer.localClippingEnabled=sectionEnabled;
    renderer.clippingPlanes=sectionEnabled ? [new THREE.Plane(new THREE.Vector3(sectionAxis==="X"?1:0,sectionAxis==="Y"?1:0,sectionAxis==="Z"?1:0),-sectionPosition)] : [];
    const camera=projection==="Orthographic" ? new THREE.OrthographicCamera(-5,5,5,-5,.01,100) : new THREE.PerspectiveCamera(Number(fieldOfView),1,.01,100);
    const orbit=new OrbitControls(camera,renderer.domElement); orbit.target.set(0,1.5,0);
    const speeds:Record<string,number>={Slow:.25,Reduced:.5,Standard:1,Fast:1.5,"Very Fast":2};
    orbit.zoomSpeed=(reverseZoom ? -1 : 1)*(speeds[zoomSpeed]??1);
    orbit.rotateSpeed=speeds[orbitSpeed]??1;orbit.panSpeed=speeds[panSpeed]??1;
    orbit.mouseButtons.LEFT=navigation==="Pan"?THREE.MOUSE.PAN:navigation==="Zoom"?THREE.MOUSE.DOLLY:THREE.MOUSE.ROTATE;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    element.appendChild(renderer.domElement);
    const meshes: THREE.Mesh[]=[];
    const geometries: THREE.BufferGeometry[]=[];
    const materials: THREE.Material[]=[];
    parts.forEach((part,index) => {
      const geometry=part.primitive === "sphere" ? new THREE.SphereGeometry(.5,32,24) : part.primitive === "cylinder" ? new THREE.CylinderGeometry(.4,.4,1,32) : new THREE.BoxGeometry(index===0?1.1:.65,index===0?.8:1,index===0?.8:.6,appearance.tessellation==="high"?4:1);
      const options={color:part.id===selectedID?selectionColor:appearance.color,transparent:true,opacity:style==="Translucent"?.34:appearance.opacity/100,wireframe:style==="Wireframe"};
      const material=style==="Unshaded" ? new THREE.MeshBasicMaterial(options) : new THREE.MeshStandardMaterial({...options,roughness,metalness:metallic});
      const mesh=new THREE.Mesh(geometry,material); mesh.userData.partID=part.id;
      const row=Math.floor(index/3),column=index%3-1;
      mesh.position.set(column*(exploded?1.8:.85),3-row*(exploded?1.45:1.02),exploded?column*.4:0);
      if(part.positionMM)mesh.position.add(new THREE.Vector3(...part.positionMM).multiplyScalar(.001));
      scene.add(mesh);meshes.push(mesh);geometries.push(geometry);materials.push(material);
      if (edgeDisplay!=="Hidden" && (edges || style==="Shaded with Edges")) {
        const lines=edgeDisplay==="All edges" ? new THREE.WireframeGeometry(geometry) : new THREE.EdgesGeometry(geometry); const lineMaterial=new THREE.LineBasicMaterial({color:edgeColor});
        mesh.add(new THREE.LineSegments(lines,lineMaterial));geometries.push(lines);materials.push(lineMaterial);
      }
    });
    if(showGrid) { const grid=new THREE.GridHelper(gridExtent,Math.min(1000,Math.max(2,Math.round(gridExtent/Math.max(.001,gridSpacing))))); const mats=Array.isArray(grid.material)?grid.material:[grid.material]; mats.forEach(m=>{m.transparent=true;m.opacity=gridOpacity;});scene.add(grid);geometries.push(grid.geometry);materials.push(...mats); }
    if(showOrigin) {const axes=new THREE.AxesHelper(1);scene.add(axes);geometries.push(axes.geometry);materials.push(...(Array.isArray(axes.material)?axes.material:[axes.material]));}
    scene.add(new THREE.HemisphereLight(0xffffff,0x56616c,intensity*2));
    const key=new THREE.DirectionalLight(keyColor,intensity*keyIntensity/1000);key.position.set(3,5,4).applyAxisAngle(new THREE.Vector3(0,1,0),environmentRotation*Math.PI/180);scene.add(key);
    const fill=new THREE.DirectionalLight(fillColor,intensity*fillIntensity/1000);fill.position.set(-4,2,1);scene.add(fill);
    const rim=new THREE.DirectionalLight(rimColor,intensity*rimIntensity/1000);rim.position.set(0,4,-4);scene.add(rim);
    const render=()=>{renderer.render(scene,camera);store.current={position:camera.position.toArray(),up:camera.up.toArray(),target:orbit.target.toArray(),zoom:camera.zoom,projection,fieldOfView};setOrientation(camera.quaternion.toArray() as unknown as ViewportOrientation);};
    const fit=()=>{camera.up.set(0,1,0);camera.position.set(5,4.5,7);orbit.target.set(0,1.5,0);orbit.update();render();};
    controls.current={fit,view:(view)=>{const positions:Record<string,number[]>={front:[0,0,8],back:[0,0,-8],left:[-8,0,0],right:[8,0,0],top:[0,8,.001],bottom:[0,-8,.001]};const p=positions[view]??[5,4,7];camera.position.set(...p as [number,number,number]).add(orbit.target);orbit.update();render();},nudge:(x,y)=>{const offset=camera.position.clone().sub(orbit.target);const spherical=new THREE.Spherical().setFromVector3(offset);spherical.theta+=x*Math.PI/12;spherical.phi=Math.max(.01,Math.min(Math.PI-.01,spherical.phi+y*Math.PI/12));camera.position.setFromSpherical(spherical).add(orbit.target);orbit.update();render();},roll:(n)=>{camera.up.applyAxisAngle(camera.getWorldDirection(new THREE.Vector3()),n*Math.PI/2);orbit.update();render();}};
    cameraCommands.current=(command)=>{
      const current:StudioCameraSnapshot={position:camera.position.toArray(),up:camera.up.toArray(),target:orbit.target.toArray(),zoom:camera.zoom,projection,fieldOfView};
      const restore=(view:StudioCameraSnapshot)=>{store.previous=current;camera.zoom=view.zoom;camera.updateProjectionMatrix();setProjection(view.projection);setFieldOfView(view.fieldOfView);camera.position.fromArray(view.position);camera.up.fromArray(view.up);orbit.target.fromArray(view.target);orbit.update();render();};
      if(command.startsWith("save:"))store.named.set(command.slice(5),current);
      else if(command.startsWith("delete:"))store.named.delete(command.slice(7));
      else if(command.startsWith("restore:")){const view=store.named.get(command.slice(8));if(view)restore(view);}
      else if(command==="previous"){if(store.previous)restore(store.previous);}
      else if(command==="frame-selection"){const mesh=meshes.find(item=>item.userData.partID===selectedID);if(mesh){store.previous=current;orbit.target.copy(mesh.position);camera.position.copy(mesh.position).add(new THREE.Vector3(2,2,3));orbit.update();render();}}
    };
    let gizmo: TransformControls | undefined;
    if(manipulator && meshes.length) {
      const model=meshes.find(mesh=>mesh.userData.partID===selectedID) ?? meshes[0];
      const stored=transforms.current.get(model.userData.partID);
      if(stored){model.position.fromArray(stored.position);model.rotation.fromArray(stored.rotation as [number,number,number]);model.scale.fromArray(stored.scale);}
      gizmo=new TransformControls(camera,renderer.domElement);gizmo.setMode(transformMode);gizmo.attach(model);scene.add(gizmo.getHelper());
      gizmo.addEventListener("dragging-changed",(event)=>{orbit.enabled=!event.value;});
      gizmo.addEventListener("change",render);
      gizmo.addEventListener("objectChange",()=>{
        transforms.current.set(model.userData.partID,{position:model.position.toArray(),rotation:model.rotation.toArray() as number[],scale:model.scale.toArray()});
        const values=transformMode==="rotate" ? [model.rotation.x,model.rotation.y,model.rotation.z].map(v=>v*180/Math.PI) : transformMode==="scale" ? model.scale.toArray() : model.position.toArray();
        setTransformValue(values.map((value,index)=>`${["X","Y","Z"][index]} ${value.toFixed(2)}`).join(" · "));
      });
    }
    orbit.addEventListener("change",render);
    const resize=()=>{const width=Math.max(1,element.clientWidth),height=Math.max(1,element.clientHeight);renderer.setSize(width,height);if(camera instanceof THREE.PerspectiveCamera)camera.aspect=width/height;else {camera.left=-5*width/height;camera.right=5*width/height;}camera.updateProjectionMatrix();render();};
    const observer=new ResizeObserver(resize);observer.observe(element);
    let down={x:0,y:0};const pointerDown=(event:PointerEvent)=>{down={x:event.clientX,y:event.clientY};};
    const select=(event:PointerEvent)=>{if(Math.hypot(event.clientX-down.x,event.clientY-down.y)>4)return;const rect=renderer.domElement.getBoundingClientRect();const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);const hit=ray.intersectObjects(meshes,false)[0];if(hit)callbacks.current?.(hit.object.userData.partID);};
    renderer.domElement.addEventListener("pointerdown",pointerDown);renderer.domElement.addEventListener("pointerup",select);
    if(previousCamera) {camera.zoom=previousCamera.zoom;camera.updateProjectionMatrix();camera.position.fromArray(previousCamera.position);camera.up.fromArray(previousCamera.up);orbit.target.fromArray(previousCamera.target);orbit.update();} else fit();
    resize();setReady(true);
    return ()=>{observer.disconnect();gizmo?.dispose();orbit.dispose();renderer.domElement.removeEventListener("pointerdown",pointerDown);renderer.domElement.removeEventListener("pointerup",select);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();controls.current=undefined;};
  },[parts,selectedID,appearance,exploded,background,showGrid,showOrigin,roughness,metallic,intensity,style,edges,edgeColor,gridOpacity,reverseZoom,manipulator,transformMode,projection,fieldOfView,navigation,orbitSpeed,panSpeed,zoomSpeed,backgroundMode,secondaryBackground,sectionEnabled,sectionAxis,sectionPosition,edgeDisplay,gridSpacing,gridExtent,selectionColor,environmentRotation,keyColor,keyIntensity,fillColor,fillIntensity,rimColor,rimIntensity,store]);
  useEffect(()=>{if(cameraRequest && store.requestSerial!==cameraRequest.serial){store.requestSerial=cameraRequest.serial;cameraCommands.current(cameraRequest.command);}},[cameraRequest,store]);
  return <div className="animation-model-preview">
    <div ref={host} className="animation-model-canvas" aria-label="Sample rig preview"/>
    {!ready ? <p className="animation-model-unavailable">3D preview requires WebGL. Use Table to inspect the sample parts.</p> : null}
    {showCube ? <ViewportNavigationCube orientation={orientation} onSelectView={(view)=>controls.current?.view(view)} onFit={()=>controls.current?.fit()} onNudge={(x,y)=>controls.current?.nudge(x,y)} onRoll={(n)=>controls.current?.roll(n)}/> : null}
    {manipulator ? <div className="animation-manipulator-controls">{(["translate","rotate","scale"] as const).map(mode=><Button key={mode} aria-pressed={transformMode===mode} onClick={()=>setTransformMode(mode)}>{mode === "translate" ? "Move" : mode === "rotate" ? "Rotate" : "Scale"}</Button>)}<output>{transformValue}</output></div> : null}
    <div className="animation-viewport-caption"><strong>3D MODELING VIEW</strong><span>Sample rig · {parts.length} parts</span><Button onClick={()=>controls.current?.fit()}>Frame all</Button></div>
  </div>;
}

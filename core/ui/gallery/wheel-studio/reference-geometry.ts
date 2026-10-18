import * as THREE from "three";
import type { WheelStudy } from "./state";
import { MM_PER_UNIT } from "./geometry";
/** The reference has a long cylindrical tread, a deep dish and a broad rear flange. */
export function referenceProfile(study: WheelStudy) {
  const r=study.diameter/2,w=study.width,b=study.bore/2,f=study.flange,e=study.rounding;
  const points: THREE.Vector2[]=[];
  const line=(x:number,z:number)=>points.push(new THREE.Vector2(x/MM_PER_UNIT,z/MM_PER_UNIT));
  const curve=(cx:number,cz:number,x:number,z:number)=>{ const start=points.at(-1)!;points.push(...new THREE.QuadraticBezierCurve(start,new THREE.Vector2(cx/MM_PER_UNIT,cz/MM_PER_UNIT),new THREE.Vector2(x/MM_PER_UNIT,z/MM_PER_UNIT)).getPoints(12).slice(1)); };
  line(b,w*.10);line(r*.27,w*.10);curve(r*.31,w*.09,r*.34,0);
  line(r*.69,-w*.04);curve(r*.83,-w*.04,r*.87,w*.12);
  line(r*.90,w*.51-e);curve(r*.90,w*.51,r*.90+e,w*.51);line(r-e,w*.51);
  curve(r,w*.51,r,w*.51-e);line(r,-w*.02);curve(r,-w*.23,r*.93,-w*.31);
  curve(r*.92,-w*.39,r*1.03,-w*.40);line(r+f,-w*.40);line(r+f,-w*.54);
  line(r*.98,-w*.54);curve(r*.90,-w*.54,r*.83,-w*.47);line(r*.33,-w*.43);line(b,-w*.43);line(b,w*.10);
  return points;
}
export function referenceWheel(study: WheelStudy, assembly=false) {
  const root=new THREE.Group(),profile=referenceProfile(study),r=(study.diameter/2+study.flange)/MM_PER_UNIT;
  const material=new THREE.MeshPhysicalMaterial({color:study.color,metalness:study.metalness,roughness:study.roughness,clearcoat:.08,side:THREE.DoubleSide});
  const geometry=new THREE.LatheGeometry(profile,192);geometry.rotateX(Math.PI/2);
  const wheel=new THREE.Mesh(geometry,material);wheel.userData.part="wheel";wheel.castShadow=true;wheel.position.y=r+.025;wheel.visible=study.visible;
  material.polygonOffset=true; material.polygonOffsetFactor=1; material.polygonOffsetUnits=1;
  const edgeMaterial=new THREE.LineBasicMaterial({color:"#11232f",transparent:true,opacity:.82});
  const circles=[[study.bore/2,study.width*.10],[study.diameter*.135,study.width*.10],[study.diameter*.45+study.rounding,study.width*.51],[study.diameter*.485,study.width*.51],[study.diameter/2+study.flange,-study.width*.40],[study.diameter/2+study.flange,-study.width*.54],[study.diameter*.515,-study.width*.40]];
  for(const [radius,z] of circles){const points=Array.from({length:193},(_,i)=>{const a=i/192*Math.PI*2;return new THREE.Vector3(Math.sin(a)*radius/MM_PER_UNIT,Math.cos(a)*radius/MM_PER_UNIT,z/MM_PER_UNIT)});const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),edgeMaterial);line.userData.edge=true;wheel.add(line);}
  // Six shallow reinforcement ribs on the recessed web, modeled as actual meshes.
  for(let i=0;i<6;i++){
    const angle=i*Math.PI/3,inner=study.diameter*.17/MM_PER_UNIT,outer=study.diameter*.33/MM_PER_UNIT;
    const rib=new THREE.Mesh(new THREE.BoxGeometry(.07,(outer-inner),.10),material);
    rib.position.set(Math.sin(angle)*(inner+outer)/2,Math.cos(angle)*(inner+outer)/2,study.width*.02/MM_PER_UNIT);rib.rotation.z=-angle;rib.userData.part="wheel";rib.castShadow=true;wheel.add(rib);
    const outline=new THREE.LineSegments(new THREE.EdgesGeometry(rib.geometry),edgeMaterial);outline.userData.edge=true;rib.add(outline);
  }
  root.add(wheel);
  if(assembly){const spacing=study.diameter*1.1/MM_PER_UNIT;wheel.position.z=spacing/2;const second=wheel.clone();second.rotation.y=Math.PI;second.position.z=-spacing/2;root.add(second);const axle=new THREE.Mesh(new THREE.CylinderGeometry(study.bore/MM_PER_UNIT*.46,study.bore/MM_PER_UNIT*.46,spacing+study.width/MM_PER_UNIT,64),new THREE.MeshPhysicalMaterial({color:"#7b8d9e",metalness:.85,roughness:.3}));axle.rotation.x=Math.PI/2;axle.position.y=r+.025;axle.userData.part="axle";axle.castShadow=true;root.add(axle);}
  const box=new THREE.Box3Helper(new THREE.Box3().setFromObject(root),new THREE.Color("#6eb7fa"));box.userData.bounds=true;root.add(box);root.userData.radius=r;return root;
}

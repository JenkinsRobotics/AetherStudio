/** Original artwork lives in the shared asset package. */
import * as THREE from 'three';
import { buildPart as buildLegacy, disposePart } from '@aether/assets/models/scifirobot/geometry';
import { modelStudioEnvironment as look } from '@aether/assets/themes/rendering/model-studio';
import nativeMeshes from '@aether/assets/models/scifirobot/parametric/meshes.json?raw';
import type { ModelPart } from './state';
export { disposePart };
const meshes = JSON.parse(nativeMeshes) as Record<string,{vertices:number[];normals:number[];triangles:number[]}>;
export function buildPart(part:ModelPart):THREE.Group {
  if(part.shape !== 'cad-body') return buildLegacy({...part,shape:part.shape});
  const data=meshes[part.meshKey!];
  if(!data) throw Error(`Unknown generated CAD mesh: ${part.meshKey}`);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.vertices,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(data.normals,3));
  geometry.setIndex(data.triangles);
  const surface=new THREE.MeshStandardMaterial({...look.surface,color:part.color});
  const root=new THREE.Group(), mesh=new THREE.Mesh(geometry,surface);
  mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  root.userData={partID:part.id,meshKey:part.meshKey,surface,materials:[surface]};
  return root;
}

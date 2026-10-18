import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Study } from "./state";
const UNIT = 40;
/** Render-only enclosure study. Product CAD feature evaluation remains outside the gallery. */
export function enclosure(study: Study) {
  const root = new THREE.Group(), materials: THREE.Material[] = [];
  const body = new THREE.MeshPhysicalMaterial({ color: study.color, metalness: study.metalness, roughness: study.roughness, clearcoat: .22, clearcoatRoughness: .3 });
  const lid = body.clone(); materials.push(body, lid);
  const l = study.length / UNIT, w = study.width / UNIT, h = study.height / UNIT, r = study.radius / UNIT;
  const lower = new THREE.Mesh(new RoundedBoxGeometry(l, h, w, 8, r), body); lower.position.y = h / 2 + .025; lower.userData.part = "body"; lower.visible = study.body;
  // A shallow rounded cap with a tiny separation produces a physical seam.
  const upper = new THREE.Mesh(new RoundedBoxGeometry(l - .022, .09, w - .022, 8, Math.min(.044, r)), lid);
  upper.position.y = h + .055 + (study.exploded ? .65 : 0); upper.userData.part = "lid"; upper.visible = study.lid;
  root.add(lower, upper);
  for (const object of [lower, upper]) { object.castShadow = true; object.receiveShadow = true; }
  root.userData.materials = materials;
  return root;
}
export function disposeEnclosure(root: THREE.Group) {
  root.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) object.geometry.dispose(); });
  for (const material of root.userData.materials as THREE.Material[]) material.dispose();
}

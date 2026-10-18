import * as THREE from "three";
import type { WheelStudy } from "./state";
export const MM_PER_UNIT = 80;
/** Closed annular render profile: axle bore, hub, recessed web, tread and flange.
 * This is procedural preview geometry, not a product CAD feature evaluator. */
export function wheelProfile(wheel: WheelStudy): THREE.Vector2[] {
  const r = wheel.diameter / 2, w = wheel.width, b = wheel.bore / 2, f = wheel.flange;
  return [[b, w * .12], [r * .28, w * .12], [r * .33, -w * .13], [r * .7, -w * .24], [r * .82, -w * .13], [r * .86, w * .49], [r * .93, w * .5], [r, w * .43], [r, -w * .28], [r + f, -w * .34], [r + f, -w * .5], [r * .94, -w * .5], [r * .78, -w * .43], [r * .32, -w * .37], [b, -w * .37]].map(([x, y]) => new THREE.Vector2(x / MM_PER_UNIT, y / MM_PER_UNIT));
}
function roundedProfile(points: THREE.Vector2[], radius: number) {
  const result: THREE.Vector2[] = [];
  points.forEach((point, i) => {
    const prev = points[(i + points.length - 1) % points.length], next = points[(i + 1) % points.length];
    const distance = Math.min(radius, point.distanceTo(prev) * .35, point.distanceTo(next) * .35);
    const start = point.clone().add(prev.clone().sub(point).normalize().multiplyScalar(distance));
    const end = point.clone().add(next.clone().sub(point).normalize().multiplyScalar(distance));
    result.push(...new THREE.QuadraticBezierCurve(start, point, end).getPoints(6));
  });
  result.push(result[0].clone()); return result;
}
export function wheelModel(study: WheelStudy, assembly = false) {
  const root = new THREE.Group(), profile = wheelProfile(study), radius = (study.diameter / 2 + study.flange) / MM_PER_UNIT;
  const geometry = new THREE.LatheGeometry(roundedProfile(profile, study.rounding / MM_PER_UNIT), 192);
  geometry.rotateX(Math.PI / 2); // The axle runs along Z; Y remains the scene up axis.
  const material = new THREE.MeshPhysicalMaterial({ color: study.color, roughness: study.roughness, metalness: study.metalness, clearcoat: .18, side: THREE.DoubleSide });
  const lineMaterial = new THREE.LineBasicMaterial({ color: "#13212b", transparent: true, opacity: .85 });
  const wheel = new THREE.Mesh(geometry, material); wheel.userData.part = "wheel"; wheel.castShadow = true; wheel.receiveShadow = false;
  // Lathe triangle edges are not feature edges. Draw only the profile's circular boundaries.
  for (const index of [0, 1, 4, 5, 6, 8, 9, 10, 11]) {
    const p = profile[index]; const points = Array.from({ length: 193 }, (_, i) => { const a = i / 192 * Math.PI * 2; return new THREE.Vector3(Math.sin(a) * p.x, Math.cos(a) * p.x, p.y); });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial); line.userData.edge = true; wheel.add(line);
  }
  wheel.position.y = radius + .025; wheel.visible = study.visible; root.add(wheel);
  if (assembly) {
    const spacing = study.diameter * 1.05 / MM_PER_UNIT;
    wheel.position.z = spacing / 2; const other = wheel.clone(); other.rotation.y = Math.PI; other.position.z = -spacing / 2; other.userData.part = "wheel"; root.add(other);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(study.bore / MM_PER_UNIT * .46, study.bore / MM_PER_UNIT * .46, spacing + study.width / MM_PER_UNIT, 64), new THREE.MeshPhysicalMaterial({ color: "#687582", metalness: .9, roughness: .34 }));
    axle.rotation.x = Math.PI / 2; axle.position.y = radius + .025; axle.castShadow = true; axle.userData.part = "axle"; root.add(axle);
  }
  const box = new THREE.Box3().setFromObject(root), bounds = new THREE.Box3Helper(box, new THREE.Color("#679ce8")); bounds.userData.bounds = true; root.add(bounds);
  root.userData.radius = radius; return root;
}
export function disposeWheel(root: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  root.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Line) { geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material)); } });
  geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose());
}

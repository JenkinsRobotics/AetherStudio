import * as THREE from "three";
import { modelStudioEnvironment as look } from '../../themes/rendering/model-studio';
export interface StudyMeshPart { id: string; color: string; shape: 'shell'|'lens'|'hub'|'vents'|'sensors'|'seams'|'antenna'|'sphere'|'box'|'cylinder'|'torus'; }

/** Original procedural study. All visible details are actual mesh geometry. */
export function buildPart(part: StudyMeshPart): THREE.Group {
  const root = new THREE.Group(); root.userData.partID = part.id;
  const surface = new THREE.MeshStandardMaterial({ ...look.surface, color: part.color });
  const dark = new THREE.MeshStandardMaterial({ ...look.detailSurfaces.dark });
  const metal = new THREE.MeshStandardMaterial({ ...look.detailSurfaces.metal });
  const glass = new THREE.MeshPhysicalMaterial({ ...look.detailSurfaces.glass });
  function mesh(geometry: THREE.BufferGeometry, position: [number, number, number], material: THREE.Material = surface) {
    const object = new THREE.Mesh(geometry, material); object.position.set(...position); object.castShadow = true; object.receiveShadow = true; root.add(object); return object;
  }
  function ring(radius: number, tube: number, position: [number, number, number], material: THREE.Material = metal) { return mesh(new THREE.TorusGeometry(radius, tube, 12, 100), position, material); }
  function cylinder(radius: number, depth: number, position: [number, number, number], material: THREE.Material = surface) { const object = mesh(new THREE.CylinderGeometry(radius, radius, depth, 64), position, material); object.rotation.x = Math.PI / 2; return object; }
  if (part.shape === "shell") {
    // Leave the polar opening for a recessed optical assembly.
    const shell = mesh(new THREE.SphereGeometry(1.42, 96, 64, 0, Math.PI * 2, .72, Math.PI - .72), [0, 1.53, 0]);
    shell.rotation.x = Math.PI / 2;
    ring(.938, .032, [0, 1.53, 1.075]);
  } else if (part.shape === "lens") {
    cylinder(.94, .15, [0, 1.53, 1.13], dark);
    ring(.91, .055, [0, 1.53, 1.23]);
    cylinder(.69, .12, [0, 1.53, 1.25], dark);
    ring(.63, .018, [0, 1.53, 1.32], dark);
    const lens = mesh(new THREE.SphereGeometry(.46, 64, 32), [0, 1.53, 1.31], glass); lens.scale.z = .3;
    ring(.44, .023, [0, 1.53, 1.34], metal);
    cylinder(.15, .018, [0, 1.53, 1.46], glass);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; cylinder(.025, .025, [Math.cos(a) * .81, 1.53 + Math.sin(a) * .81, 1.25], metal); }
  } else if (part.shape === "hub") {
    for (const side of [-1, 1]) {
      for (const [radius, depth, x, material] of [[.69, .24, 1.23, dark], [.59, .2, 1.4, surface], [.44, .08, 1.54, metal], [.38, .09, 1.59, surface]] as const) {
        const object = cylinder(radius, depth, [side * x, 1.47, 0], material); object.rotation.set(0, 0, Math.PI / 2);
      }
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const bolt = cylinder(.032, .02, [side * 1.645, 1.47 + Math.sin(a) * .3, Math.cos(a) * .3], dark); bolt.rotation.set(0, 0, Math.PI / 2); }
      const slot = mesh(new THREE.BoxGeometry(.012, .24, .025), [side * 1.648, 1.47, 0], dark); slot.rotation.x = -.35;
    }
  } else if (part.shape === "vents") {
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      const y = 1.28 + i * .23;
      cylinder(.09, .63, [side * 1.05, y, .91]);
      ring(.081, .014, [side * 1.05, y, 1.235]);
      cylinder(.062, .01, [side * 1.05, y, 1.232], dark);
      for (let j = 0; j < 5; j++) ring(.092, .009, [side * 1.05, y, .7 + j * .09], dark);
    }
  } else if (part.shape === "sensors") {
    for (const x of [-.63, .63]) for (const y of [.57, 2.49]) {
      const sensor = mesh(new THREE.SphereGeometry(.155, 32, 24), [x, y, .81], glass); sensor.scale.set(1, .75, .55);
      ring(.11, .014, [x, y, .9], dark).scale.y = .75;
    }
  } else if (part.shape === "seams") {
    const belt = ring(1.423, .011, [0, 1.53, 0], dark); belt.rotation.y = Math.PI / 2;
    const grate = cylinder(.31, .03, [0, 2.915, -.05], dark); grate.rotation.x = 0;
    const trim = ring(.32, .024, [0, 2.93, -.05]); trim.rotation.x = Math.PI / 2;
    for (let i = -4; i <= 4; i++) { const x = i * .06, depth = Math.sqrt(.29 ** 2 - x ** 2) * 2; mesh(new THREE.BoxGeometry(.027, .025, depth), [x, 2.941, -.05], surface); }
    for (const x of [-.85, .85]) for (const y of [.69, 2.37]) cylinder(.021, .02, [x, y, .78], dark);
  } else if (part.shape === "antenna") {
    mesh(new THREE.CylinderGeometry(.035, .055, .55, 16), [-.78, 2.78, -.25], metal);
    mesh(new THREE.SphereGeometry(.075, 24, 16), [-.78, 3.06, -.25], dark);
  } else {
    const geometry = part.shape === "box" ? new THREE.BoxGeometry(.8, .8, .8) : part.shape === "cylinder" ? new THREE.CylinderGeometry(.4, .4, .9, 64) : part.shape === "torus" ? new THREE.TorusGeometry(.4, .13, 24, 64) : new THREE.SphereGeometry(.48, 48, 32);
    mesh(geometry, [0, .6, 0]);
  }
  // Retain all owned materials, including any unused by a particular part.
  if (!["sphere", "box", "cylinder", "torus"].includes(part.shape)) for (const child of root.children) child.position.y -= 1.53;
  root.userData.materials = [surface, dark, metal, glass];
  root.userData.surface = surface;
  return root;
}
export function disposePart(root: THREE.Group) {
  root.traverse(child => {
    if (child instanceof THREE.Mesh) child.geometry.dispose();
    if (child instanceof THREE.LineSegments) { child.geometry.dispose(); (child.material as THREE.Material).dispose(); }
  });
  for (const material of root.userData.materials as THREE.Material[]) material.dispose();
}

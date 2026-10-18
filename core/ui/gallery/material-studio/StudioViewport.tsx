import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import modelURL from "@aether/assets/models/lee-perry-smith/LeePerrySmith.glb?url";
import type { StudioMaterial, StudioObject, StudioTransform, Vector3 } from "./state";

export type StudioTool = "select" | "orbit" | "translate" | "rotate" | "scale";
interface Props {
  objects: readonly StudioObject[]; materials: readonly StudioMaterial[]; selected: string; tool: StudioTool;
  time: number; wireframe: boolean; grid: boolean; lights: { key: boolean; rim: boolean }; exposure: number;
  resetView: number; onSelect: (id: string) => void; onTransform: (id: string, transform: StudioTransform) => void;
}
const degrees = (value: number) => THREE.MathUtils.radToDeg(value);

/** The concept's renderer is gallery-owned; no product engine or document format. */
export function StudioViewport(props: Props) {
  const host = useRef<HTMLDivElement>(null), current = useRef(props);
  current.current = props;
  const [status, setStatus] = useState("Loading sculpture…");
  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
    catch { setStatus("The 3D preview needs WebGL. The material and scene controls remain available."); return; }
    let disposed = false, frame = 0;
    const controller = new AbortController();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor("#1c1d20");
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.setAttribute("aria-label", "Interactive sculpture preview");
    renderer.domElement.tabIndex = 0;
    container.append(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, 1, .1, 80);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true; orbit.minDistance = 3.2; orbit.maxDistance = 18;
    const resetCamera = () => { const offset = container.clientWidth / Math.max(1, container.clientHeight) > 1.6 ? 1.6 : 0; camera.position.set(offset, .35, 8.6); orbit.target.set(offset, -.15, 0); orbit.update(); };
    resetCamera();
    const ambient = new THREE.HemisphereLight("#a8bed9", "#0d0d0f", .12);
    const key = new THREE.DirectionalLight("#9bc7ff", 1.8); key.position.set(-4, 3, 5);
    const rim = new THREE.DirectionalLight("#ffcf91", 3); rim.position.set(3, 1, -2);
    const fill = new THREE.DirectionalLight("#f4f4f4", .12); fill.position.set(0, 3, 4);
    scene.add(ambient, key, rim, fill);
    const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(room, .04); scene.environment = environment.texture;
    room.dispose(); pmrem.dispose();
    const grid = new THREE.GridHelper(18, 36, "#484a50", "#2b2e33"); grid.position.y = -2.4; scene.add(grid);
    const roots = new Map<string, THREE.Group>(), surfaces = new Map<string, THREE.MeshPhysicalMaterial>();
    for (const object of current.current.objects) {
      const group = new THREE.Group(); group.userData.objectID = object.id; roots.set(object.id, group); scene.add(group);
      if (object.kind !== "head") group.add(new THREE.Mesh(object.kind === "cube" ? new THREE.BoxGeometry(1.5, 1.5, 1.5) : new THREE.SphereGeometry(.9, 48, 32)));
    }
    const gizmo = new TransformControls(camera, renderer.domElement); gizmo.setSize(.7); scene.add(gizmo.getHelper());
    gizmo.addEventListener("dragging-changed", event => { orbit.enabled = !event.value; });
    gizmo.addEventListener("objectChange", () => {
      const object = gizmo.object; if (!object) return;
      current.current.onTransform(String(object.userData.objectID), {
        position: object.position.toArray().map(v => Math.round(v * 1000) / 10) as Vector3,
        rotation: [object.rotation.x, object.rotation.y, object.rotation.z].map(v => Math.round(degrees(v) * 10) / 10) as Vector3,
        scale: object.scale.toArray().map(v => Math.max(.05, Math.round(v * 100) / 100)) as Vector3,
      });
    });
    function disposeObject(object: THREE.Object3D) {
      object.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); for (const material of Array.isArray(child.material) ? child.material : [child.material]) material.dispose(); } });
    }
    void fetch(modelURL, { signal: controller.signal }).then(response => { if (!response.ok) throw new Error("Model unavailable"); return response.arrayBuffer(); })
      .then(bytes => new GLTFLoader().parseAsync(bytes, ""))
      .then(gltf => {
        if (disposed) { disposeObject(gltf.scene); return; }
        const box = new THREE.Box3().setFromObject(gltf.scene), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
        const normalized = new THREE.Group(); gltf.scene.position.sub(center); normalized.add(gltf.scene); normalized.scale.setScalar(4.1 / size.y);
        gltf.scene.traverse(child => { if (child instanceof THREE.Mesh) { for (const material of Array.isArray(child.material) ? child.material : [child.material]) material.dispose(); child.material = new THREE.MeshPhysicalMaterial(); } });
        roots.get("head")!.add(normalized); setStatus("");
      }).catch(error => { if (!disposed && error.name !== "AbortError") setStatus("Could not load the sculpture. Reload to retry."); });
    const resize = () => { const { width, height } = container.getBoundingClientRect(); renderer.setSize(Math.max(1, width), Math.max(1, height), false); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); resetCamera(); };
    const observer = new ResizeObserver(resize); observer.observe(container); resize();
    let oldReset = current.current.resetView;
    const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(); let down: [number, number] | null = null;
    const pointerDown = (event: PointerEvent) => { down = [event.clientX, event.clientY]; };
    const pointerUp = (event: PointerEvent) => {
      if (!down || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 4 || gizmo.dragging) return;
      const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      ray.setFromCamera(pointer, camera);
      const hits = ray.intersectObjects([...roots.values()].filter(group => group.visible), true);
      if (hits[0]) { let object = hits[0].object; while (object.parent && !object.userData.objectID) object = object.parent; if (object.userData.objectID) current.current.onSelect(String(object.userData.objectID)); }
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown); renderer.domElement.addEventListener("pointerup", pointerUp);
    const draw = () => {
      if (disposed) return;
      const state = current.current;
      if (state.resetView !== oldReset) { resetCamera(); oldReset = state.resetView; }
      for (const material of state.materials) {
        let surface = surfaces.get(material.id); if (!surface) { surface = new THREE.MeshPhysicalMaterial(); surfaces.set(material.id, surface); }
        surface.color.set(material.color); surface.metalness = material.metalness; surface.roughness = Math.max(.04, material.roughness);
        const transparent = material.opacity < 1; if (surface.transparent !== transparent) { surface.transparent = transparent; surface.needsUpdate = true; }
        surface.envMapIntensity = .12; surface.opacity = material.opacity; surface.wireframe = state.wireframe;
      }
      for (const object of state.objects) {
        const group = roots.get(object.id)!; group.visible = object.visible;
        if (!(gizmo.dragging && gizmo.object === group)) {
          group.position.fromArray(object.transform.position.map(value => value / 100));
          group.rotation.set(...object.transform.rotation.map(THREE.MathUtils.degToRad) as Vector3); group.rotation.y += state.time / 10 * Math.PI * 2;
          group.scale.fromArray(object.transform.scale);
        }
        group.traverse(child => { if (child instanceof THREE.Mesh && child.material !== surfaces.get(object.material)) { const old = child.material; child.material = surfaces.get(object.material)!; if (!Array.isArray(old) && ![...surfaces.values()].includes(old as THREE.MeshPhysicalMaterial)) old.dispose(); } });
      }
      const selected = roots.get(state.selected);
      if (["translate", "rotate", "scale"].includes(state.tool) && selected?.visible) { if (gizmo.object !== selected) gizmo.attach(selected); gizmo.setMode(state.tool as "translate" | "rotate" | "scale"); } else gizmo.detach();
      orbit.enableRotate = state.tool === "orbit" || state.tool === "select"; orbit.enablePan = state.tool === "orbit";
      key.visible = state.lights.key; rim.visible = state.lights.rim; grid.visible = state.grid; renderer.toneMappingExposure = state.exposure;
      orbit.update(); renderer.render(scene, camera); frame = requestAnimationFrame(draw);
    };
    draw();
    return () => { disposed = true; controller.abort(); cancelAnimationFrame(frame); observer.disconnect(); orbit.dispose(); gizmo.dispose(); scene.remove(gizmo.getHelper()); disposeObject(scene); grid.geometry.dispose(); for (const material of Array.isArray(grid.material) ? grid.material : [grid.material]) material.dispose(); for (const material of surfaces.values()) material.dispose(); environment.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  }, []);
  return <div className="ms-viewport-canvas" data-loaded={!status}><div className="ms-canvas-mount" ref={host}/>{status && <p className="ms-viewport-loading" role="status">{status}</p>}</div>;
}

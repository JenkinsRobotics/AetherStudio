import { modelStudioEnvironment as look } from "../../src/model-studio-presets";
import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildPart, disposePart } from "./robot";
import type { ModelPart, Transform, Vector } from "./state";
import type { SectionSettings } from "./ModelViewTools";
import { bindViewportPointerActions } from "./viewport-pointer-actions";

export type Tool = "select" | "translate" | "rotate" | "scale";
export type CameraView = "perspective" | "front" | "right" | "top";
export interface ViewSettings { grid: boolean; wireframe: boolean; edges: boolean; }
export interface RenderSettings { exposure: number; groundShadows: boolean; }
export interface Plane { kind: string; revision: number; }
interface Props {
  snapshotRef?: RefObject<(() => string | undefined) | null>;
  render?: RenderSettings;
  parts: ModelPart[]; selected: string; tool: Tool; settings: ViewSettings; resetView: number; view: CameraView; plane: Plane;
  section: SectionSettings; measuring: boolean; measurePoints: Vector[]; onMeasure: (point: Vector) => void;
  onSelect: (id: string) => void; onTransform: (id: string, value: Transform) => void;
  onContextMenu: (x: number, y: number) => void;
}
export function PlasticityViewport(props: Props) {
  const host = useRef<HTMLDivElement>(null), current = useRef(props); current.current = props;
  const [error, setError] = useState("");
  useEffect(() => {
    const element = host.current; if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
    catch { setError("WebGL is unavailable. Enable graphics acceleration to view the 3D scene."); return; }
    renderer.localClippingEnabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(look.background); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = look.exposure;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
    const canvas = renderer.domElement; canvas.tabIndex = 0; canvas.setAttribute("aria-label", "Interactive robot model. Drag to orbit; scroll to zoom.");
    element.append(canvas);
    const scene = new THREE.Scene(); scene.fog = new THREE.Fog(look.background, look.fog.nearMeters, look.fog.farMeters);
    let needsDraw = true;
    const camera = new THREE.PerspectiveCamera(look.camera.fieldOfViewDegrees, 1, .05, 100);
    const orbit = new OrbitControls(camera, canvas); orbit.enableDamping = true; orbit.minDistance = 2; orbit.maxDistance = 24; orbit.maxPolarAngle = Math.PI * .49;
    orbit.addEventListener("change", () => { needsDraw = true; });
    const fitScale = () => Math.max(1, .95 / (element.clientWidth / Math.max(1, element.clientHeight)));
    const resetCamera = () => {
      const views = { perspective: [5, 3.5, 7.7], front: [0, 2, 9], right: [9, 2, 0], top: [.01, 11, .01] };
      orbit.target.set(0, 1.85, 0);
      camera.position.fromArray(views[current.current.view]).sub(orbit.target).multiplyScalar(fitScale()).add(orbit.target); orbit.update();
    };
    resetCamera();
    scene.add(new THREE.HemisphereLight(look.ambient.sky, look.ambient.ground, look.ambient.intensity));
    const key = new THREE.DirectionalLight(look.key.color, look.key.intensity); key.position.set(...look.key.direction); key.castShadow = true; key.shadow.mapSize.set(look.shadow.mapSize, look.shadow.mapSize); key.shadow.camera.left = -6; key.shadow.camera.right = 6; key.shadow.camera.top = 6; key.shadow.camera.bottom = -6; key.shadow.bias = look.shadow.bias;
    const rim = new THREE.DirectionalLight(look.rim.color, look.rim.intensity); rim.position.set(...look.rim.direction);
    scene.add(key, rim);
    const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer), environment = pmrem.fromScene(room, look.reflections.blur);
    scene.environment = environment.texture; room.dispose(); pmrem.dispose();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.ShadowMaterial({ opacity: look.shadow.opacity })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.015; floor.receiveShadow = true; scene.add(floor);
    const grid = new THREE.GridHelper(look.grid.extentMeters, look.grid.extentMeters / look.grid.spacingMeters, look.grid.major, look.grid.minor); scene.add(grid);
    const axes = new THREE.Group();
    for (const [points, color] of [[[[-20, .005, 0], [20, .005, 0]], look.grid.x], [[[0, .005, -20], [0, .005, 20]], look.grid.z]] as const) {
      axes.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(point => new THREE.Vector3(...point))), new THREE.LineBasicMaterial({ color })));
    }
    scene.add(axes);
    const construction = new THREE.GridHelper(5, 10, "#7e9bb5", "#4f687c"); construction.visible = false; scene.add(construction);
    const roots = new Map<string, THREE.Group>();
    const clipPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), clipping = [clipPlane];
    const sectionHelper = new THREE.PlaneHelper(clipPlane, 4.5, 0xd7b56c); sectionHelper.visible = false; scene.add(sectionHelper);
    const measurements = new THREE.Group(); scene.add(measurements);
    const pointGeometry = new THREE.SphereGeometry(.025, 16, 12);
    const pointMaterial = new THREE.MeshBasicMaterial({ color: "#aee2ff", depthTest: false });
    const markers = [new THREE.Mesh(pointGeometry, pointMaterial), new THREE.Mesh(pointGeometry, pointMaterial)];
    const measureLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: "#aee2ff", depthTest: false }));
    for (const object of [...markers, measureLine]) { object.renderOrder = 10; measurements.add(object); }
    const frameVisible = () => {
      scene.updateMatrixWorld(true);
      const box = new THREE.Box3(); for (const root of roots.values()) if (root.visible) box.expandByObject(root);
      if (box.isEmpty()) return;
      const sphere = box.getBoundingSphere(new THREE.Sphere()), width = element.clientWidth, height = Math.max(1, element.clientHeight);
      const usableWidth = Math.max(100, width - (width > 1100 ? 520 : width > 820 ? 454 : 32));
      const usableHeight = Math.max(100, height - (width > 820 ? 160 : 220));
      const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const angle = Math.atan(Math.min(tangent * usableHeight / height, tangent * usableWidth / height));
      const distance = Math.max(.5, sphere.radius / Math.sin(angle) * 1.08);
      const direction = camera.position.clone().sub(orbit.target).normalize();
      orbit.target.copy(sphere.center); camera.position.copy(sphere.center).addScaledVector(direction, distance);
      orbit.minDistance = Math.min(2, distance / 3); orbit.maxDistance = Math.max(24, distance * 3);
      camera.far = Math.max(100, distance * 5);
      if (scene.fog instanceof THREE.Fog) { scene.fog.near = Math.max(14, distance + sphere.radius); scene.fog.far = Math.max(32, distance * 3); }
      camera.updateProjectionMatrix(); orbit.update(); needsDraw = true;
    };
    const gizmo = new TransformControls(camera, canvas); gizmo.setSize(.65); scene.add(gizmo.getHelper());
    gizmo.addEventListener("change", () => { needsDraw = true; });
    gizmo.addEventListener("objectChange", () => { renderer.shadowMap.needsUpdate = true; });
    gizmo.addEventListener("dragging-changed", event => { orbit.enabled = !event.value; });
    gizmo.addEventListener("mouseUp", () => {
      const object = gizmo.object; if (!object) return;
      current.current.onTransform(String(object.userData.partID), {
        position: object.position.toArray().map(value => Math.round(value * 1000) / 10) as Vector,
        rotation: [object.rotation.x, object.rotation.y, object.rotation.z].map(value => Math.round(THREE.MathUtils.radToDeg(value) * 10) / 10) as Vector,
        scale: object.scale.toArray().map(value => Math.max(.05, Math.round(value * 100) / 100)) as Vector,
      });
    });
    const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
    const pick = (event: PointerEvent) => {
      if (gizmo.axis) return;
      const rect = canvas.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects([...roots.values()].filter(root => root.visible), true).find(item => item.object instanceof THREE.Mesh && (!current.current.section.enabled || clipPlane.distanceToPoint(item.point) >= -1e-6));
      if (current.current.measuring) { if (hit) current.current.onMeasure(hit.point.toArray().map(value => value * 100) as Vector); return; }
      if (hit) { let object = hit.object; while (object.parent && !object.userData.partID) object = object.parent; current.current.onSelect(String(object.userData.partID)); }
      else current.current.onSelect("");
    };
    const releasePointerActions = bindViewportPointerActions(canvas, { pick, menu: (x, y) => current.current.onContextMenu(x, y) });
    let previousFit = fitScale();
    const resize = () => { const { width, height } = element.getBoundingClientRect(); renderer.setSize(Math.max(1, width), Math.max(1, height), false); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); const fit = fitScale(); camera.position.sub(orbit.target).multiplyScalar(fit / previousFit).add(orbit.target); previousFit = fit; needsDraw = true; };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    let frame = 0, lastReset = props.resetView, lastPlane = -1, lastView = props.view;
    let lastProps: Props | null = null;
    let lastSection: SectionSettings | null = null;
    const draw = () => {
      const value = current.current;
      if (value !== lastProps) {
        needsDraw = true;
        renderer.toneMappingExposure = value.render?.exposure ?? look.exposure;
        floor.visible = value.render?.groundShadows ?? true;
        if (value.parts !== lastProps?.parts) renderer.shadowMap.needsUpdate = true;
        lastProps = value;
      }
      const shouldFit = value.resetView !== lastReset || value.view !== lastView;
      if (value.view !== lastView) resetCamera();
      if (value.section !== lastSection) {
        const { enabled, axis, offset, flipped } = value.section;
        clipPlane.normal.set(axis === "X" ? 1 : 0, axis === "Y" ? 1 : 0, axis === "Z" ? 1 : 0);
        clipPlane.constant = -offset / 100; if (flipped) clipPlane.negate();
        sectionHelper.visible = enabled; lastSection = value.section; renderer.shadowMap.needsUpdate = true;
      }
      for (const [id, root] of roots) if (!value.parts.some(part => part.id === id)) { if (gizmo.object === root) gizmo.detach(); scene.remove(root); disposePart(root); roots.delete(id); }
      for (const part of value.parts) {
        let root = roots.get(part.id);
        if (root && root.userData.meshKey !== part.meshKey) { if(gizmo.object === root)gizmo.detach();scene.remove(root);disposePart(root);roots.delete(part.id);root=undefined; }
        if (!root) {
          root = buildPart(part); roots.set(part.id, root); scene.add(root);
          root.traverse(child => { if (child instanceof THREE.Mesh) { const edge = new THREE.LineSegments(new THREE.EdgesGeometry(child.geometry, 35), new THREE.LineBasicMaterial({ color: "#c7d86c", transparent: true, opacity: .6 })); edge.userData.selectionEdge = true; child.add(edge); } });
        }
        root.visible = part.visible;
        if (!(gizmo.dragging && gizmo.object === root)) {
          root.position.fromArray(part.transform.position.map(item => item / 100));
          root.rotation.set(...part.transform.rotation.map(THREE.MathUtils.degToRad) as Vector);
          root.scale.fromArray(part.transform.scale);
        }
        (root.userData.surface as THREE.MeshStandardMaterial).color.set(part.color);
        root.traverse(child => {
          if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
            const material = child.material as THREE.Material;
            if (!!material.clippingPlanes?.length !== value.section.enabled) { material.clippingPlanes = value.section.enabled ? clipping : null; material.clipShadows = true; material.needsUpdate = true; }
          }
          if (child instanceof THREE.Mesh) (child.material as THREE.MeshStandardMaterial).wireframe = value.settings.wireframe;
          if (child instanceof THREE.LineSegments) { child.visible = value.selected === part.id || value.settings.edges; (child.material as THREE.LineBasicMaterial).color.set(value.selected === part.id ? "#c7d86c" : "#51585a"); }
        });
      }
      if (shouldFit) { frameVisible(); lastReset = value.resetView; lastView = value.view; }
      measurements.visible = value.measuring;
      markers.forEach((marker, index) => { marker.visible = !!value.measurePoints[index]; if (marker.visible) marker.position.fromArray(value.measurePoints[index].map(value => value / 100)); });
      measureLine.visible = value.measurePoints.length === 2;
      if (measureLine.visible) { const positions = measureLine.geometry.getAttribute("position") as THREE.BufferAttribute; markers.forEach((marker, index) => positions.setXYZ(index, marker.position.x, marker.position.y, marker.position.z)); positions.needsUpdate = true; measureLine.geometry.computeBoundingSphere(); }
      canvas.style.cursor = value.measuring ? "crosshair" : "";
      const target = roots.get(value.selected), part = value.parts.find(item => item.id === value.selected);
      if (target?.visible && value.tool !== "select" && !value.measuring) {
        if (gizmo.object !== target) gizmo.attach(target);
        if (gizmo.mode !== value.tool) gizmo.setMode(value.tool);
        const key = value.tool === "translate" ? "position" : value.tool === "rotate" ? "rotation" : "scale";
        gizmo.showX = !part?.locks.includes(`${key}-0`); gizmo.showY = !part?.locks.includes(`${key}-1`); gizmo.showZ = !part?.locks.includes(`${key}-2`);
      } else if (gizmo.object) gizmo.detach();
      grid.visible = value.settings.grid; axes.visible = value.settings.grid;
      if (lastPlane !== value.plane.revision) {
        lastPlane = value.plane.revision; construction.visible = !!value.plane.kind; construction.position.set(0, .01, 0); construction.rotation.set(0, 0, 0);
        if (value.plane.kind === "XY") construction.rotation.x = Math.PI / 2;
        if (value.plane.kind === "YZ") construction.rotation.z = Math.PI / 2;
        if (value.plane.kind === "selection" && target) { construction.position.copy(target.position); construction.quaternion.copy(target.quaternion); }
        if (value.plane.kind === "camera") { construction.position.copy(orbit.target); construction.quaternion.copy(camera.quaternion); construction.rotateX(Math.PI / 2); }
      }
      orbit.update(); if (needsDraw) { renderer.render(scene, camera); needsDraw = false; } frame = requestAnimationFrame(draw);
    };
    draw();
    const snapshotRef = props.snapshotRef;
    if (snapshotRef) snapshotRef.current = () => {
      // Fit a copy of the camera to the visible model. Rendering at the thumbnail's
      // aspect before scaling avoids a narrow workspace cropping away the part.
      try {
        const thumbnailCamera = camera.clone();
        thumbnailCamera.aspect = 4 / 3;
        const bounds = new THREE.Box3();
        for (const root of roots.values()) if (root.visible) bounds.expandByObject(root);
        if (!bounds.isEmpty()) {
          const sphere = bounds.getBoundingSphere(new THREE.Sphere());
          const halfAngle = THREE.MathUtils.degToRad(thumbnailCamera.fov / 2);
          const distance = Math.max(.1, sphere.radius / Math.sin(halfAngle) * 1.15);
          const direction = camera.position.clone().sub(orbit.target).normalize();
          thumbnailCamera.position.copy(sphere.center).addScaledVector(direction, distance);
          thumbnailCamera.lookAt(sphere.center);
          thumbnailCamera.far = Math.max(camera.far, distance * 5);
        }
        thumbnailCamera.updateProjectionMatrix();
        renderer.render(scene, thumbnailCamera);
        const thumbnail = document.createElement("canvas");
        thumbnail.width = 320; thumbnail.height = 240;
        const context = thumbnail.getContext("2d");
        if (!context) return undefined;
        context.drawImage(canvas, 0, 0, thumbnail.width, thumbnail.height);
        return thumbnail.toDataURL("image/jpeg", .8);
      } catch { return undefined; }
      finally { renderer.render(scene, camera); }
    };
    return () => {
      if (snapshotRef) snapshotRef.current = null;
      cancelAnimationFrame(frame); observer.disconnect(); orbit.dispose(); gizmo.dispose();
      releasePointerActions();
      for (const root of roots.values()) disposePart(root);
      for (const object of [grid, construction, floor, ...axes.children] as (THREE.Line | THREE.Mesh)[]) { object.geometry.dispose(); for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose(); }
      pointGeometry.dispose(); pointMaterial.dispose(); measureLine.geometry.dispose(); (measureLine.material as THREE.Material).dispose();
      sectionHelper.dispose(); environment.dispose(); renderer.dispose(); canvas.remove();
    };
  }, []);
  return <div className="ps-viewport" ref={host}>{error && <p className="ps-webgl-error" role="alert">{error}</p>}</div>;
}

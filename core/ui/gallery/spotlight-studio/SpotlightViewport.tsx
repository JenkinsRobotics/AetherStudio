import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { ViewportOrientation } from "../../src";
import { disposeEnclosure, enclosure } from "./geometry";
import type { Lighting, Study } from "./state";

export interface SpotlightViewHandle { fit(): void; direction(value: readonly [number, number, number]): void; nudge(x: number, y: number): void; roll(turns: number): void; capture(): Promise<Blob | null>; }
interface Props { study: Study; lighting: Lighting; grid: boolean; wireframe: boolean; selected: string; turntable: boolean; onSelect: (part: string) => void; onOrientation: (value: ViewportOrientation) => void; }
export const SpotlightViewport = forwardRef<SpotlightViewHandle, Props>(function SpotlightViewport(props, ref) {
  const host = useRef<HTMLDivElement>(null), current = useRef(props); current.current = props;
  const controller = useRef<SpotlightViewHandle | null>(null);
  const [error, setError] = useState("");
  useImperativeHandle(ref, () => ({ fit: () => controller.current?.fit(), direction: value => controller.current?.direction(value), nudge: (x, y) => controller.current?.nudge(x, y), roll: turns => controller.current?.roll(turns), capture: async () => controller.current?.capture() ?? null }), []);
  useEffect(() => {
    const container = host.current; if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false }); }
    catch { setError("Enable WebGL graphics acceleration to use the live studio render."); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.setClearColor("#101418");
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap; renderer.shadowMap.autoUpdate = false;
    const canvas = renderer.domElement; canvas.tabIndex = 0; canvas.setAttribute("aria-label", "Live spotlight render. Drag to orbit and scroll to zoom."); container.append(canvas);
    const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2("#101418", .047);
    const camera = new THREE.PerspectiveCamera(35, 1, .05, 70), orbit = new OrbitControls(camera, canvas);
    orbit.enableDamping = true; orbit.minDistance = 2.4; orbit.maxDistance = 22; orbit.maxPolarAngle = Math.PI * .495;
    let dirty = true, frame = 0, model = enclosure(current.current.study), oldStudy = current.current.study;
    scene.add(model);
    const fitScale = () => Math.max(1, 1.05 / (container.clientWidth / Math.max(1, container.clientHeight)));
    const fit = () => { camera.up.set(0, 1, 0); orbit.target.set(0, .35, 0); camera.position.set(5.2, 5.2, -7).sub(orbit.target).multiplyScalar(fitScale()).add(orbit.target); orbit.update(); dirty = true; };
    fit();
    let previousOrientation = camera.quaternion.clone();
    current.current.onOrientation(camera.quaternion.toArray() as ViewportOrientation);
    orbit.addEventListener("change", () => { dirty = true; if (Math.abs(previousOrientation.dot(camera.quaternion)) < .999999) { previousOrientation.copy(camera.quaternion); current.current.onOrientation(camera.quaternion.toArray() as ViewportOrientation); } });
    const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer), environment = pmrem.fromScene(room, .05);
    scene.environment = environment.texture; room.dispose(); pmrem.dispose(); scene.environmentIntensity = .35;
    const ambient = new THREE.HemisphereLight("#c3d2e5", "#20262c", .18); scene.add(ambient);
    const spotlight = new THREE.SpotLight("#e9efff", 145, 30, Math.PI / 4, .8, 2); spotlight.castShadow = true;
    spotlight.shadow.mapSize.set(2048, 2048); spotlight.shadow.bias = -.00015; spotlight.shadow.normalBias = .015; spotlight.shadow.radius = 5; spotlight.shadow.blurSamples = 12;
    spotlight.target.position.set(0, 0, 0); scene.add(spotlight, spotlight.target);
    const rim = new THREE.DirectionalLight("#a4c7f5", .7); rim.position.set(-3, 2.5, -3); scene.add(rim);
    const gridVisible = { value: 1 };
    const floorMaterial = new THREE.MeshStandardMaterial({ color: "#1a2028", roughness: .8, metalness: .1 });
    // Anti-aliased world-space grid shares the illuminated floor surface, avoiding
    // separate line geometry that can disappear or shimmer at grazing angles.
    floorMaterial.onBeforeCompile = shader => {
      shader.uniforms.ssGridVisible = gridVisible;
      shader.vertexShader = "varying vec3 ssWorld;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nssWorld = (modelMatrix * vec4(position, 1.0)).xyz;");
      shader.fragmentShader = "varying vec3 ssWorld; uniform float ssGridVisible;\n" + shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
        vec2 gridPosition = ssWorld.xz * 3.0;
        vec2 gridDistance = abs(fract(gridPosition - 0.5) - 0.5) / max(fwidth(gridPosition), vec2(0.0001));
        float gridLine = 1.0 - min(min(gridDistance.x, gridDistance.y), 1.0);
        float gridFade = 1.0 - smoothstep(4.0, 18.0, length(ssWorld.xz));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.09, 0.115, 0.14), gridLine * gridFade * ssGridVisible * 0.12);
      `);
    };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), floorMaterial); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const axes = new THREE.Group();
    for (const [points, color] of [[[[-40, .005, 0], [40, .005, 0]], "#78534c"], [[[0, .005, -40], [0, .005, 40]], "#425d50"]] as const) axes.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(point => new THREE.Vector3(...point))), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .35 })));
    scene.add(axes);
    let previousFit = fitScale();
    const resize = () => { const box = container.getBoundingClientRect(); renderer.setSize(Math.max(1, box.width), Math.max(1, box.height), false); camera.aspect = box.width / Math.max(1, box.height); camera.updateProjectionMatrix(); const scale = fitScale(); camera.position.sub(orbit.target).multiplyScalar(scale / previousFit).add(orbit.target); previousFit = scale; dirty = true; };
    const observer = new ResizeObserver(resize); observer.observe(container); resize();
    controller.current = {
      fit,
      direction: value => { camera.up.set(0, 1, 0); const normal = new THREE.Vector3(...value).normalize(); if (Math.abs(normal.y) > .99) { normal.z = .001; if (normal.y < 0) orbit.maxPolarAngle = Math.PI - .001; } else orbit.maxPolarAngle = Math.PI * .995; camera.position.copy(orbit.target).addScaledVector(normal, camera.position.distanceTo(orbit.target)); orbit.update(); dirty = true; },
      nudge: (x, y) => { const vector = new THREE.Spherical().setFromVector3(camera.position.clone().sub(orbit.target)); vector.theta += x * Math.PI / 12; vector.phi = Math.max(.01, Math.min(Math.PI - .01, vector.phi + y * Math.PI / 12)); camera.position.copy(orbit.target).add(new THREE.Vector3().setFromSpherical(vector)); orbit.update(); dirty = true; },
      roll: turns => { camera.up.applyAxisAngle(camera.position.clone().sub(orbit.target).normalize(), turns * Math.PI / 2); orbit.update(); dirty = true; },
      capture: () => new Promise(resolve => { renderer.render(scene, camera); canvas.toBlob(resolve, "image/png"); }),
    };
    const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(); let down: [number, number] | null = null;
    const pointerDown = (event: PointerEvent) => { down = [event.clientX, event.clientY]; };
    const pick = (event: PointerEvent) => { if (event.button !== 0 || !down || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 4) return; const rect = canvas.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(pointer, camera); const hit = ray.intersectObjects(model.children.filter(part => part.visible), true)[0]; if (hit) current.current.onSelect(String(hit.object.userData.part)); };
    canvas.addEventListener("pointerdown", pointerDown); canvas.addEventListener("pointerup", pick);
    let previous: Props | null = null, lastTime = performance.now();
    function draw(now: number) {
      const value = current.current, delta = Math.min(.05, (now - lastTime) / 1000); lastTime = now;
      if (value.study !== oldStudy) { scene.remove(model); disposeEnclosure(model); model = enclosure(value.study); oldStudy = value.study; scene.add(model); renderer.shadowMap.needsUpdate = true; }
      if (value !== previous) {
        const light = value.lighting, angle = THREE.MathUtils.degToRad(light.azimuth), elevation = THREE.MathUtils.degToRad(light.elevation);
        spotlight.position.set(Math.cos(angle) * Math.cos(elevation) * 7, Math.sin(elevation) * 7, Math.sin(angle) * Math.cos(elevation) * 7);
        spotlight.intensity = light.power; spotlight.angle = THREE.MathUtils.degToRad(light.spread); spotlight.penumbra = light.softness; spotlight.shadow.radius = 1 + light.softness * 5;
        scene.environmentIntensity = light.fill; renderer.toneMappingExposure = light.exposure;
        gridVisible.value = value.grid ? 1 : 0; axes.visible = value.grid;
        if (previous?.lighting !== value.lighting) renderer.shadowMap.needsUpdate = true;
        for (const child of model.children) if (child instanceof THREE.Mesh) { const material = child.material as THREE.MeshPhysicalMaterial; material.wireframe = value.wireframe; material.emissive.set(child.userData.part === value.selected ? "#142538" : "#000000"); material.emissiveIntensity = .2; }
        previous = value; dirty = true;
      }
      orbit.autoRotate = value.turntable; orbit.autoRotateSpeed = .9; orbit.update(delta);
      if (dirty || value.turntable) { renderer.render(scene, camera); dirty = false; }
      frame = requestAnimationFrame(draw);
    }
    renderer.shadowMap.needsUpdate = true; frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); orbit.dispose(); controller.current = null; canvas.removeEventListener("pointerdown", pointerDown); canvas.removeEventListener("pointerup", pick); disposeEnclosure(model); floor.geometry.dispose(); (floor.material as THREE.Material).dispose(); axes.traverse(object => { if (object instanceof THREE.Line) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); } }); spotlight.shadow.dispose(); environment.dispose(); renderer.dispose(); canvas.remove(); };
  }, []);
  return <div ref={host} className="ss-viewport">{error && <p role="alert" className="ss-render-error">{error}</p>}</div>;
});

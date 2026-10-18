import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ViewportCanvas, ViewportNavigationCube, type ViewportOrientation } from "../src/index";

/** Sample geometry only: this gallery does not call a product's modeling engine. */
export function RibbonWorkspaceDemoViewport({ depth, fitRequest }: { depth: number; fitRequest: number }) {
  const live = useRef<{ setDepth: (value: number) => void; view: (direction: readonly number[]) => void;
    fit: () => void; nudge: (horizontal: number, vertical: number) => void; roll: (turns: number) => void } | null>(null);
  const [orientation, setOrientation] = useState<ViewportOrientation>([0, 0, 0, 1]);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => { live.current?.setDepth(depth); }, [depth]);
  useEffect(() => { live.current?.fit(); }, [fitRequest]);
  return <>
    <ViewportCanvas onMount={(canvas) => {
      let renderer: THREE.WebGLRenderer;
      try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
      catch { setUnavailable(true); return () => {}; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 2000);
      const controls = new OrbitControls(camera, canvas);
      controls.target.set(0, 8, 0);
      camera.position.set(150, 150, 180);
      const shape = new THREE.Shape();
      shape.moveTo(-45, -30); shape.lineTo(45, -30); shape.lineTo(45, 30);
      shape.lineTo(-45, 30); shape.closePath();
      for (const x of [-27, 27]) {
        const hole = new THREE.Path(); hole.absarc(x, 0, 9, 0, Math.PI * 2, true); shape.holes.push(hole);
      }
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: 18, bevelEnabled: false, curveSegments: 48 });
      const material = new THREE.MeshStandardMaterial({ color: 0x96b9d6, metalness: 0.15, roughness: 0.55 });
      const part = new THREE.Mesh(geometry, material);
      part.rotation.x = -Math.PI / 2;
      part.position.y = 0.1;
      part.scale.z = depth / 18;
      const edgesGeometry = new THREE.EdgesGeometry(geometry, 30);
      const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x3d6079 });
      part.add(new THREE.LineSegments(edgesGeometry, edgesMaterial));
      scene.add(part, new THREE.HemisphereLight(0xffffff, 0x687785, 2.5));
      const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(60, 140, 100); scene.add(light);
      const grid = new THREE.GridHelper(240, 24); scene.add(grid);
      const render = () => {
        const css = getComputedStyle(canvas);
        scene.background = new THREE.Color(css.getPropertyValue("--aether-color-bg-app").trim() || "#ececee");
        const gridMaterial = grid.material as THREE.LineBasicMaterial;
        gridMaterial.color.set(css.getPropertyValue("--aether-color-border").trim() || "#d6d8db");
        renderer.render(scene, camera);
        setOrientation(camera.quaternion.toArray() as [number, number, number, number]);
      };
      const resize = () => {
        const { width, height } = canvas.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height, false); camera.aspect = width / height;
        camera.updateProjectionMatrix(); render();
      };
      controls.addEventListener("change", render);
      controls.update();
      live.current = {
        setDepth: (value) => { part.scale.z = value / 18; render(); },
        view: (direction) => {
          const offset = new THREE.Vector3(...direction).normalize().multiplyScalar(270);
          camera.up.set(0, 1, 0);
          if (Math.abs(offset.y) > 269) camera.up.set(0, 0, -Math.sign(offset.y));
          camera.position.copy(controls.target).add(offset); controls.update(); render();
        },
        fit: () => { camera.up.set(0, 1, 0); controls.target.set(0, 8, 0); camera.position.set(150, 150, 180); controls.update(); render(); },
        nudge: (horizontal, vertical) => {
          const offset = camera.position.clone().sub(controls.target);
          const spherical = new THREE.Spherical().setFromVector3(offset);
          spherical.theta += horizontal * Math.PI / 12;
          spherical.phi += vertical * Math.PI / 12; spherical.makeSafe();
          camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical)); controls.update(); render();
        },
        roll: (turns) => {
          camera.up.applyAxisAngle(camera.getWorldDirection(new THREE.Vector3()), turns * Math.PI / 2);
          controls.update(); render();
        },
      };
      const observer = new ResizeObserver(resize); observer.observe(canvas);
      const theme = new MutationObserver(render); theme.observe(document.documentElement, { attributes: true });
      theme.observe(document.body, { attributes: true });
      resize();
      return () => {
        live.current = null; observer.disconnect(); theme.disconnect(); controls.dispose();
        geometry.dispose(); material.dispose(); edgesGeometry.dispose(); edgesMaterial.dispose();
        grid.geometry.dispose(); (grid.material as THREE.Material).dispose(); renderer.dispose();
      };
    }} />
    {unavailable ? <p className="ribbon-demo-renderer-message">WebGL is unavailable. The workspace controls remain available.</p> :
      <ViewportNavigationCube orientation={orientation} onSelectView={(view) => {
        const directions = { front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0], top: [0, 1, 0], bottom: [0, -1, 0] };
        live.current?.view(directions[view]);
      }} onSelectDirection={(direction) => live.current?.view(direction)}
        onFit={() => live.current?.fit()} onNudge={(x, y) => live.current?.nudge(x, y)} onRoll={(turns) => live.current?.roll(turns)} />}
  </>;
}

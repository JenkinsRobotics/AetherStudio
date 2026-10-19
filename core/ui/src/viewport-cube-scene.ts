import * as THREE from "three";
import { viewportCubeRegionsForUpAxis, viewportCubeColorTokens, viewportCubeProjection, type ViewportUpAxis } from "./viewport-cube-geometry";

export type CubeScenePalette = Record<keyof typeof viewportCubeColorTokens | "x" | "y" | "z", string>;

function textTexture(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = color;
  context.font = "500 76px sans-serif";
  context.textAlign = "center"; context.textBaseline = "middle";
  context.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A genuine depth-buffered scene. The orthographic lens matches the shared
 * face projection, so DOM keyboard/pointer targets align with mesh facets. */
export class ViewportCubeScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-viewportCubeProjection.center/viewportCubeProjection.scale, viewportCubeProjection.center/viewportCubeProjection.scale, viewportCubeProjection.center/viewportCubeProjection.scale, -viewportCubeProjection.center/viewportCubeProjection.scale, 0.1, 20);
  readonly faces = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>();
  private idleColors = new Map<string, THREE.Color>();

  constructor(upAxis: ViewportUpAxis, private palette: CubeScenePalette) {
    for (const region of viewportCubeRegionsForUpAxis(upAxis)) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(region.vertices.flat(), 3));
      geometry.setIndex(Array.from({length:region.vertices.length-2},(_,i)=>[0,i+1,i+2]).flat());
      const material = new THREE.MeshBasicMaterial({color:palette[region.kind], side:THREE.FrontSide});
      const face = new THREE.Mesh(geometry,material);
      face.name = region.id;
      face.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color:palette.outline})));
      this.faces.set(region.id,face); this.idleColors.set(region.id,material.color.clone());
      this.scene.add(face);
      if (region.view && region.right && region.up) {
        const texture = textTexture(region.label.toUpperCase(),palette.label);
        if (texture) {
          const label = new THREE.Mesh(new THREE.PlaneGeometry(2.6,0.65),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,depthTest:true}));
          const normal = new THREE.Vector3(...region.normal);
          label.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...region.right),new THREE.Vector3(...region.up),normal));
          label.position.copy(normal).multiplyScalar(1.002);
          label.name = `${region.id}-label`;
          this.scene.add(label);
        }
      }
    }
    // The shared SVG layer projects corner axes into this same camera frame.
    // It supplies crisp strokes plus faint occluded segments in both renderers.
    this.setOrientation([0,0,0,1]);
  }

  setOrientation(orientation: readonly [number,number,number,number]) {
    this.camera.quaternion.fromArray(orientation).normalize();
    this.camera.position.set(0,0,7).applyQuaternion(this.camera.quaternion);
    this.camera.updateMatrixWorld(true);
  }
  setHighlight(id: string | null) {
    this.faces.forEach((face,key)=>face.material.color.copy(key===id ? new THREE.Color(this.palette.hover) : this.idleColors.get(key)!));
  }
  dispose() {
    this.scene.traverse(node=>{
      if (node instanceof THREE.Mesh || node instanceof THREE.Line || node instanceof THREE.Sprite) {
        // Sprites share Three's internal geometry; only own mesh/line buffers.
        if (!(node instanceof THREE.Sprite)) node.geometry.dispose();
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          (material as THREE.MeshBasicMaterial).map?.dispose(); material.dispose();
        }
      }
    });
    this.scene.clear();
  }
}

export function readCubeScenePalette(host: HTMLElement): CubeScenePalette {
  const style=getComputedStyle(host);
  return Object.fromEntries(Object.entries({...viewportCubeColorTokens,x:"--aether-color-error",y:"--aether-color-ok",z:"--aether-color-accent-icon"})
    .map(([key,token])=>[key,style.getPropertyValue(token).trim()])) as CubeScenePalette;
}
export function createCubeRenderer(size = 138) {
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2));
  renderer.setSize(size,size,false); renderer.setClearColor(0,0);
  return renderer;
}

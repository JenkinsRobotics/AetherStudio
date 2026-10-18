import { afterEach, expect, test, vi } from "vitest";
import * as THREE from "three";
import { ViewportCubeScene, type CubeScenePalette } from "./viewport-cube-scene";

const palette: CubeScenePalette = {face:"gray",edge:"silver",corner:"gray",outline:"black",label:"black",hover:"orange",x:"red",y:"green",z:"blue"};
function scene() {
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockImplementation((() => ({fillText:()=>{}})) as unknown as HTMLCanvasElement["getContext"]);
  return new ViewportCubeScene("z",palette);
}
afterEach(()=>vi.restoreAllMocks());
test("cube faces really lie in front of the rear Y axis and participate in depth testing",()=>{
  const cube=scene();
  const camera=new THREE.OrthographicCamera(-3,3,3,-3,0.1,20);
  camera.position.set(1,-1,0.72).normalize().multiplyScalar(7);camera.up.set(0,0,1);camera.lookAt(0,0,0);
  cube.setOrientation(camera.quaternion.toArray()); cube.scene.updateMatrixWorld(true);
  const endpoint=cube.scene.getObjectByName("axis-y-label")!;
  const p=endpoint.position.clone().project(cube.camera);
  const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(p.x,p.y),cube.camera);
  const hit=ray.intersectObjects([...cube.faces.values()],false)[0];
  expect(hit).toBeDefined();
  expect(hit.distance).toBeLessThan(endpoint.position.clone().sub(ray.ray.origin).dot(ray.ray.direction));
  expect((endpoint as THREE.Sprite).material.depthTest).toBe(true);
  for(const face of cube.faces.values()) {expect(face.material.depthWrite).toBe(true);expect(face.material.transparent).toBe(false);}
  cube.dispose();
});
test("scene retains all 26 navigable facets, physical face labels and targeted hover",()=>{
  const cube=scene();
  expect(cube.faces.size).toBe(26);
  expect(cube.scene.getObjectByName("front-label")).toBeInstanceOf(THREE.Mesh);
  cube.setHighlight("front");
  expect(cube.faces.get("front")!.material.color.getHexString()).toBe(new THREE.Color("orange").getHexString());
  expect(cube.faces.get("top")!.material.color.getHexString()).toBe(new THREE.Color("gray").getHexString());
  cube.setHighlight(null);
  expect(cube.faces.get("front")!.material.color.getHexString()).toBe(new THREE.Color("gray").getHexString());
  cube.dispose();expect(cube.scene.children).toHaveLength(0);
});

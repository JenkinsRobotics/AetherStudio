/** One renderer-independent beveled cube for corner and world-space navigation.
 * This is UI artwork/hit geometry, never a product modeling kernel. */
export type CubeVector = readonly [number, number, number];
export type ViewportUpAxis = "y" | "z";
/** One camera frame for the mesh, face targets and corner-anchored XYZ axes.
 * Extra lens margin keeps endpoint lettering in bounds throughout a full orbit. */
export const viewportCubeProjection = { center:54, scale:21, size:108 } as const;
export const viewportCubeAxisOrigin: CubeVector = [-1.15,-1.15,-1.15];
export const viewportCubeAxes = (["x","y","z"] as const).map((id,index) => ({
  id, end: viewportCubeAxisOrigin.map((value,i) => i === index ? 1.25 : value) as unknown as CubeVector,
}));
/** Proper rotation about X: preserve X and handedness when choosing Z-up. */
export function viewportVectorForUpAxis([x, y, z]: CubeVector, upAxis: ViewportUpAxis): CubeVector {
  return upAxis === "z" ? [x, -z || 0, y] : [x, y, z];
}
export type CubeFaceView = "front" | "back" | "right" | "left" | "top" | "bottom";
export interface ViewportCubeRegion {
  id: string;
  label: string;
  kind: "face" | "edge" | "corner";
  view?: CubeFaceView;
  normal: CubeVector;
  vertices: readonly CubeVector[];
  right?: CubeVector;
  up?: CubeVector;
}
const b = .8, c = .65;
const axes = [0, 1, 2] as const;
const signs = [-1, 1] as const;
const cross = (a: CubeVector, b: CubeVector): CubeVector => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a: CubeVector, b: CubeVector) => a.reduce((sum, n, i) => sum + n*b[i], 0);
const named = (axis: number, sign: number): CubeFaceView => ([['left','right'],['bottom','top'],['back','front']] as const)[axis][sign > 0 ? 1 : 0];
const title = (s: string) => s[0].toUpperCase() + s.slice(1);
function region(normal: CubeVector, vertices: CubeVector[], kind: ViewportCubeRegion['kind'], view?: CubeFaceView): ViewportCubeRegion {
  const length = Math.hypot(...normal);
  const n = normal.map(v => v/length) as unknown as CubeVector;
  const up: CubeVector = Math.abs(n[1]) > .99 ? [0, 0, -Math.sign(n[1])] : [0, 1, 0];
  const right = cross(up, n);
  const vertical = cross(n, right);
  const center = vertices[0].map((_, i) => vertices.reduce((sum, v) => sum + v[i], 0)/vertices.length) as unknown as CubeVector;
  vertices.sort((a,b) => {
    const relative = (v: CubeVector) => v.map((x,i) => x-center[i]) as unknown as CubeVector;
    const angle = (v: CubeVector) => Math.atan2(dot(relative(v),vertical),dot(relative(v),right));
    return angle(a)-angle(b);
  });
  const label = axes.filter(i => normal[i]).map(i => title(named(i,normal[i]))).join(' ');
  return { id: view ?? label.toLowerCase().replaceAll(' ','-'), label, kind, view, normal:n, vertices, ...(view ? { right, up:vertical } : {}) };
}
const regions: ViewportCubeRegion[] = [];
for (const axis of axes) for (const sign of signs) {
  const [u,v] = axes.filter(i=>i!==axis);
  const normal = [0,0,0]; normal[axis]=sign;
  const vertices = [[b,c],[c,b],[-c,b],[-b,c],[-b,-c],[-c,-b],[c,-b],[b,-c]].map(([x,y])=>{
    const p=[0,0,0];p[axis]=sign;p[u]=x;p[v]=y;return p as unknown as CubeVector;
  });
  regions.push(region(normal as unknown as CubeVector, vertices, 'face', named(axis,sign)));
}
for (const along of axes) {
  const [u,v] = axes.filter(i=>i!==along);
  for (const su of signs) for (const sv of signs) {
    const normal=[0,0,0];normal[u]=su;normal[v]=sv;
    const vertices: CubeVector[]=[];
    for (const s of signs) for (const swap of [false,true]) {
      const p=[0,0,0];p[along]=c*s;p[u]=(swap?b:1)*su;p[v]=(swap?1:b)*sv;
      vertices.push(p as unknown as CubeVector);
    }
    regions.push(region(normal as unknown as CubeVector,vertices,'edge'));
  }
}
for (const x of signs) for (const y of signs) for (const z of signs) {
  const vertices = [[1,b,c],[1,c,b],[b,1,c],[c,1,b],[b,c,1],[c,b,1]].map(p=>[p[0]*x,p[1]*y,p[2]*z] as CubeVector);
  regions.push(region([x,y,z],vertices,'corner'));
}
export const viewportCubeRegions: readonly ViewportCubeRegion[] = regions;
const zUpRegions = regions.map(region => ({
  ...region,
  normal: viewportVectorForUpAxis(region.normal, "z"),
  vertices: region.vertices.map(vertex => viewportVectorForUpAxis(vertex, "z")),
  ...(region.right ? { right: viewportVectorForUpAxis(region.right, "z") } : {}),
  ...(region.up ? { up: viewportVectorForUpAxis(region.up, "z") } : {}),
}));
export function viewportCubeRegionsForUpAxis(upAxis: ViewportUpAxis): readonly ViewportCubeRegion[] {
  return upAxis === "z" ? zUpRegions : viewportCubeRegions;
}

/** Both renderers obtain their neutral colors from the same suite tokens. */
export const viewportCubeColorTokens = {
  face: '--aether-color-bg-control-hover', edge: '--aether-color-bg-hover', corner: '--aether-color-border-control',
  outline: '--aether-color-text-dim', label: '--aether-color-text', hover: '--aether-color-accent',
} as const;

import { expect, test } from "vitest";
import { viewportCubeRegions } from "./viewport-cube-geometry";
test("the shared cube has 26 closed outward-facing regions with every seam joined twice",()=>{
  const edges=new Map<string,number>();
  expect(viewportCubeRegions.filter(r=>r.kind==='face')).toHaveLength(6);
  expect(viewportCubeRegions.filter(r=>r.kind==='edge')).toHaveLength(12);
  expect(viewportCubeRegions.filter(r=>r.kind==='corner')).toHaveLength(8);
  for(const region of viewportCubeRegions) {
    expect(Math.hypot(...region.normal)).toBeCloseTo(1);
    const [a,b,c]=region.vertices;
    const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]);
    const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    expect(cross.reduce((s,x,i)=>s+x*region.normal[i],0)).toBeGreaterThan(0);
    region.vertices.forEach((a,i)=>{
      const b=region.vertices[(i+1)%region.vertices.length];
      const key=[a.join(','),b.join(',')].sort().join('|');edges.set(key,(edges.get(key)??0)+1);
    });
  }
  expect(edges.size).toBe(72);
  expect([...edges.values()].every(n=>n===2)).toBe(true);
});

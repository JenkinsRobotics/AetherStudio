import { expect, it } from 'vitest';
import { booleanPaths, regionPolygons } from './regions';
import { compoundPath, pathContours } from './compound';
import { pathBounds } from './bounds';
import { transformPath } from './edit';
import { parseSVGPath } from './svg-import';
import type { SketchPath } from './types';
const rect=(x:number,y:number,w:number,h:number):SketchPath=>({points:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],closed:true});
const area=(p:SketchPath)=>regionPolygons(p,.01).reduce((sum,poly)=>sum+poly.reduce((a,r)=>a+r.slice(0,-1).reduce((v,p,i)=>v+(p[0]*r[i+1][1]-r[i+1][0]*p[1])/2,0),0),0);
it('unions, subtracts, intersects and excludes overlapping drawings',()=>{
 const a=rect(0,0,10,10),b=rect(5,0,10,10);
 for(const [op,expected] of [['union',150],['difference',50],['intersection',50],['xor',100]] as const) expect(area(booleanPaths([a,b],op,.01)!)).toBeCloseTo(expected);
 expect(booleanPaths([a,a],'difference',.01)).toBeNull();
 expect(booleanPaths([a,rect(30,30,2,2)],'intersection',.01)).toBeNull();
});
it('preserves nested holes/islands, disjoint contours, and nonzero winding overlaps',()=>{
 const a=rect(0,0,20,20),b=rect(5,5,10,10),c=rect(7,7,6,6);
 const compound=compoundPath([a,b,c]); expect(area(compound)).toBeCloseTo(336);
 expect(area(compoundPath([a,b],'nonzero'))).toBeCloseTo(400);
 expect(area(compoundPath([a,{...b,points:[...b.points].reverse()}],'nonzero'))).toBeCloseTo(300);
 expect(area(compoundPath([rect(0,0,10,10),rect(5,0,10,10)],'nonzero'))).toBeCloseTo(150);
 const moved=transformPath(compound,p=>[p[0]+100,p[1]-50]); expect(pathBounds([moved])).toEqual({x:100,y:-50,width:20,height:20});
 expect(pathContours(moved)[1].points[0]).toEqual([105,-45]);
});
it('keeps touching/coincident edges stable and rejects invalid region inputs',()=>{
 expect(area(booleanPaths([rect(0,0,10,10),rect(10,0,10,10)],'union',.01)!)).toBeCloseTo(200);
 expect(()=>regionPolygons({...rect(0,0,10,10),closed:false},.1)).toThrow();
 expect(()=>regionPolygons(rect(0,0,0,0),.1)).toThrow(); expect(()=>regionPolygons(rect(0,0,10,10),0)).toThrow();
});
it('imports relative curves, quadratic/smooth commands, arcs, transforms and compound SVG paths',()=>{
 const paths=parseSVGPath('m0 0h20v20h-20z M5 5 q10 0 10 10 t-10 0z','translate(100 10) scale(2)');
 expect(paths).toHaveLength(2); expect(paths[0].points[1]).toEqual([140,10]); expect(paths[1].curves?.filter(Boolean)).toHaveLength(2);
 const circle=parseSVGPath('M0 10 A10 10 0 1 1 20 10 A10 10 0 1 1 0 10 Z')[0];
 expect(circle.points).toHaveLength(4); expect(circle.curves?.every(Boolean)).toBe(true); expect(pathBounds([circle])?.width).toBeCloseTo(20);
 expect(()=>parseSVGPath('M bad data')).toThrow();
});

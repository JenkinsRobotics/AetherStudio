import {expect,it} from 'vitest';
import {readSVGGeometry,svgElementPaths} from './svg-elements';
it('normalizes rounded shapes and inherited transformed compound paths without DOM',()=>{
 expect(svgElementPaths('circle',{cx:'0',cy:'0',r:'10'})[0].curves?.some(Boolean)).toBe(true);
 const result=readSVGGeometry({tag:'svg',attributes:{},children:[{tag:'g',attributes:{transform:'translate(20 30)','fill-rule':'evenodd'},children:[{tag:'path',attributes:{id:'ring',d:'M0 0h10v10h-10z M2 2h6v6h-6z'}},{tag:'script',attributes:{}}]}]});
 expect(result.items[0].paths).toHaveLength(2);expect(result.items[0].paths[1].points[0]).toEqual([22,32]);expect(result.items[0].fillRule).toBe('evenodd');expect(result.warnings.join()).toContain('script');
});
it('refuses geometry whose SVG effects would otherwise be silently lost',()=>{const result=readSVGGeometry({tag:'svg',attributes:{},children:[{tag:'rect',attributes:{width:'10',height:'10','clip-path':'url(#x)'}}]});expect(result.items).toEqual([]);expect(result.warnings[0]).toContain('expanded');});

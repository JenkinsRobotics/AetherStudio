import { parseSVGPath } from './svg-import';
import type { SketchPath } from './types';
/** Product adapters supply inert attributes, never DOM objects or mounted SVG. */
export interface SVGVectorElement { tag: string; attributes: Record<string,string>; children?: SVGVectorElement[] }
export function svgElementPaths(tag: string, a: Record<string,string>, transform = ''): SketchPath[] {
  const n=(key:string,fallback=0)=>a[key]===undefined?fallback:parseFloat(a[key]);
  const x=n('x'),y=n('y'),w=n('width'),h=n('height'); let d='';
  switch(tag) {
    case 'path': d=a.d??'';break;
    case 'line':d=`M${n('x1')} ${n('y1')}L${n('x2')} ${n('y2')}`;break;
    case 'polygon':case 'polyline': {
      const points=(a.points?.match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi)??[]).map(Number);
      if(points.length<4||points.length%2)throw Error('Invalid polygon points.');
      d=`M${points.slice(0,2).join(' ')}L${points.slice(2).join(' ')}${tag==='polygon'?'Z':''}`;break;
    }
    case 'rect': {
      if(w<=0||h<=0)throw Error('Rectangle needs positive dimensions.');
      const rx=Math.min(w/2,n('rx',n('ry'))),ry=Math.min(h/2,n('ry',rx));
      d=rx>0&&ry>0?`M${x+rx} ${y}H${x+w-rx}A${rx} ${ry} 0 0 1 ${x+w} ${y+ry}V${y+h-ry}A${rx} ${ry} 0 0 1 ${x+w-rx} ${y+h}H${x+rx}A${rx} ${ry} 0 0 1 ${x} ${y+h-ry}V${y+ry}A${rx} ${ry} 0 0 1 ${x+rx} ${y}Z`:`M${x} ${y}h${w}v${h}h${-w}Z`;break;
    }
    case 'ellipse':case 'circle': {
      const cx=n('cx'),cy=n('cy'),rx=n('rx',n('r')),ry=n('ry',n('r'));
      if(rx<=0||ry<=0)throw Error('Ellipse needs positive radii.');
      d=`M${cx-rx} ${cy}A${rx} ${ry} 0 1 0 ${cx+rx} ${cy}A${rx} ${ry} 0 1 0 ${cx-rx} ${cy}Z`;break;
    }
  }
  return d?parseSVGPath(d,transform):[];
}
/** Geometry-only interchange. Visual content remains the destination product's job. */
export function readSVGGeometry(root: SVGVectorElement, transform='') {
  const items:{name:string;paths:SketchPath[];fillRule:'evenodd'|'nonzero'}[]=[],warnings:string[]=[];let count=0,anchors=0;
  const visit=(e:SVGVectorElement,parentTransform:string,rule:'evenodd'|'nonzero',depth:number)=>{
    if(++count>12000||depth>100)throw Error('SVG complexity limit exceeded.');
    const a=e.attributes,style=Object.fromEntries((a.style??'').split(';').filter(Boolean).map(s=>s.split(':').map(v=>v.trim())));
    if(a.display==='none'||style.display==='none'||a.visibility==='hidden'||style.visibility==='hidden')return;
    const combined=`${parentTransform} ${a.transform??''}`,fillRule=(style['fill-rule']??a['fill-rule']??rule)==='evenodd'?'evenodd':'nonzero';
    if(a['clip-path']||a.mask||a.filter||style['clip-path']||style.mask||style.filter){warnings.push(`${a.id??e.tag}: clipping/mask/filter must be expanded before geometry import.`);return;}
    if(e.tag==='g'||e.tag==='svg') {
      if(depth>0&&e.tag==='svg'){warnings.push('Nested SVG viewports were skipped.');return;}
      for(const child of e.children??[])visit(child,combined,fillRule,depth+1);return;
    }
    if(['defs','title','desc','metadata'].includes(e.tag))return;
    if(!['path','line','rect','circle','ellipse','polygon','polyline'].includes(e.tag)){warnings.push(`Skipped unsupported ${e.tag}; import outlined vector geometry instead.`);return;}
    try {
      const paths=svgElementPaths(e.tag,a,combined);anchors+=paths.reduce((n,p)=>n+p.points.length,0);
      if(anchors>12000)throw Error('SVG exceeds 12000 vector anchors.');
      if(paths.length)items.push({name:a['data-name']??a.id??`Imported ${items.length+1}`,paths,fillRule});
    }catch(error){warnings.push(`${a.id??e.tag}: ${(error as Error).message}`);}
  };
  visit(root,transform,'nonzero',0);return {items,warnings};
}

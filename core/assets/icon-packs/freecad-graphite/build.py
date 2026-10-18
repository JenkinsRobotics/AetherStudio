"""Build FreeCAD Graphite from the attributed, unmodified local SVG sources.

Only writes this separate pack. No dependency on the ignored FreeCAD checkout.
Uses standard XML/colour processing, not raster filters; silhouettes stay SVG.
"""
from pathlib import Path
import colorsys
import hashlib
import json
import re
import zipfile
import xml.etree.ElementTree as E
from PIL import ImageColor

HERE=Path(__file__).resolve().parent
PACK=json.loads((HERE/'pack.json').read_text())
EXTENSIONS=json.loads((HERE/'extensions.json').read_text())['icons']
TOOL_MAP=json.loads((HERE/'tool-map.json').read_text())
SVG='http://www.w3.org/2000/svg'
XLINK='http://www.w3.org/1999/xlink'
E.register_namespace('',SVG);E.register_namespace('xlink',XLINK)
OVERRIDES=json.loads((HERE/'accent-overrides.json').read_text())
PALETTES={
 'dark':{'edge':'#e5edf7','muted':'#91a4bb','side':'#192636','top':'#6c8098','blueLow':'#0876d5','blueHigh':'#5bbdff'},
 'light':{'edge':'#405269','muted':'#7c8fa5','side':'#879db5','top':'#f3f7fc','blueLow':'#076cb8','blueHigh':'#37a8fa'},
}
SHAPES={'path','rect','circle','ellipse','polygon','polyline','line','use'}
def tag(el):return el.tag.split('}')[-1]
def rgb(value):
 try:return ImageColor.getrgb(value)[:3]
 except ValueError:return None

def mix(a,b,t):
 aa=rgb(a);bb=rgb(b)
 return '#'+''.join(f'{round(x+(y-x)*t):02x}' for x,y in zip(aa,bb))

def recolor(value,role,palette):
 value=value.strip();colors=PALETTES[palette]
 if value in ['none','inherit','transparent','context-stroke','context-fill'] or value.startswith('url('):return value
 if value=='currentColor':return colors['edge']
 parsed=rgb(value)
 if not parsed:raise ValueError(f'Unknown paint {value!r}')
 r,g,b=[v/255 for v in parsed];h,s,v=colorsys.rgb_to_hsv(r,g,b);h*=360
 if role=='stroke':
  if s>.45 and v>.55 and not 42<h<78:
   return colors['muted'] if 170<h<265 else colors['blueHigh']
  return colors['edge']
 # FreeCAD's yellow base solids become graphite; colored feature regions/markers
 # become blue. Neutral luminance still distinguishes the visible solid faces.
 if s>.25 and (h<42 or h>265 or 78<h<170) and v>.28:
  return mix(colors['blueLow'],colors['blueHigh'],v)
 if v<.23:return colors['edge']
 luminance=.2126*r+.7152*g+.0722*b
 return mix(colors['side'],colors['top'],max(0,min(1,(luminance-.1)/.9)))

def declarations(text,palette):
 def replace(match):return match[1]+':'+recolor(match[2],match[1],palette)
 text=re.sub(r'\b(fill|stroke|stop-color|color)\s*:\s*([^;}]+)',replace,text)
 text=re.sub(r'\bstroke-width\s*:\s*[^;}]+','stroke-width:1.1',text)
 text=re.sub(r'\bfilter\s*:\s*[^;}]+;?','',text)
 return text

def build(entry,palette):
 original=HERE/entry['original']
 if hashlib.sha256(original.read_bytes()).hexdigest()!=entry['sha256']:
  raise ValueError(f'Original changed: {entry["id"]}')
 root=E.fromstring(original.read_bytes())
 # Keep source viewport and inheritance intact; only the displayed size is 32px.
 if 'viewBox' not in root.attrib:
  width=float(re.match(r'[\d.]+',root.get('width','64'))[0]);height=float(re.match(r'[\d.]+',root.get('height','64'))[0])
  root.set('viewBox',f'0 0 {width:g} {height:g}')
 root.set('width','32');root.set('height','32')
 if 'fill' not in root.attrib:root.set('fill','#000000')
 if 'color' not in root.attrib:root.set('color','#000000')
 def visit(parent):
  for child in list(parent):
   if not child.tag.startswith('{'+SVG+'}') or tag(child) in {'metadata','filter','title','desc'}:
    parent.remove(child);continue
   visit(child)
  for attr in list(parent.attrib):
   if attr.startswith('{') and not attr.startswith(('{'+XLINK+'}', '{http://www.w3.org/XML/1998/namespace}')):
    del parent.attrib[attr]
  parent.attrib.pop('filter',None)
  for prop in ['fill','stroke','stop-color','color']:
   if prop in parent.attrib:parent.set(prop,recolor(parent.get(prop),prop,palette))
  if 'style' in parent.attrib:parent.set('style',declarations(parent.get('style'),palette))
  if tag(parent)=='style' and parent.text:parent.text=declarations(parent.text,palette)
  if tag(parent) in SHAPES:
   parent.set('vector-effect','non-scaling-stroke');parent.set('stroke-width','1.1')
   parent.set('stroke-linejoin','round');parent.set('stroke-linecap','round')
 visit(root)
 # Illustrator exports can contain unused CSS classes referencing deleted
 # gradients. Remove only simple class rules with no matching element.
 classes={name for el in root.iter() for name in el.get('class','').split()}
 for el in root.iter():
  if tag(el)=='style' and el.text:
   el.text=re.sub(r'\.([\w-]+)\s*\{[^}]*\}',lambda m:m[0] if m[1] in classes else '',el.text)
 if entry['id'] in OVERRIDES:
  gradient=E.Element('{'+SVG+'}linearGradient',{'id':'aetherFeature','x1':'0','y1':'0','x2':'0.7','y2':'1'})
  for offset,key in [('0','blueHigh'),('1','blueLow')]:
   E.SubElement(gradient,'{'+SVG+'}stop',{'offset':offset,'stop-color':PALETTES[palette][key]})
  defs=E.Element('{'+SVG+'}defs');defs.append(gradient);root.insert(0,defs)
  found=set()
  for el in root.iter():
   if el.get('id') in OVERRIDES[entry['id']]:
    found.add(el.get('id'));el.set('fill','url(#aetherFeature)')
    if 'style' in el.attrib:el.set('style',re.sub(r'(?<![-\w])fill\s*:[^;]+;?', '',el.get('style')))
  if found != set(OVERRIDES[entry['id']]):raise ValueError('Missing accent target: '+entry['id'])
 # Drop unused Inkscape gradients after following chained href/url references.
 defs=[el for el in root.iter() if tag(el)=='defs'];definitions={c.get('id'):c for d in defs for c in d if c.get('id')}
 def refs(el):
  result=set()
  for item in el.iter():
   for key,val in item.attrib.items():
    result.update(re.findall(r'url\(#([^)]+)\)',val))
    if key.endswith('href') and val.startswith('#'):result.add(val[1:])
   if tag(item)=='style' and item.text:result.update(re.findall(r'url\(#([^)]+)\)',item.text))
  return result
 used=set()
 for child in root:
  if tag(child)!='defs':used.update(refs(child))
 used.update(re.findall(r'url\(#([^)]+)\)',str(root.attrib)))
 pending=list(used)
 while pending:
  key=pending.pop()
  if key in definitions:
   for dep in refs(definitions[key]):
    if dep not in used:used.add(dep);pending.append(dep)
 for d in defs:
  for child in list(d):
   if child.get('id') not in used:d.remove(child)
  if len(d)==0:
   for parent in root.iter():
    if d in list(parent):parent.remove(d);break
 description=E.Element('{'+SVG+'}desc')
 description.text=f'FreeCAD Graphite adaptation by Aether Studio contributors, {PACK["modifiedDate"]}. Original: {entry["source"]}. Authors: '+', '.join(entry['authors'])+'. Rights: '+ '; '.join(entry['rights'])+'. Source and license notices: '+ '; '.join(entry['licenseDeclarations'])
 root.insert(0,description)
 return E.tostring(root,encoding='unicode')+'\n'

def build_extension(entry,palette):
 source=(HERE/entry['master']).read_text()
 for key,value in PALETTES[palette].items():source=source.replace('@'+key+'@',value)
 if re.search(r'@[\w-]+@',source):raise ValueError('Unresolved palette token: '+entry['id'])
 root=E.fromstring(source)
 description=E.Element('{'+SVG+'}desc')
 description.text=f'FreeCAD Graphite extension: {entry["name"]}. Original illustration by Aether Studio contributors, {PACK["modifiedDate"]}; not upstream FreeCAD artwork.'
 root.insert(0,description)
 return E.tostring(root,encoding='unicode')+'\n'

if __name__=='__main__':
 for palette in PALETTES:
  for entry in PACK['icons']:
   dest=HERE/palette/(entry['id']+'.svg');dest.parent.mkdir(parents=True,exist_ok=True)
   dest.write_text(build(entry,palette))
  for entry in EXTENSIONS:
   dest=HERE/palette/(entry['id']+'.svg');dest.parent.mkdir(parents=True,exist_ok=True)
   dest.write_text(build_extension(entry,palette))
 entries=PACK['icons']+EXTENSIONS
 ids={entry['id'] for entry in entries}
 if len(ids)!=len(entries):raise ValueError('Duplicate icon ID')
 if set(TOOL_MAP.values())-ids:raise ValueError('Tool alias points to a missing icon')
 catalog=[{'id':e['id'],'name':e['name'],'workbench':e['workbench'],
           'toolNames':[key for key,value in TOOL_MAP.items() if value==e['id']]} for e in entries]
 (HERE/'tool-map.ts').write_text('// Generated by build.py; semantic tool-name aliases, not duplicated artwork.\nexport const freecadToolIconMap = '+json.dumps(TOOL_MAP,indent=2)+' as const;\n')
 rows=['# Aether illustrated tool coverage in FreeCAD Graphite', '',
       f'{len(TOOL_MAP)} tools: {len(TOOL_MAP)-len(EXTENSIONS)} upstream equivalents and {len(EXTENSIONS)} purpose-drawn Aether additions.', '',
       'Shared monochrome interface glyphs are a separate collection; this inventory covers the illustrated ToolIcon collection.', '',
       '| Aether tool | FreeCAD Graphite icon | Origin |', '| --- | --- | --- |']
 for name,target in TOOL_MAP.items():rows.append(f'| {name} | {target} | '+('Aether original' if target.startswith('Aether/') else 'FreeCAD-derived')+' |')
 (HERE/'COVERAGE.md').write_text('\n'.join(rows)+'\n')
 (HERE/'catalog.ts').write_text('// Generated by build.py; source and licenses are recorded in pack.json.\nexport const freecadIconCatalog = '+json.dumps(catalog,indent=2)+' as const;\n')
 # Supply original artwork and editable transformations alongside the gallery.
 source_files=sorted([*HERE.glob('LICENSE-*'), *HERE.glob('*.md'), HERE/'pack.json',
                      HERE/'build.py', HERE/'accent-overrides.json', HERE/'extensions.json', HERE/'tool-map.json',
                      *(HERE/'masters').glob('*.svg'), *(HERE/'originals').rglob('*.svg')])
 with zipfile.ZipFile(HERE/'sources.zip','w',compression=zipfile.ZIP_DEFLATED) as archive:
  for file in source_files:
   info=zipfile.ZipInfo('freecad-graphite/'+str(file.relative_to(HERE)),(2026,9,24,0,0,0))
   info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644 << 16
   archive.writestr(info,file.read_bytes())
 print(f'Built {len(catalog)} icons in light and dark, plus attributed editable source archive.')

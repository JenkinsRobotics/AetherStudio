"""Create labelled SVG review sheets at 24px and 40px. Requires only Python.

Usage: python3 review.py /tmp/graphite-review
Rasterize each SVG using rsvg-convert for visual inspection; not an icon source.
"""
from pathlib import Path
import json
import re
import sys
import html

HERE = Path(__file__).resolve().parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / 'review'
OUT.mkdir(parents=True, exist_ok=True)
NAMES = json.loads((HERE / 'pack.json').read_text())['icons']

def icon(name, palette, x, y, size, prefix):
    svg = (HERE / palette / f'{name}.svg').read_text()
    svg = svg.replace('<svg ', f'<svg x="{x}" y="{y}" width="{size}" height="{size}" ')
    svg = re.sub(r'id="([^"]+)"', lambda m: f'id="{prefix}-{m[1]}"', svg)
    return re.sub(r'url\(#([^)]+)\)', lambda m: f'url(#{prefix}-{m[1]})', svg)

def label(x, y, value, fg, size=12):
    return f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}" fill="{fg}">{html.escape(value)}</text>'

for page in range(4):
    parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1088" height="976" viewBox="0 0 1088 976">']
    for row, palette in enumerate(['dark','light']):
        y=row*488
        fg='#e7edf5' if palette=='dark' else '#304155'
        bg='#17212f' if palette=='dark' else '#f1f4f8'
        parts += [f'<rect y="{y}" width="1088" height="488" fill="{bg}"/>',label(24,y+34,f'Graphite Ribbon · {palette} · {page+1}/4 · 40px + 24px',fg,18)]
        for i,name in enumerate(NAMES[page*32:(page+1)*32]):
            x=24+(i%8)*134; yy=y+62+(i//8)*104
            parts += [icon(name,palette,x+9,yy,40,f'{palette}-{i}-large'),icon(name,palette,x+65,yy+8,24,f'{palette}-{i}-small'),label(x,yy+63,name,fg,10)]
    parts.append('</svg>')
    (OUT/f'review-{page+1}.svg').write_text(''.join(parts))
print(f'Wrote 4 paired-palette review sheets to {OUT}')

# Compact overview: reference tools enlarged, followed by every icon at 28px.
featured=['new-part','part','cylinder','sphere','extrude','chamfer','rotate','plane','measure','insert','assembly','select']
parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="850" viewBox="0 0 1200 850">']
for row,palette in enumerate(['dark','light']):
    y=row*425
    bg='#17212f' if palette=='dark' else '#f1f4f8'
    fg='#e7edf5' if palette=='dark' else '#304155'
    parts += [f'<rect y="{y}" width="1200" height="425" fill="{bg}"/>',label(28,y+35,f'Graphite Ribbon — {palette}',fg,20)]
    for i,name in enumerate(featured):
        parts += [icon(name,palette,30+i*97,y+65,50,f'{palette}-featured-{i}'),label(30+i*97,y+137,name,fg,10)]
    for i,name in enumerate(NAMES):
        parts.append(icon(name,palette,26+(i%31)*37,y+173+(i//31)*55,28,f'{palette}-all-{i}'))
parts.append('</svg>')
(OUT/'preview.svg').write_text(''.join(parts))

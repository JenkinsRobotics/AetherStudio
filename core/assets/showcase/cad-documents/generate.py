"""Original illustrative CAD thumbnails for the UI gallery, not exact CAD models.
Regenerate with Python's standard library; output is small, scalable SVG artwork.
"""
from pathlib import Path
from math import cos, sin, pi

ROOT = Path(__file__).parent
VIEW = (-.46, .69, .56)
LIGHT = (-.3, -.5, .81)
GRAY, TEAL, GREEN, BLUE, RED = '#80878b', '#00b7bb', '#248851', '#2b9dd0', '#d94545'
faces = []


def face(points, color, normal):
    if sum(a*b for a, b in zip(normal, VIEW)) <= 0:
        return
    light = .64 + .36*max(0, sum(a*b for a, b in zip(normal, LIGHT)))
    rgb = [int(color[i:i+2], 16) for i in (1, 3, 5)]
    fill = '#' + ''.join(f'{min(255, int(v*light)):02x}' for v in rgb)
    faces.append((sum(sum(a*b for a, b in zip(p, VIEW)) for p in points)/len(points), points, fill))


def box(x, y, z, w, d, h, color=GRAY):
    p = [(x+a*w/2, y+b*d/2, z+c*h/2) for a, b, c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    for ids,n in [([0,3,2,1],(0,0,-1)),([4,5,6,7],(0,0,1)),([0,1,5,4],(0,-1,0)),([1,2,6,5],(1,0,0)),([2,3,7,6],(0,1,0)),([3,0,4,7],(-1,0,0))]:
        face([p[i] for i in ids], color, n)


def cylinder(x,y,z,r,h,color=GRAY,axis='z',inner=0,n=24):
    def point(a,b,c): return (x+c,y+a,z+b) if axis=='x' else (x+a,y+b,z+c)
    def norm(a,b,c): return (c,a,b) if axis=='x' else (a,b,c)
    for i in range(n):
        a,b = 2*pi*i/n,2*pi*(i+1)/n
        ca,sa,cb,sb=cos(a),sin(a),cos(b),sin(b)
        face([point(r*ca,r*sa,-h/2),point(r*cb,r*sb,-h/2),point(r*cb,r*sb,h/2),point(r*ca,r*sa,h/2)],color,norm(cos((a+b)/2),sin((a+b)/2),0))
        for sign in (-1,1):
            face([point(inner*ca,inner*sa,sign*h/2),point(r*ca,r*sa,sign*h/2),point(r*cb,r*sb,sign*h/2),point(inner*cb,inner*sb,sign*h/2)],color,norm(0,0,sign))
        if inner:
            face([point(inner*ca,inner*sa,-h/2),point(inner*cb,inner*sb,-h/2),point(inner*cb,inner*sb,h/2),point(inner*ca,inner*sa,h/2)], color, norm(-cos((a+b)/2),-sin((a+b)/2),0))


def rod():
    box(0,0,0,1.9,.35,.22)
    cylinder(-1,0,0,.45,.28,inner=.23)
    cylinder(1,0,0,.29,.28,inner=.14)


def piston():
    cylinder(0,0,.9,.67,1.8,GREEN)
    for z in (1.32,1.48,1.64): cylinder(0,0,z,.68,.05,'#185c38')
    cylinder(0,-.5,.65,.22,.38,'#205f39',axis='x',inner=.12)


def crank():
    cylinder(0,0,0,.23,3.8,axis='x')
    for x in (-1.3,0,1.3):
        cylinder(x,0,0,.58,.22,axis='x')
        cylinder(x+.18,0,.37,.23,.56,axis='x')
    cylinder(-2,0,0,.38,.3,axis='x')


def render(name, build):
    faces.clear(); build()
    def project(p):
        x,y,z=p; return (.832*x+.555*y, -.309*x+.463*y-.832*z)
    pts=[project(p) for _,polygon,_ in faces for p in polygon]
    x0,x1=min(p[0] for p in pts),max(p[0] for p in pts)
    y0,y1=min(p[1] for p in pts),max(p[1] for p in pts)
    scale=76/max(x1-x0,y1-y0)
    def transform(p):
        a,b=project(p);return f'{48+(a-(x0+x1)/2)*scale:.2f},{46+(b-(y0+y1)/2)*scale:.2f}'
    polygons=''.join(f'<polygon points="{" ".join(transform(p) for p in ps)}" fill="{color}" stroke="{color}" stroke-width="0.25" stroke-linejoin="round"/>' for _,ps,color in sorted(faces,key=lambda f:f[0]))
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><ellipse cx="48" cy="85" rx="28" ry="3" fill="#000" opacity=".05"/>{polygons}</svg>\n'
    (ROOT/f'{name}.svg').write_text(svg)

render('connecting-rod', rod)
render('crankshaft', crank)
render('piston', piston)
render('piston-pin', lambda:cylinder(0,0,0,.4,2.8,axis='x',inner=.2))
render('origin-marker', lambda:cylinder(0,0,0,.65,1.55,n=6))
render('base-plate', lambda:box(0,0,0,2,1.5,.18,TEAL))
render('l-bracket', lambda:(box(0,0,0,1.6,1.2,.18),box(0,.51,.6,1.6,.18,1.2)))
render('guide-rod', lambda:cylinder(0,0,0,.065,3.4,TEAL))
render('locating-pin', lambda:(cylinder(0,0,0,.16,2.6,BLUE),cylinder(0,0,1.3,.32,.18,RED)))
render('square-washer', lambda:(box(-.7,0,0,.45,1.8,.17,TEAL),box(.7,0,0,.45,1.8,.17,TEAL),box(0,.7,0,.95,.4,.17,TEAL),box(0,-.7,0,.95,.4,.17,TEAL)))
render('socket-screw', lambda:(cylinder(0,0,0,.22,1.9),cylinder(0,0,1,.42,.4,inner=.18,n=12)))
render('hex-nut', lambda:cylinder(0,0,0,.65,.48,inner=.3,n=6))
render('piston-assembly', lambda:(piston(),box(0,0,-.8,.3,.22,1.8),cylinder(0,0,-1.7,.38,.22,inner=.2)))
render('rod-assembly', lambda:(rod(),cylinder(-1,0,.4,.19,.6),cylinder(1,0,.4,.12,.6)))

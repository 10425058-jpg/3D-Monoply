"""Open-span fantasy stone bridge: actual three-arch apertures, never a solid wall."""
import math
from core import mesh, box, lathe, transform_objects


def generate_bridge(materials, detail="high", origin=(0,0,0), scale=1, rotation=0, length=5.6):
    spans=3
    span=length/spans
    spring=.53
    radius=span*.41
    deck_height=1.55
    depth=.92
    objects=[]
    # Stone spandrel strips have curved lower edges above each genuinely open arch.
    segments=12 if detail=="high" else 8
    for opening in range(spans):
        center=-length/2+span*(opening+.5)
        points=[(center-radius+i*(2*radius)/segments,
                 spring+math.sqrt(max(0,radius*radius-(-radius+i*(2*radius)/segments)**2))) for i in range(segments+1)]
        verts=[]
        for y in [-depth/2,depth/2]:
            for x,z in points: verts.extend([(x,y,z),(x,y,deck_height)])
        n=(segments+1)*2
        faces=[]
        for i in range(segments):
            a=i*2
            faces.extend([(a,a+2,a+3,a+1),(n+a,n+a+1,n+a+3,n+a+2),
                          (a,n+a,n+a+2,a+2),(a+1,a+3,n+a+3,n+a+1)])
        faces.extend([(0,1,n+1,n),(n-2,2*n-2,2*n-1,n-1)])
        objects.append(mesh("Bridge curved arch spandrel",verts,faces,materials["stone"]))
    for i in range(spans+1):
        x=-length/2+i*span
        objects.append(box("Bridge tapered masonry pier",(x,0,.72),(.32,1.04,1.44),materials["stone"],.045))
        objects.append(box("Bridge pier moulded footing",(x,0,.10),(.46,1.20,.20),materials["stone"],.035))
    objects.append(box("Bridge stone deck",(0,0,deck_height+.055),(length+.25,1.12,.17),materials["ivory"],.045))
    for side in [-1,1]:
        y=side*.52
        objects.append(box("Bridge gold-topped parapet",(0,y,deck_height+.56),(length+.3,.13,.10),materials["stone"],.025))
        objects.append(box("Bridge gold inlay rail",(0,y,deck_height+.62),(length+.28,.055,.028),materials["gold"],.008))
        count=14 if detail=="high" else 9
        for i in range(count):
            x=-length/2+i*length/(count-1)
            objects.append(lathe("Bridge turned baluster",[(.045,0),(.065,.06),(.045,.17),(.055,.28),(.045,.42)],6,materials["ivory"],(x,y,deck_height+.13)))
    for obj in objects: obj["asset_module"]="bridge"
    return transform_objects(objects,origin,scale,rotation)

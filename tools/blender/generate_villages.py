"""Modular glazed-roof cottages with timber, bays, balconies and inset windows."""
import math
from core import box, mesh, tube, arch, arch_panel, transform_objects
from generate_castles import _window


def generate_house(materials, variant="cottage", detail="high", origin=(0,0,0), scale=1, rotation=0):
    balcony = variant in {"boutique", "balcony", "right", 1}
    tall = variant in {"townhouse", "cafe", "left", 2}
    width, depth = (1.65,1.36) if tall else (1.5,1.38)
    wall_height=2.0 if tall else 1.55
    objects=[box("Cottage stone footing",(0,0,.11),(width+.13,depth+.13,.22),materials["stone"],.045),
             box("Cottage plaster chamber",(0,0,wall_height/2+.18),(width,depth,wall_height),materials["ivory"],.045)]
    top=.18+wall_height
    w,d=width/2+.16,depth/2+.15
    ridge=.90 if tall else .79
    # Steep gable roof, projecting eaves, separate ridge cap and timber bargeboards.
    verts=[(-w,-d,0),(w,-d,0),(w,d,0),(-w,d,0),(0,-d,ridge),(0,d,ridge)]
    objects.append(mesh("Cottage pitched slate roof",verts,[(0,4,5,3),(4,1,2,5),(0,1,4),(3,5,2),(0,3,2,1)],materials["blue"],(0,0,top)))
    objects.append(tube("Cottage gold ridge cap",[(0,-d-.025,top+ridge+.02),(0,d+.025,top+ridge+.02)],.035,materials["gold"],6))
    for y in [-d-.015,d+.015]:
        objects.append(tube("Timber gable bargeboard",[(-w,y,top),(0,y,top+ridge),(w,y,top)],.040,materials["wood"],6))
    if detail != "low":
        for t in [.26,.52,.76]:
            x=w*(1-t)
            for side in [-1,1]:
                objects.append(tube("Raised roof tile seam",[(side*x,-d,top+ridge*t+.018),(side*x,d,top+ridge*t+.018)],.013,materials["blue"],4))
    for x in [-width/2+.035,width/2-.035]:
        objects.append(box("Exposed corner timber",(x,-depth/2-.018,wall_height/2+.2),(.075,.07,wall_height),materials["wood"],.01))
    objects.append(box("Exposed timber floor band",(0,-depth/2-.022,top-.12),(width,.07,.09),materials["wood"],.01))
    door_x=-.29 if balcony else 0
    objects.append(arch_panel("Cottage recessed oak doorway",.42,.9,.035,(door_x,-depth/2-.018,.22),materials["wood"],8))
    objects.append(arch("Cottage carved door surround",.45,.94,.1,(door_x,-depth/2-.07,.21),materials["stone"],.075,8))
    objects.append(box("Cottage doorstep",(door_x,-depth/2-.20,.17),(.70,.36,.12),materials["stone"],.03))
    if balcony:
        objects.extend(_window(materials,(.38,-depth/2-.018,.77),.32,.55,0,detail,"Boutique front window"))
    else:
        for x in [-.48,.48]:
            objects.extend(_window(materials,(x,-depth/2-.018,.72),.24,.47,0,detail,"Cottage lower lancet"))
    if tall:
        for x in [-.39,.39]:
            objects.extend(_window(materials,(x,-depth/2-.025,1.48),.29,.53,0,detail,"Townhouse upper window"))
        objects.append(box("Townhouse floor beam",(0,-depth/2-.03,1.25),(width,.09,.10),materials["wood"],.015))
    objects.extend(_window(materials,(0,-d-.016,top+.08),.24,.44,0,detail,"Gable attic window"))
    # Chimneys are offset and capped rather than a naked roof cube.
    objects.append(box("Cottage chimney",(.40,.30,top+.62),(.25,.25,.88),materials["stone"],.025))
    objects.append(box("Cottage chimney cap",(.40,.30,top+1.08),(.34,.34,.10),materials["stone"],.02))
    objects.append(box("Cottage chimney dark flue",(.40,.30,top+1.14),(.15,.15,.025),materials["rock"],0))
    if detail != "low":
        if balcony:
            objects.append(box("Boutique balcony floor",(.15,-depth/2-.29,1.2),(1.05,.55,.10),materials["wood"],.025))
            objects.append(box("Balcony upper handrail",(.15,-depth/2-.53,1.60),(1.13,.065,.065),materials["gold"],.01))
            for x in [-.34,-.10,.15,.40,.65]:
                objects.append(box("Balcony slim baluster",(x,-depth/2-.53,1.39),(.035,.04,.40),materials["wood"],0))
        elif tall:
            # Cantilevered shop awning with alternating timber/ivory fascia.
            awning=mesh("Cafe sweeping awning",[(-.72,-.76,1.37),(.72,-.76,1.37),(.72,-1.09,1.14),(-.72,-1.09,1.14)],[(0,1,2,3)],materials["blue"])
            objects.append(awning)
            objects.append(box("Cafe gold awning edge",(0,-1.1,1.13),(1.49,.055,.07),materials["gold"],.015))
        for side in [-1,1]:
            objects.extend(_window(materials,(side*(width/2+.015),.15,.8),.26,.50,-side*math.pi/2,detail,"Side cottage window"))
    for obj in objects:
        obj["asset_module"]="house"; obj["variant"]=str(variant)
    return transform_objects(objects,origin,scale,rotation)


def generate_village(materials, variant="left", detail="high", origin=(0,0,0), scale=1):
    placements=[(-4.15,-1.2,.1,.18,"cafe"),(3.9,-1.4,.1,-.24,"boutique"),(-3.5,1.5,.1,-.22,"cottage")]
    if variant=="right":
        placements=[(-4.0,.1,.1,.25,"boutique"),(3.45,-1.7,.1,-.3,"townhouse"),(4.5,1.2,.1,.1,"cottage")]
    objects=[]
    for x,y,z,rotation,house_variant in placements:
        objects.extend(generate_house(materials,house_variant,detail,(x,y,z),.72,rotation))
    return transform_objects(objects,origin,scale)

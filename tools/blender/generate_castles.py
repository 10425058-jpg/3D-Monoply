"""Reusable sculpted fantasy castle modules, authored in Blender geometry."""
import math
from core import box, mesh, lathe, arch, arch_panel, tube, transform_objects


def _window(materials, position, width=.32, height=.76, rotation=0, detail="high", name="Lancet"):
    """Inset dark reveal, warm arched pane, open stone surround and mullions."""
    objects = [arch_panel(name + " deep reveal", width + .12, height + .08, .035, (0, .025, 0), materials["rock"], 8),
               arch_panel(name + " warm glass", width, height, .025, (0, -.006, .035), materials["window"], 8)]
    if detail != "low":
        objects.append(arch(name + " carved archivolt", width + .025, height + .045, .11, (0, -.055, 0), materials["stone"], .055, 8))
        objects.append(box(name + " sill", (0, -.095, -.025), (width + .23, .25, .075), materials["stone"], .015))
        objects.append(box(name + " mullion", (0, -.09, height * .40), (.028, .025, height * .75), materials["wood"], 0))
        objects.append(box(name + " transom", (0, -.09, height * .38), (width, .025, .028), materials["wood"], 0))
    return transform_objects(objects, position, 1, rotation)


def _roof(materials, radius, height, location, detail="high", name="Swept slate spire"):
    segments = {"high": 18, "balanced": 14, "low": 10}.get(detail, 14)
    rings = 7 if detail == "high" else 5 if detail == "balanced" else 4
    # Broad swept eaves, a gentle concave shoulder and a slender pointed crown.
    profile = [(radius * 1.18, 0), (radius * 1.17, .095), (radius, .18)]
    for i in range(1, rings + 1):
        t = i / rings
        r = radius * max(.012, (1 - t) ** .87) * (1 - math.sin(t * math.pi) * .11)
        profile.append((r, .18 + height * t))
    objects = [lathe(name, profile, segments, materials["blue"], location)]
    trim_profile = [(radius * 1.185, -.025), (radius * 1.19, .01), (radius * 1.18, .065)]
    objects.append(lathe(name + " gold eaves", trim_profile, segments, materials["gold"], location))
    if detail != "low":
        for i in range(1, 4 if detail == "high" else 3):
            t = i / 4
            r = radius * (1-t) ** .87 * (1-math.sin(t*math.pi)*.11)
            z = .18 + height*t
            objects.append(lathe(name + f" tile course {i}", [(r+.012,z-.02),(r+.023,z),(r,z+.025)], segments, materials["blue"], location))
    x, y, z = location
    objects.append(lathe(name + " finial", [(.055,0),(.11,.07),(.075,.15),(.018,.29),(0,.36)], 8, materials["gold"], (x,y,z+height+.18)))
    # One geometrically rippled pennant, its gold staff remains a distinct silhouette.
    objects.append(lathe(name + " flag staff", [(.018,0),(.018,.55)], 6, materials["gold"], (x,y,z+height+.22)))
    flag = [(0,0,.16),(.33,.02,.17),(.27,.045,.26),(.40,.01,.35),(0,0,.35)]
    objects.append(mesh(name + " royal pennant", flag, [(0,1,2,3,4)], materials["blue"], (x,y,z+height+.37)))
    return objects


def _tower(materials, location, radius, height, roof_height, detail, name):
    segments = {"high":16,"balanced":12,"low":10}.get(detail,12)
    profile = [(radius*1.06,0),(radius*1.06,.16),(radius,.22),(radius,height-.32),
               (radius*1.12,height-.24),(radius*1.12,height-.10),(radius*1.03,height)]
    objects = [lathe(name + " limestone shaft", profile, segments, materials["ivory"], location)]
    for z in [.23, height*.52, height-.32]:
        objects.append(lathe(name + " moulded stringcourse", [(radius*1.04,z-.045),(radius*1.09,z),(radius*1.04,z+.045)], segments, materials["stone"], location))
    x,y,z = location
    objects.extend(_roof(materials, radius*1.07, roof_height, (x,y,z+height), detail, name+" roof"))
    rows = [height*.3, height*.64] if detail != "low" else [height*.52]
    for row in rows:
        objects.extend(_window(materials,(x,y-radius-.015,z+row),radius*.47,.64 if radius>.5 else .48,0,detail,name+" front window"))
        if detail == "high":
            for side in [-1,1]:
                objects.extend(_window(materials,(x+side*(radius+.015),y,z+row),radius*.42,.60,-side*math.pi/2,detail,name+" side window"))
    return objects


def _hip_roof(materials, width, depth, height, location, name="Hipped slate roof"):
    w,d = width/2,depth/2
    verts=[(-w,-d,0),(w,-d,0),(w,d,0),(-w,d,0),(-w*.34,0,height),(w*.34,0,height)]
    objects=[mesh(name,verts,[(0,1,5,4),(1,2,5),(2,3,4,5),(3,0,4),(3,2,1,0)],materials["blue"],location)]
    x,y,z=location
    objects.append(box(name+" gold ridge",(x,y,z+height+.015),(width*.7,.055,.055),materials["gold"],.01))
    objects.append(box(name+" lower fascia",(x,y-depth/2,z),(width,.06,.10),materials["stone"],.015))
    return objects


def _gable_roof(materials, width, depth, height, location, name="Royal chapel roof"):
    """Swept pitched nave with an ivory gable and gilded verge/ridge."""
    w,d=width/2,depth/2
    profile=[(-w*1.08,0),(-w*.88,height*.26),(-w*.48,height*.72),(0,height),
             (w*.48,height*.72),(w*.88,height*.26),(w*1.08,0)]
    vertices=[(x,y,z) for y in [-d,d] for x,z in profile]
    faces=[(i,i+1,i+8,i+7) for i in range(6)]
    objects=[mesh(name+" swept slate pitches",vertices,faces,materials["blue"],location)]
    x,y,z=location
    objects.append(mesh(name+" ivory tympanum",[(-w,-.01,0),(w,-.01,0),(0,-.01,height*.95)],
                        [(0,1,2)],materials["ivory"],(x,y-d,z)))
    objects.append(mesh(name+" rear tympanum",[(-w,.01,0),(w,.01,0),(0,.01,height*.95)],
                        [(2,1,0)],materials["ivory"],(x,y+d,z)))
    objects.append(tube(name+" gold front verge",[(x+px,y-d-.025,z+pz+.02) for px,pz in profile],.025,materials["gold"],sides=4))
    objects.append(tube(name+" gilded ridge",[(x,y-d,z+height+.03),(x,y+d,z+height+.03)],.035,materials["gold"],sides=5))
    return objects


def _loggia(materials, detail):
    """A genuinely open three-bay gallery replaces one palace wing/turret."""
    objects=[]
    for index in range(3):
        x=-2.03+(index-1)*.53
        objects.append(arch("Palace open arcade",.46,1.42,.18,(x,-1.10,.58),materials["ivory"],.055,6 if detail=="low" else 9))
    objects.append(box("Loggia balcony slab",(-2.03,-1.10,2.08),(1.82,.66,.15),materials["stone"],.025))
    objects.append(box("Loggia upper chamber",(-2.03,.30,2.20),(1.75,1.90,.82),materials["ivory"],.045))
    objects.extend(_gable_roof(materials,1.95,2.20,1.18,(-2.03,.30,2.61),"West gallery gable"))
    if detail!="low":
        for index in range(7):
            objects.append(lathe("Loggia slender baluster",[(.035,0),(.055,.12),(.026,.31)],5,materials["stone"],(-2.80+index*.255,-1.35,2.15)))
        objects.append(box("Loggia golden handrail",(-2.03,-1.35,2.49),(1.72,.055,.055),materials["gold"],0))
    return objects


def _heraldry(materials, location, scale=1):
    x,y,z=location
    shield=[(-.28,0,.50),(.28,0,.50),(.25,0,.15),(0,0,0),(-.25,0,.15)]
    objects=[mesh("Blue heraldic shield",shield,[(4,3,2,1,0)],materials["blue"],(x,y,z))]
    crown=[(-.16,0,.2),(-.2,0,.4),(-.08,0,.32),(0,0,.46),(.08,0,.32),(.2,0,.4),(.16,0,.2)]
    objects.append(mesh("Raised gold crown heraldry",crown,[tuple(reversed(range(7)))],materials["gold"],(x,y-.01,z+.1)))
    return objects


def generate_castle(materials, variant="left", detail="high", origin=(0,0,0), scale=1):
    """Return organized objects for a 6×5 m castle, approximately nine metres high."""
    objects=[]
    right=variant=="right"
    objects.append(box("Castle terrace plinth",(0,0,.13),(6.5,4.8,.26),materials["stone"],.10))
    objects.append(box("Castle upper limestone terrace",(0,0,.32),(6.25,4.6,.15),materials["ivory"],.06))
    # The entrance is a backed, recessed alcove between two structural piers.
    objects.append(box("Keep rear chamber",(0,.45,2.35),(2.7,1.75,4.0),materials["ivory"],.065))
    for side in [-1,1]:
        objects.append(box("Keep front entrance pier",(side*.99,-.73,2.04),(.76,.72,3.4),materials["ivory"],.045))
    objects.append(box("Keep carved entrance lintel",(0,-.78,3.9),(2.7,.76,.95),materials["ivory"],.045))
    for floor in [.6,2.3,3.4,4.35]:
        objects.append(box("Keep cornice",(0,.1,floor),(2.86,2.55,.13),materials["stone"],.025))
    if right:
        objects.extend(_gable_roof(materials,3.1,2.8,1.72,(0,.12,4.4),"Palace vaulted nave"))
        objects.extend(_window(materials,(0,-1.31,4.58),.43,1.02,0,detail,"Nave gilded lancet"))
    else:
        objects.extend(_hip_roof(materials,3.1,2.8,1.1,(0,.12,4.4)))
        objects.extend(_gable_roof(materials,1.20,.48,.90,(0,-1.28,3.96),"Gatehouse heraldic pediment"))
    # Paired arched doorway skins sit 0.3m behind the actual projecting surround.
    objects.append(arch_panel("Entrance deep shadow reveal",1.47,2.6,.05,(0,-1.105,.4),materials["rock"],12))
    objects.append(arch_panel("Heavy arched oak doors",1.22,2.4,.05,(0,-1.16,.42),materials["wood"],12))
    objects.append(arch("Triple carved entrance archivolt",1.5,2.62,.31,(0,-1.39,.38),materials["stone"],.20,14))
    objects.append(arch("Golden inner entrance lining",1.27,2.46,.08,(0,-1.37,.40),materials["gold"],.035,12))
    objects.append(box("Door center stile",(0,-1.20,1.33),(.045,.035,1.8),materials["gold"],.01))
    for side in [-1,1]:
        objects.append(lathe("Door gilded boss",[(.04,0),(.06,.025),(.04,.05)],8,materials["gold"],(side*.13,-1.21,1.35)))
    objects.extend(_heraldry(materials,(0,-1.24,3.18)))
    for step in range(5):
        objects.append(box("Ceremonial stone stair",(0,-1.92-step*.18,.30-step*.055),(2.1+step*.17,.42,.14),materials["stone"],.025))
    for side in [-1,1]:
        wing_x=side*2.03
        if right and side==-1:
            objects.extend(_loggia(materials,detail))
            continue
        objects.append(box("Castle side wing",(wing_x,.15,1.5),(1.75,2.38,2.33),materials["ivory"],.06))
        objects.append(box("Wing projecting footing",(wing_x,.15,.50),(1.89,2.50,.20),materials["stone"],.025))
        objects.extend(_hip_roof(materials,2.05,2.7,.87,(wing_x,.15,2.74),"Wing hipped roof"))
        for wx in [-.42,.42]:
            objects.extend(_window(materials,(wing_x+wx,-1.07,1.23),.31,.73,0,detail,"Wing lancet"))
        objects.extend(_heraldry(materials,(wing_x,-1.11,2.03),.7))
    # Vary the rear silhouette, tower hierarchy and offsets between left/right.
    central=(1.30,1.20,.42) if right else (-.20,.87,.42)
    objects.extend(_tower(materials,central,.74,5.90 if right else 5.85,2.15 if right else 1.85,detail,"Grand rear spire"))
    for side in [-1,1]:
        x=side*2.45
        h=3.55+(side*.28 if right else 0)
        if not right or side==-1:
            objects.extend(_tower(materials,(x,.95,.39),.61,h,1.45,detail,"Rear flanking tower"))
        if not right or side==1:
            objects.extend(_tower(materials,(side*1.32,-1.0,.39),.43,3.25 if right else 2.75,1.32 if right else 1.15,detail,"Entrance turret"))
    # The front keep's upper windows remain readable between the turrets.
    for x in [-.73,.73]:
        objects.extend(_window(materials,(x,-1.12,3.45),.27,.69,0,detail,"Upper keep lancet"))
    if detail != "low":
        # Deliberate corner quoins and compact parapets, rather than thousands of beads.
        for side in [-1,1]:
            for z in [1.0,1.6,2.2,2.8,3.4]:
                objects.append(box("Rusticated corner quoin",(side*1.34,-1.14,z),(.18,.16,.23),materials["stone"],.018))
            for i in range(5):
                objects.append(box("Terrace balustrade post",(side*(1.50+i*.34),-2.15,.62),(.10,.12,.45),materials["stone"],.015))
            objects.append(box("Terrace balustrade rail",(side*2.18,-2.15,.88),(1.55,.15,.10),materials["stone"],.02))
    for obj in objects:
        obj["asset_module"]="castle"
        obj["variant"]=variant
    return transform_objects(objects,origin,scale)

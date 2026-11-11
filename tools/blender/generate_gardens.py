"""Small authored garden accents sharing the kingdom atlas and ground origin."""
import math
from core import box, lathe, tube, transform_objects


def generate_pavilion(materials, detail="high", origin=(0,0,0), scale=1, rotation=0):
    """Open six-column belvedere with a shaped blue cupola; no solid tower."""
    high, low = detail == "high", detail == "low"
    sides = 12 if high else 8
    objects = [lathe("Belvedere circular stone steps", [(1.12,0),(1.12,.11),(.98,.11),(.98,.23)],
                     sides, materials["stone"], smooth=False)]
    for i in range(6):
        angle = i * math.tau / 6 + math.pi / 6
        x,y = math.cos(angle)*.78, math.sin(angle)*.78
        profile = [(.105,.23),(.105,.35),(.065,.44),(.065,1.7),(.11,1.78)] if high else [(.075,.23),(.075,1.78)]
        objects.append(lathe("Belvedere ivory column",profile,6,materials["ivory"],(x,y,0)))
    objects.append(lathe("Belvedere blue ribbed cupola", [(1.08,1.76),(1.09,1.88),(.92,1.99),(.75,2.2),(.43,2.43),(.06,2.54)],
                         sides,materials["blue"]))
    objects.append(lathe("Belvedere gold eave band", [(1.095,1.78),(1.1,1.84)],sides,materials["gold"]))
    objects.append(lathe("Belvedere gilded finial",[(.06,2.53),(.09,2.62),(.045,2.69),(.015,2.82)],6,materials["gold"]))
    if not low:
        for i in range(6):
            angle = i*math.tau/6+math.pi/6
            points = [(math.cos(angle)*r,math.sin(angle)*r,z) for r,z in [(1.09,1.85),(.94,2.0),(.76,2.22),(.43,2.45),(.06,2.56)]]
            objects.append(tube("Belvedere delicate gold roof rib",points,.016,materials["gold"],sides=3))
    for obj in objects:
        obj["asset_module"] = "garden_belvedere"
    return transform_objects(objects,origin,scale,rotation)


def generate_garden_accents(materials, variant="left", detail="high"):
    """A few retaining walls and stepping stones give the paths human scale."""
    objects = []
    walls = [(-1.8,-4.0,2.2), (3.1,3.7,2.6)] if variant == "left" else [(-4.4,-4.0,2.1), (4.5,3.2,1.7)]
    for x,y,length in walls:
        objects.append(box("Low garden limestone wall",(x,y,.30),(length,.18,.42),materials["stone"],.025 if detail=="high" else 0))
        objects.append(box("Garden wall ivory coping",(x,y,.53),(length+.07,.25,.07),materials["ivory"],0))
    count = 10 if detail == "high" else 6 if detail == "balanced" else 4
    for i in range(count):
        t = i/max(1,count-1)
        x = -4.5 + 8.5*t if variant == "left" else -4.0+4.8*t
        y = -2.77+.24*math.sin(t*math.pi*2) if variant == "left" else -3.55+.4*t
        stone = box("Village path dressed stepping stone",(x,y,.11),(.38,.45,.055),materials["ivory"],0)
        stone.rotation_euler.z = .12*math.sin(i*1.7)
        objects.append(stone)
    return objects

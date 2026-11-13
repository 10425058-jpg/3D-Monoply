"""Original supporting kingdoms, sharing the existing atlas and export pipeline.

blender --background --factory-startup --python-exit-code 1 --python tools/blender/generate_archipelago.py
Only sky-* assets and archipelago-manifest.json are written. Existing kingdoms
are never regenerated. All modelling is offline; no runtime Blender dependency.
"""
import json
import math
from pathlib import Path
import random
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import bpy
from core import arch, box, lathe, make_materials, mesh, reset_scene, tube
from export_assets import export_glb
from generate_floating_islands import _surface, _tint, _empty, _path
from generate_gardens import generate_pavilion
from generate_vegetation import generate_tree, generate_shrub
from generate_villages import generate_house

DESTINATION = HERE.parents[1] / "public/assets/models/environment"
SEED = 10425058


def landform(materials, kind, detail):
    """Asymmetric stepped tablelands with exposed stratum, roots and satellites."""
    rng = random.Random(SEED + sum(map(ord, kind)))
    count = 24 if detail == "high" else 18 if detail == "balanced" else 12
    rx, ry = {"observatory": (5.7, 4.7), "hamlet": (7.6, 3.9), "ruins": (6.2, 4.9)}[kind]
    rings = []
    for level, (radius, z) in enumerate(((1, 0), (1.04, -.65), (.87, -1.25), (.91, -2.0), (.54, -4.0), (.09, -6.8))):
        ring = []
        for i in range(count):
            angle = i * math.tau / count
            contour = 1 + .14 * math.sin(angle * 3 + .7) + .06 * math.sin(angle * 7)
            r = radius * contour * (1 + rng.uniform(-.045, .045))
            ring.append((math.cos(angle) * rx * r + level * .14,
                         math.sin(angle) * ry * r - level * .15,
                         z + (rng.uniform(-.22, .22) if level else 0)))
        rings.append(ring)
    objects = [_tint(_surface(f"{kind}_fractured_cliff", rings, materials["rock"], cap_bottom=True), "rock")]
    rim = [(x * 1.015, y * 1.015, .055) for x, y, _ in rings[0]]
    objects.append(_surface(f"{kind}_living_turf", [rim, rings[1]], materials["grass"]))
    objects.append(mesh(f"{kind}_meadow", rim, [tuple(range(count))], materials["grass"]))
    # Pale exposed strata and hanging roots articulate the vertical silhouette.
    for i in range(5 if detail == "low" else 9):
        angle = i * 2.399963 + .4
        x, y = math.cos(angle) * rx * .98, math.sin(angle) * ry * .98
        objects.append(tube(f"{kind}_hanging_root", [(x, y, -.15), (x * .98, y * .98, -1.3),
                            (x * .87 + .3, y * .87, -3.4 - rng.random())], [.09, .06, .012], materials["wood"], sides=4))
    for side in (-1, 1):
        points = []
        for i in range(count // 2 + 1):
            angle = side * math.pi * i / (count // 2)
            points.append((math.cos(angle) * rx * .94 + .2, math.sin(angle) * ry * .94, -1.55 + .13 * math.sin(angle * 3)))
        objects.append(tube(f"{kind}_exposed_stone_seam", points, .08, materials["stone"], sides=3))
    objects.append(_path(f"{kind}_promenade", [(-4.7, -1.4, .09), (-2.6, -2.5, .09),
                         (0, -2.6, .09), (2.6, -2.1, .09), (4.6, -1.2, .09)], [.55] * 5, materials["stone"]))
    return objects


def pine(materials, x, y, size, detail):
    objects = [lathe("Wind pine trunk", [(.13, 0), (.10, 2.7)], 5, materials["wood"], (x, y, .04))]
    for i in range(3):
        z = .8 + i * .67
        obj = lathe("Wind pine layered bough", [(1.02 - i * .20, z), (.72 - i * .16, z + .38), (.05, z + 1.2)],
                    8 if detail == "high" else 5, materials["leaf"], (x, y, .04))
        objects.append(obj)
    # Scale around the planting point, preserving ground contact.
    for obj in objects:
        obj.scale *= size
    return objects


def observatory(materials, detail):
    objects = landform(materials, "observatory", detail)
    sides = 24 if detail == "high" else 16 if detail == "balanced" else 12
    objects.append(lathe("Observatory processional steps", [(2.7,.05),(2.7,.20),(2.46,.20),(2.46,.40),(2.24,.40),(2.24,.58)], sides, materials["stone"]))
    objects.append(lathe("Observatory ivory drum", [(1.83,.58),(1.83,.78),(1.73,.86),(1.73,2.8),(1.95,2.9)], sides, materials["ivory"]))
    for i in range(8):
        angle = i * math.tau / 8
        window = arch("Observatory arched window surround", .59, 1.30, .12, (0,0,0), materials["stone"], .075, 8)
        window.location = (math.sin(angle)*1.75, -math.cos(angle)*1.75, 1.02)
        window.rotation_euler.z = angle
        objects.append(window)
        pane = box("Observatory warm glass", (math.sin(angle)*1.736, -math.cos(angle)*1.736, 1.63), (.40,.05,1.00), materials["window"], 0)
        pane.rotation_euler.z = angle
        objects.append(pane)
    objects.append(lathe("Observatory swept blue dome", [(2.06,2.9),(2.12,3.08),(1.98,3.3),(1.65,3.85),(1.1,4.35),(.42,4.68),(.07,4.77)], sides, materials["blue"]))
    objects.append(lathe("Observatory gilded cornice", [(2.13,3.02),(2.13,3.11)], sides, materials["gold"]))
    # Open astronomical armillary, with three tilted interlocking bronze rings.
    for tilt in (0, .85, -.85):
        points = [(math.cos(a)*.89, math.sin(a)*math.cos(tilt)*.89, 5.43 + math.sin(a)*math.sin(tilt)*.89)
                  for a in [i*math.tau/24 for i in range(25)]]
        objects.append(tube("Celestial armillary open ring", points, .045, materials["gold"], sides=4))
    objects.append(lathe("Armillary central spindle", [(.06,4.72),(.06,6.47),(.015,6.68)], 6, materials["gold"]))
    objects += generate_tree(materials, variant="observatory-west", detail="low", origin=(-3.6,.9,.06), scale=.78, form="windward")
    objects += generate_pavilion(materials, detail="low", origin=(3.7,-.3,.06), scale=.67)
    objects += pine(materials, 2.8, 2.3, .8, detail)
    return objects


def ruins(materials, detail):
    objects = landform(materials, "ruins", detail)
    for i, (x,y,height) in enumerate(((-3.5,1.8,3.7),(-.8,2.3,4.5),(2.0,2.2,3.8),(4.0,1.2,2.1))):
        objects.append(lathe("Ruined colonnade stepped plinth", [(.48,0),(.48,.18),(.35,.18),(.35,.4)], 8, materials["stone"], (x,y,.06)))
        objects.append(lathe("Ruined weathered ivory column", [(.27,.4),(.23,.55),(.21,height-.25),(.33,height-.14),(.33,height)], 8, materials["ivory"], (x,y,.06)))
        if i < 3:
            vine = [(x+math.cos(t*5.2+i)*.29,y+math.sin(t*5.2+i)*.29,.4+t*(height-.65)) for t in (0,.25,.5,.75,1)]
            objects.append(tube("Sanctuary climbing ivy",vine,[.06,.07,.08,.05,.02],materials["leaf"],sides=4))
        if i < 2:
            objects.append(arch("Ancient sanctuary open arch", 2.6, 3.9, .38, (x+1.3,y,.06), materials["stone"], .24, 12 if detail == "high" else 8))
    # A surviving aqueduct fragment and a broken parapet explain the old route.
    objects.append(box("Ruined aqueduct worn deck", (1.8,-1.0,.30), (6.2,.86,.30), materials["stone"], .07))
    objects.append(arch("Ruined aqueduct open vault", 3.6, 1.65, .66, (1.2,-1.0,-1.32), materials["ivory"], .22, 10))
    for i, length in enumerate((1.3,.8,1.7)):
        objects.append(box("Ruined aqueduct broken parapet",(-.4+i*2.0,-.63,.70),(length,.15,.48),materials["ivory"],.025))
    for i in range(7 if detail == "high" else 4):
        rubble = box("Fallen carved masonry", (-3.1+i*.83,-2.0 + math.sin(i*2.1)*.45,.22), (.6,.45,.33), materials["stone"], .025)
        rubble.rotation_euler.z = i * .71
        objects.append(rubble)
    objects += generate_tree(materials, variant="sanctuary-sakura", detail="low", origin=(-3.6,-.8,.06), scale=.82, form="umbrella")
    objects += generate_shrub(materials, detail="low", origin=(3.3,1.3,.06), scale=1.0)
    objects += pine(materials, -4.2, 2.4, .7, detail)
    return objects


def hamlet(materials, detail):
    objects = landform(materials, "hamlet", detail)
    # A mill, cottage and bakery face a shared stream-side promenade.
    sites = [(-3.9, .7, "cafe", .84), (0, 1.2, "boutique", .95), (3.7,.6,"cottage",.82)]
    for x,y,variant,size in sites:
        objects += generate_house(materials, variant=variant, detail="high" if detail == "high" else "low", origin=(x,y,.07), scale=size, rotation=.10*x)
    # Mill wheel has real open spokes and a wooden outer rim.
    center = (-3.2,-.65,1.04)
    count = 20 if detail == "high" else 12
    circle = [(center[0]+math.cos(a)*.88, center[1], center[2]+math.sin(a)*.88)
              for a in [i*math.tau/count for i in range(count+1)]]
    objects.append(tube("Hamlet mill wheel rim", circle, .10, materials["wood"], sides=4))
    for i in range(8):
        angle = i*math.tau/8
        objects.append(tube("Hamlet mill wheel spoke", [center,(center[0]+math.cos(angle)*.84,center[1],center[2]+math.sin(angle)*.84)], .045, materials["wood"], sides=4))
    objects += generate_tree(materials, variant="millstream-sakura", detail="low", origin=(5.2,-.8,.06), scale=.73, form="upright")
    for x,y,size in ((-5.8,1.5,.75),(1.7,2.0,.85),(6.2,1.4,.66)):
        objects += pine(materials,x,y,size,detail)
    channel = [(-2.8,-.1,.13),(-2.4,-1.5,.12),(-1.4,-2.6,.10),(-.5,-3.6,.08)]
    objects.append(_path("Hamlet millstream carved bed",channel,[.85,.95,1.15,1.4],materials["stone"]))
    for i, point in enumerate(channel):
        objects.append(_empty(f"watercourse_{i}_left",point,semantic="watercourse_route"))
    objects.append(_empty("waterfall_origin_left", channel[-1], width=1.4, semantic="waterfall_source"))
    objects.append(_empty("waterfall_end_left",(-.6,-4.2,-10.2),semantic="waterfall_end"))
    return objects


def main():
    records = []
    materials = make_materials()
    for kind, builder in (("observatory",observatory),("ruins",ruins),("hamlet",hamlet)):
        for detail in ("high","balanced","low"):
            reset_scene()
            objects = builder(materials,detail)
            asset_id = f"sky-{kind}"
            suffix = "" if detail == "high" else f"-{detail}"
            record = export_glb(objects,DESTINATION/f"{asset_id}{suffix}.glb",asset_id,detail,SEED,
                                {"role":"supporting-floating-island","original_authoring":"Blender Python"})
            records.append(record)
            print(f"ASSET {record['file']} {record['triangles']} triangles {record['bytes']} bytes",flush=True)
    manifest = {"schemaVersion":1,"generator":"tools/blender/generate_archipelago.py",
                "blenderVersion":bpy.app.version_string,"seed":SEED,
                "license":"Original procedural project assets; repository MIT license applies",
                "materials":"existing shared embedded 128x128 surface atlas","assets":records}
    (DESTINATION/"archipelago-manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")


if __name__ == "__main__":
    main()

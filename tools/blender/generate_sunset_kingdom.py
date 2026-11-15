"""Original concept-directed scenery; no external meshes or reference-image texture.

Run with Blender --background --factory-startup --python-exit-code 1 --python
tools/blender/generate_sunset_kingdom.py. Writes only the sunset-manifest assets.
Z-up authoring, Y-up GLB, metres. Shared atlas, opaque materials, three real LODs.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from core import box, lathe, mesh, tube, arch, make_materials, reset_scene, transform_objects
from export_assets import export_glb
from generate_floating_islands import _surface, _rock_shard, _tint, _path, _empty
from generate_castles import generate_castle, _tower, _gable_roof, _window
from generate_vegetation import _cluster
from generate_lanterns import generate_lantern
from generate_villages import generate_house
from generate_bridges import generate_bridge
from generate_archipelago import landform, pine

OUT = HERE.parents[1] / "public/assets/models/environment"
SEED = 10425058


def flowerbed(materials, origin, radius=1, detail="balanced", seed=0):
    rng = random.Random(SEED + seed)
    objects = []
    count = 16 if detail == "high" else 10 if detail == "balanced" else 5
    for i in range(count):
        angle = rng.random() * math.tau
        r = math.sqrt(rng.random()) * radius
        x, y, z = origin[0] + math.cos(angle)*r, origin[1] + math.sin(angle)*r*.52, origin[2]
        objects.append(_cluster("Flowerbed rounded leaves", (x,y,z+.10), (.27,.22,.14), materials["grass"], "low", i%3))
        # Open five-petal rosettes, each just ten triangles, with a gold stamen.
        vertices, faces = [], []
        for j in range(5):
            a = j*math.tau/5
            vertices.extend([(x,y,z+.22),(x+math.cos(a-.42)*.13,y+math.sin(a-.42)*.13,z+.19),
                             (x+math.cos(a)*.22,y+math.sin(a)*.22,z+.25),
                             (x+math.cos(a+.42)*.13,y+math.sin(a+.42)*.13,z+.19)])
            n = j*4
            faces.extend([(n,n+1,n+2),(n,n+2,n+3)])
        objects.append(mesh("Garden five-petal flower",vertices,faces,materials["ivory" if i%3==0 else "blossom"]))
        objects.append(_cluster("Flower gold heart",(x,y,z+.24),(.065,.065,.05),materials["window"],"low"))
    return objects


def sakura(materials, origin, scale, detail, seed=0):
    """Fine scalloped canopy, visible curved branches and pink/white crown tips."""
    rng = random.Random(SEED + seed)
    objects = [tube("Sakura sculpted trunk",[(0,0,0),(.13,.05,.8),(-.08,.10,1.6),(.17,.03,2.45)],
                    [.23,.19,.13,.035],materials["wood"],sides=5)]
    count = 9 if detail == "high" else 7 if detail == "balanced" else 5
    for i in range(count):
        a = i*2.399963+.2
        r = 1.45 if i < count-2 else .65
        tip = (math.cos(a)*r,math.sin(a)*r*.85,2.55+rng.random()*.65+(0 if r>1 else .5))
        objects.append(tube("Sakura upward flowering branch",[(.03,.08,1.3),(tip[0]*.5,tip[1]*.5,tip[2]-.7),tip],
                            [.10,.07,.015],materials["wood"],sides=4))
        for j in range(6 if detail == "high" else 4 if detail == "balanced" else 3):
            b = j*2.399963+a
            size = rng.uniform(.35,.57)
            point = (tip[0]+math.cos(b)*.42,tip[1]+math.sin(b)*.38,tip[2]+rng.uniform(-.1,.35))
            objects.append(_cluster("Sakura scalloped blossom spray",point,(size,size*.92,size*.73),
                                    materials["blossom"],"low",(i+j)%3,b))
    return transform_objects(objects,origin,scale)


def ivy(materials, rx, ry, detail, square=False, top=-.12, density=1):
    rng = random.Random(SEED + 790)
    objects = []
    count = int((42 if detail == "high" else 28 if detail == "balanced" else 14)*density)
    for i in range(count):
        a = i*2.399963+.15
        x,y = math.cos(a)*rx,math.sin(a)*ry
        if square:
            div = max(abs(math.cos(a)),abs(math.sin(a)))
            x,y = x/div,y/div
        length = rng.uniform(1.6,4.8)
        points = [(x,y,top),(x*1.012,y*1.012,top-.7),(x*.985+.16,y*.985,top-length)]
        objects.append(tube("Trailing garden vine",points,[.06,.045,.009],materials["leaf"],sides=3))
        leaves = 9 if detail == "high" else 7 if detail == "balanced" else 4
        for j in range(leaves):
            t = (j+1)/(leaves+1)
            p = Vector(points[1]).lerp(Vector(points[2]),t)
            side = 1 if j%2 else -1
            leaf = mesh("Ivy heart leaf",[(0,0,0),(side*.28,-.06,-.04),(side*.36,.06,-.14),(side*.08,.16,-.27)],
                        [(0,1,2),(0,2,3)],materials["grass"],p)
            leaf.rotation_euler.z = a
            objects.append(leaf)
            if j%4==0:
                objects.append(_cluster("Trailing golden bloom",p,(.09,.09,.13),materials["window"],"low"))
    return objects


def foundation(materials, detail):
    """Square-rooted cliff fits underneath the unchanged 25.2m board chassis."""
    rng = random.Random(SEED)
    count = 48 if detail == "high" else 32 if detail == "balanced" else 24
    rings = []
    for level,(extent,z) in enumerate(((12.56,-1.95),(12.65,-2.35),(11.6,-3.6),(9.3,-6.4),(5.9,-9.1),(1.4,-11.2))):
        ring=[]
        for i in range(count):
            a=i*math.tau/count
            div=max(abs(math.cos(a)),abs(math.sin(a)))
            jitter=1 if level==0 else 1+rng.uniform(-.06,.06)
            ring.append((math.cos(a)/div*extent*jitter,math.sin(a)/div*extent*jitter,
                         z+(rng.uniform(-.35,.35) if level else 0)))
        rings.append(ring)
    objects=[_tint(_surface("Crown island fractured foundation",rings,materials["rock"],cap_bottom=True),"rock")]
    for i in range(14 if detail!="low" else 8):
        a=i*2.399963
        div=max(abs(math.cos(a)),abs(math.sin(a)))
        x,y=math.cos(a)/div*11.4,math.sin(a)/div*11.4
        objects.append(_tint(_rock_shard("Crown hanging basalt buttress",x,y,-2.4,rng.uniform(.8,1.6),rng.uniform(3.3,7.2),materials["rock"],rng,detail),"rock"))
    # Small heraldic panels wrap all four edges and remain below tile level.
    for side in range(4):
        decoration=[]
        for x in (-8.1,0,8.1):
            decoration.append(box("Crown carved stone edge corbel",(x,-12.67,-1.35),(1.65,.20,.63),materials["stone"],.05))
            decoration.append(box("Crown gilded edge moulding",(x,-12.80,-1.05),(1.80,.08,.08),materials["gold"],.01))
        for x in (-6,6):
            contour=[(x-.53,-12.85,-.62),(x+.53,-12.85,-.62),(x+.48,-12.90,-2.45),(x,-12.94,-3.03),(x-.48,-12.90,-2.45)]
            decoration.append(mesh("Royal hanging blue banner",contour,[(4,3,2,1,0)],materials["blue"]))
            decoration.append(tube("Banner gold embroidered border",contour[1:]+contour[:1],.026,materials["gold"],sides=3))
            crown=[(x-.24,-12.96,-1.68),(x-.29,-12.96,-1.22),(x-.10,-12.96,-1.42),(x,-12.96,-1.09),(x+.10,-12.96,-1.42),(x+.29,-12.96,-1.22),(x+.24,-12.96,-1.68)]
            decoration.append(mesh("Banner raised golden crown",crown,[tuple(reversed(range(7)))],materials["gold"]))
        objects += transform_objects(decoration,rotation=side*math.pi/2)
    objects += ivy(materials,12.68,12.68,detail,square=True,top=-.68)
    return objects


def citadel(materials, detail):
    # The two castles already shipped keep their bytes. This is a taller skyline
    # landmark with a different footprint, secondary spires and formal gardens.
    objects=landform(materials,"ruins",detail)
    objects += generate_castle(materials,variant="left",detail=detail,origin=(-.2,1,.2),scale=1.1)
    for x,y,h,r in ((-3.8,2.4,5.9,.62),(3.5,2.0,6.9,.65),(.7,3.0,8.6,.60)):
        objects += _tower(materials,(x,y,.12),r,h,2.0,detail,"Citadel slender skyline spire")
    for i in range(5):
        objects.append(box("Citadel broad processional stair",(0,-2.5-i*.29,.28-i*.055),(3.3+i*.25,.40,.16),materials["stone"],.025))
    for side in (-1,1):
        objects += sakura(materials,(side*4.6,-.6,.08),.92,detail,13+side)
        objects += flowerbed(materials,(side*3.7,-2.2,.09),1.35,detail,side+8)
        objects += pine(materials,side*4.9,2.8,.84,detail)
        objects += generate_lantern(materials,detail,origin=(side*1.95,-3.3,.1),scale=.65)
    objects += ivy(materials,5.8,4.7,detail)
    # A real open-span sky bridge joins a little lookout crag to the kingdom.
    objects += generate_bridge(materials,detail,origin=(7.4,-.9,-1.6),scale=.82,rotation=.10,length=5.6)
    rings=[]
    for r,z in ((1,-.24),(.96,-1.1),(.54,-3.5),(.04,-5.0)):
        rings.append([(10.3+math.cos(i*math.tau/10)*2.0*r,-.5+math.sin(i*math.tau/10)*1.9*r,z) for i in range(10)])
    objects.append(_tint(_surface("Citadel lookout suspended crag",rings,materials["rock"],cap_bottom=True),"rock"))
    objects.append(mesh("Citadel lookout meadow",rings[0],[tuple(range(10))],materials["grass"]))
    objects += pine(materials,10.8,.1,.65,detail)
    objects += generate_lantern(materials,detail,origin=(10.1,-1.1,-.2),scale=.6)
    channel=[(-2.4,-1.4,.13),(-2.5,-2.4,.13),(-2.7,-3.6,.10),(-3.1,-4.65,.08)]
    objects.append(_path("Citadel spring carved channel",channel,[1.15,1.45,1.9,2.3],materials["stone"]))
    for i,p in enumerate(channel): objects.append(_empty(f"watercourse_{i}_left",p,semantic="watercourse_route"))
    objects += [_empty("waterfall_origin_left",channel[-1],width=2.3,semantic="waterfall_source"),
                _empty("waterfall_end_left",(-3.6,-5.7,-15.5),semantic="waterfall_end")]
    return objects


def royal_gardens(materials, detail):
    """Small gardens dress existing royal GLBs without regenerating them."""
    objects=[]
    for i,(x,y) in enumerate(((-.8,-4.5),(1.8,-4.3),(-6.7,.5),(5.7,1.2),(-3.9,3.8))):
        objects += flowerbed(materials,(x,y,.10),.90,detail,100+i)
    for x,y in ((-6.9,2.9),(5.7,3.8)):
        objects += pine(materials,x,y,.65,detail)
    # Pebble-edged clipped hedges lead the eye toward the castle entrance.
    for side in (-1,1):
        for i in range(6 if detail!="low" else 3):
            x,y=side*(1.1+i*.35),-3.6+i*.06
            objects.append(_cluster("Royal garden clipped hedge",(x,y,.25),(.31,.26,.22),materials["leaf"],"low"))
        objects += generate_lantern(materials,detail,origin=(side*2.3,-4.3,.1),scale=.65)
    return objects


def windmill(materials, detail):
    objects=landform(materials,"hamlet",detail)
    objects.append(lathe("Windmill tapered ivory tower",[(1.25,.1),(1.16,.4),(.82,4.1),(.93,4.2)],16 if detail=="high" else 10,materials["ivory"],(-1,1,0)))
    objects += _gable_roof(materials,2.35,2.2,1.35,(-1,1,4.15),"Mill royal slate roof")
    objects += _window(materials,(-1,-.06,1.2),.47,1.02,detail=detail)
    objects += _window(materials,(-1,.06,2.8),.37,.70,detail=detail)
    # Four open lattice sails, clearly modelled from front and rear angles.
    for i in range(4):
        a=i*math.pi/2+.60
        points=[(-1+math.cos(a)*r,-.34,3.65+math.sin(a)*r) for r in (.2,3.1)]
        objects.append(tube("Windmill sail radial spar",points,.07,materials["wood"],sides=4))
        for j in range(6 if detail!="low" else 4):
            r=1.0+j*.37
            p=(-1+math.cos(a)*r,-.35,3.65+math.sin(a)*r)
            sail=box("Windmill ivory lattice sail",p,(.29,.075,.70),materials["ivory"],0)
            sail.rotation_euler.y=math.pi/2-a
            objects.append(sail)
    objects.append(lathe("Windmill golden hub",[(.18,0),(.18,.18)],10,materials["gold"],(-1,-.37,3.65)))
    for x,y,size in ((-4.2,.65,.88),(3.0,.7,.95)):
        objects += generate_house(materials,"cottage",detail,origin=(x,y,.1),scale=size)
    objects += sakura(materials,(5.3,-.6,.08),.8,detail,21)
    objects += pine(materials,-5.7,1.6,.85,detail)
    objects += flowerbed(materials,(2.6,-1.9,.1),1.8,detail,30)
    objects += ivy(materials,7.2,3.7,detail)
    channel=[(-1.8,-.8,.13),(-1.3,-1.9,.12),(.0,-2.8,.11),(1,-3.6,.09)]
    objects.append(_path("Windmill spring channel",channel,[1.0,1.2,1.5,1.9],materials["stone"]))
    for i,p in enumerate(channel): objects.append(_empty(f"watercourse_{i}_left",p,semantic="watercourse_route"))
    objects += [_empty("waterfall_origin_left",channel[-1],width=1.9,semantic="waterfall_source"),
                _empty("waterfall_end_left",(1.4,-4.8,-12.5),semantic="waterfall_end")]
    return objects


def garden(materials, detail):
    objects=landform(materials,"observatory",detail)
    # Open marble belvedere, terraced stair and a foreground blossom grove.
    for x in (-2.9,0,2.9):
        objects.append(arch("Garden open belvedere arch",2.3,3.9,.40,(x,1.4,.15),materials["ivory"],.20,10 if detail!="low" else 6))
        objects.append(box("Garden carved column capital",(x+1.3,1.4,3.02),(.58,.60,.22),materials["stone"],.035))
    for i in range(5):
        objects.append(box("Garden descending marble stair",(.4,-1.0-i*.39,.12-i*.045),(3.0,.48,.16),materials["stone"],.03))
    for x,y,size,seed in ((-3.8,-1.4,1.25,51),(3.4,-.9,.96,52),(-2.2,2.5,.7,53)):
        objects += sakura(materials,(x,y,.1),size,detail,seed)
    for x,y,seed in ((-3.2,-2.5,71),(2.9,-2.3,72),(3.7,1.8,73)):
        objects += flowerbed(materials,(x,y,.12),1.2,detail,seed)
    for x in (-1.7,1.9): objects += generate_lantern(materials,detail,origin=(x,-2.7,.05),scale=.8)
    objects += ivy(materials,5.5,4.5,detail,density=.8)
    channel=[(1.8,-1.4,.15),(2.2,-2.3,.12),(2.7,-3.5,.10),(3.2,-4.25,.08)]
    objects.append(_path("Garden cascade source basin",channel,[1.1,1.4,1.9,2.25],materials["stone"]))
    for i,p in enumerate(channel): objects.append(_empty(f"watercourse_{i}_left",p,semantic="watercourse_route"))
    objects += [_empty("waterfall_origin_left",channel[-1],width=2.25,semantic="waterfall_source"),
                _empty("waterfall_end_left",(4.0,-5.5,-13),semantic="waterfall_end")]
    return objects


def vertex_occlusion(objects):
    """Bake short-range cavity shading into COLOR_0, no realtime shadow casters.

    Six fixed world-space hemisphere rays per vertex. AO respects mesh normals
    and surfaces, rather than painting arbitrary dark bands on the scenery.
    """
    bpy.context.view_layer.update()
    graph=bpy.context.evaluated_depsgraph_get()
    vertices,faces=[],[]
    for obj in objects:
        if obj.type!="MESH": continue
        evaluated=obj.evaluated_get(graph)
        data=evaluated.to_mesh()
        offset=len(vertices)
        vertices.extend(obj.matrix_world@v.co for v in data.vertices)
        faces.extend(tuple(offset+i for i in p.vertices) for p in data.polygons)
        evaluated.to_mesh_clear()
    tree=BVHTree.FromPolygons(vertices,faces)
    directions=[Vector(d).normalized() for d in ((.7,.2,1),(-.7,.2,1),(.1,.8,1),(.1,-.8,1),(.6,-.6,.5),(-.6,.6,.5))]
    for obj in objects:
        if obj.type!="MESH": continue
        # Canopy sources are shared. Copy once before per-placement occlusion.
        if obj.data.users>1: obj.data=obj.data.copy()
        data=obj.data
        color=data.color_attributes.get("Color") or data.color_attributes.new(name="Color",type="BYTE_COLOR",domain="CORNER")
        if not any(color.data[0].color[:3]):
            color.data.foreach_set("color",[1.,1.,1.,1.]*len(color.data))
        normal_matrix=obj.matrix_world.to_3x3().inverted().transposed()
        occlusion=[]
        for v in data.vertices:
            n=(normal_matrix@v.normal).normalized()
            p=obj.matrix_world@v.co+n*.055
            rays=[d for d in directions if d.dot(n)>.10]
            hits=sum(tree.ray_cast(p,d,1.8)[0] is not None for d in rays)
            occlusion.append(1-.43*hits/max(1,len(rays)))
        for poly in data.polygons:
            for loop in poly.loop_indices:
                previous=color.data[loop].color
                ao=occlusion[data.loops[loop].vertex_index]
                # Blossoms scatter light through the canopy. Cavity shading
                # on overlapping opaque lobes otherwise turns pink into plum.
                if data.materials[0].name=="Sakura blossom clusters": ao=1-(1-ao)*.12
                color.data[loop].color=tuple(c*ao for c in previous[:3])+(1,)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only",help="comma-separated asset IDs; preserve all other exports")
    parser.add_argument("--tiers",default="high,balanced,low")
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    selected=set(args.only.split(",")) if args.only else None
    tiers=args.tiers.split(",")
    if not set(tiers)<={"high","balanced","low"}: raise ValueError("Unknown tier")
    if selected and not selected<={"crown-foundation","royal-garden-dressing","royal-island-citadel","sky-windmill","sky-garden"}: raise ValueError("Unknown asset")
    materials=make_materials()
    materials["gold"].node_tree.nodes.get("Principled BSDF").inputs["Metallic"].default_value=.38
    materials["window"].node_tree.nodes.get("Principled BSDF").inputs["Emission Strength"].default_value=3.8
    # All surfaces use their baked cavity colours, with the original atlas UVs.
    for material in set(materials.values()):
        nodes=material.node_tree.nodes
        shader=nodes.get("Principled BSDF")
        if shader.inputs["Base Color"].links[0].from_node.type=="TEX_IMAGE":
            texture=shader.inputs["Base Color"].links[0].from_node
            tint=nodes.new("ShaderNodeVertexColor");tint.layer_name="Color"
            multiply=nodes.new("ShaderNodeMixRGB");multiply.blend_type="MULTIPLY";multiply.inputs[0].default_value=1
            material.node_tree.links.new(texture.outputs["Color"],multiply.inputs[1])
            material.node_tree.links.new(tint.outputs["Color"],multiply.inputs[2])
            material.node_tree.links.new(multiply.outputs[0],shader.inputs["Base Color"])
    records=[]
    for asset_id,builder in (("crown-foundation",foundation),("royal-garden-dressing",royal_gardens),("royal-island-citadel",citadel),("sky-windmill",windmill),("sky-garden",garden)):
        if selected and asset_id not in selected: continue
        for detail in tiers:
            reset_scene()
            objects=builder(materials,detail)
            vertex_occlusion(objects)
            # Explicit runtime light-halo anchors survive material batching.
            # No actual point lights are exported or created in the browser.
            lamps=[obj for obj in objects if obj.type=="MESH" and "warm glass chamber" in obj.name.lower()]
            for i,lamp in enumerate(lamps):
                objects.append(_empty(f"sunset_glow_{i}",lamp.matrix_world.translation,
                                      radius=.48,semantic="lantern_halo"))
            if asset_id=="royal-island-citadel":
                objects.append(_empty("sunset_glow_portal",(-.2,-.64,1.55),radius=1.25,semantic="portal_halo"))
            suffix="" if detail=="high" else f"-{detail}"
            record=export_glb(objects,OUT/f"{asset_id}{suffix}.glb",asset_id,detail,SEED,
                              {"role":"sunset-kingdom-scenery","bakedOcclusion":"six-ray vertex cavity shading"})
            records.append(record)
            print(f"ASSET {record['file']} {record['triangles']} triangles {record['bytes']} bytes",flush=True)
    manifest={"schemaVersion":1,"generator":"tools/blender/generate_sunset_kingdom.py","blenderVersion":bpy.app.version_string,
              "seed":SEED,"license":"Original procedural project assets; repository MIT license applies",
              "materials":"embedded 128x128 atlas, vertex cavity shading, opaque PBR","assets":records}
    path=OUT/"sunset-manifest.json"
    if path.is_file() and (selected or set(tiers)!={"high","balanced","low"}):
        existing={asset["file"]:asset for asset in json.loads(path.read_text(encoding="utf-8"))["assets"]}
        existing.update({asset["file"]:asset for asset in records});manifest["assets"]=list(existing.values())
    path.write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")


if __name__=="__main__": main()

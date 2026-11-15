"""Refine the existing authored hero assets, preserving their architecture.

Blender imports the project's original GLBs, applies their transforms, reshapes
only below-grade cliff geometry, adds eroded strata, and rebakes cavity colours.
The deployed game needs only the new GLBs. Original source bytes stay unchanged.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import random
import sys

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import bpy
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
from core import make_materials,reset_scene,box
from export_assets import export_glb
from generate_floating_islands import _surface,_tint

OUT=HERE.parents[1]/"public/assets/models/environment"
SEED=10425058
ASSETS=["royal-island-left","royal-island-right","royal-island-citadel","crown-foundation"]


def import_original(path,materials):
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(path),import_shading="NORMALS")
    bpy.context.view_layer.update()
    for obj in list(bpy.context.scene.objects):
        world=obj.matrix_world.copy()
        obj.parent=None
        if obj.type=="MESH":
            obj.data.transform(world);obj.matrix_world=Matrix.Identity(4)
        else:obj.matrix_world=world
    # Material separation makes the existing UVs/colours addressable without
    # reconstructing good castles, roof modules, trees or landmark layouts.
    for obj in list(bpy.context.scene.objects):
        if obj.type!="MESH":continue
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True);bpy.context.view_layer.objects.active=obj
        bpy.ops.object.mode_set(mode="EDIT");bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.separate(type="MATERIAL");bpy.ops.object.mode_set(mode="OBJECT")
    canonical={material.name:material for material in set(materials.values())}
    objects=list(bpy.context.scene.objects)
    for obj in objects:
        if obj.type!="MESH":continue
        old=next(material for material in obj.data.materials if material)
        key=next((name for name in canonical if old.name.startswith(name)),None)
        if not key:raise ValueError(f"Unknown project material: {old.name}")
        obj.data.materials.clear();obj.data.materials.append(canonical[key])
        for poly in obj.data.polygons:poly.material_index=0
        color=obj.data.color_attributes.active_color
        if color:color.name="Color"
        else:
            color=obj.data.color_attributes.new(name="Color",type="BYTE_COLOR",domain="CORNER")
            color.data.foreach_set("color",[1.,1.,1.,1.]*len(color.data))
        obj.data.color_attributes.active_color=color
    return objects


def eroded_landform(objects,materials,asset_id,tier):
    rng=random.Random(SEED+sum(map(ord,asset_id)))
    foundation=asset_id=="crown-foundation"
    grade=-2.05 if foundation else -.34
    for obj in objects:
        if obj.type!="MESH" or obj.data.materials[0]!=materials["rock"]:continue
        data=obj.data
        for vertex in data.vertices:
            p=vertex.co
            if p.z>=grade:continue
            angle=math.atan2(p.y,p.x)
            depth=min(1,(grade-p.z)/10)
            swell=1+depth*(.18+.055*math.sin(angle*3+.6))
            p.x=p.x*swell+math.sin(angle*2+.7)*depth*.28
            p.y=p.y*swell+math.cos(angle*3-.3)*depth*.22
            p.z=grade+(p.z-grade)*(.69+.055*math.sin(angle*2+.9))
        data.normals_split_custom_set([(0,0,0)]*len(data.loops))
        for poly in data.polygons:poly.use_smooth=False
        data.update()
    # Broad, offset strata replace the long repeated stalactite silhouette.
    count=12 if tier=="high" else 9 if tier=="balanced" else 6
    for i in range(count):
        angle=i*2.399963+.17
        if foundation:
            div=max(abs(math.cos(angle)),abs(math.sin(angle)))
            x,y=math.cos(angle)/div*11.6,math.sin(angle)/div*11.6
        else:
            footprint={"royal-island-left":(8.8,5.7),"royal-island-right":(7.8,6.7),"royal-island-citadel":(6.2,4.9)}[asset_id]
            x,y=math.cos(angle)*footprint[0]*.76,math.sin(angle)*footprint[1]*.76
        width=rng.uniform(1.2,2.3);depth=rng.uniform(.75,1.25)
        z=grade-rng.uniform(.35,1.6)
        top=[];bottom=[]
        for j in range(7):
            a=j*math.tau/7
            px=math.cos(a)*width*(1+rng.uniform(-.12,.12))
            py=math.sin(a)*depth
            c,s=math.cos(angle+math.pi/2),math.sin(angle+math.pi/2)
            top.append((x+px*c-py*s,y+px*s+py*c,z+rng.uniform(-.10,.10)))
            bottom.append((x+(px*c-py*s)*.81,y+(px*s+py*c)*.81,z-.55-rng.random()*.20))
        objects.append(_tint(_surface("V2 eroded limestone stratum",[top,bottom],materials["rock"],cap_top=True,cap_bottom=True),"rock",i))
        # A smaller warm stone seam articulates the grass-to-rock transition.
        if i%2==0:
            seam=box("V2 weathered cliff seam",(x,y,z+.04),(width*1.1,.15,.12),materials["stone"],.025)
            seam.rotation_euler.z=angle+math.pi/2;objects.append(seam)
    # Reduce hidden microgeometry, preserving all ivory/blue architecture.
    for obj in objects:
        if obj.type!="MESH":continue
        material=obj.data.materials[0]
        ratio=.76 if material in (materials["rock"],materials["leaf"],materials["grass"]) else .86 if material in (materials["gold"],materials["wood"],materials["blossom"]) else 1
        if ratio<1 and len(obj.data.polygons)>70:
            modifier=obj.modifiers.new("V2 hidden detail simplification","DECIMATE")
            modifier.ratio=ratio;modifier.use_collapse_triangulate=True
    return objects


def cavity_shading(objects,materials):
    bpy.context.view_layer.update()
    graph=bpy.context.evaluated_depsgraph_get();vertices=[];faces=[]
    for obj in objects:
        if obj.type!="MESH":continue
        evaluated=obj.evaluated_get(graph);data=evaluated.to_mesh();offset=len(vertices)
        vertices.extend(obj.matrix_world@v.co for v in data.vertices)
        faces.extend(tuple(offset+i for i in p.vertices) for p in data.polygons)
        evaluated.to_mesh_clear()
    tree=BVHTree.FromPolygons(vertices,faces)
    rays=[Vector(d).normalized() for d in ((.65,.2,1),(-.65,.2,1),(0,.8,1),(0,-.8,1),(.6,-.5,.45),(-.6,.5,.45))]
    for obj in objects:
        if obj.type!="MESH":continue
        data=obj.data;material=data.materials[0]
        color=data.color_attributes.get("Color")
        if not color:
            color=data.color_attributes.new(name="Color",type="BYTE_COLOR",domain="CORNER")
            color.data.foreach_set("color",[1.,1.,1.,1.]*len(color.data))
        data.color_attributes.active_color=color
        strength=.04 if material==materials["blossom"] else .22 if material in (materials["rock"],materials["grass"]) else .38
        values=[]
        for vertex in data.vertices:
            n=vertex.normal.normalized();p=vertex.co+n*.045
            directions=[d for d in rays if d.dot(n)>.12]
            hits=sum(tree.ray_cast(p,d,1.5)[0] is not None for d in directions)
            values.append(1-strength*hits/max(1,len(directions)))
        for poly in data.polygons:
            for loop in poly.loop_indices:
                original=color.data[loop].color
                shade=values[data.loops[loop].vertex_index]
                color.data[loop].color=tuple(c*shade for c in original[:3])+(1,)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only",default=",".join(ASSETS));parser.add_argument("--tiers",default="high,balanced,low")
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    selected=args.only.split(",");tiers=args.tiers.split(",")
    if not set(selected)<=set(ASSETS) or not set(tiers)<={"high","balanced","low"}:raise ValueError("Unknown asset or tier")
    reset_scene();materials=make_materials()
    materials["gold"].node_tree.nodes.get("Principled BSDF").inputs["Metallic"].default_value=.38
    materials["window"].node_tree.nodes.get("Principled BSDF").inputs["Emission Strength"].default_value=2.4
    records=[]
    for original_id in selected:
        for tier in tiers:
            suffix="" if tier=="high" else f"-{tier}"
            source=OUT/f"{original_id}{suffix}.glb"
            objects=eroded_landform(import_original(source,materials),materials,original_id,tier)
            cavity_shading(objects,materials)
            asset_id=f"{original_id}-v2"
            record=export_glb(objects,OUT/f"{asset_id}{suffix}.glb",asset_id,tier,SEED,
                {"role":"refined-original-scenery","sourceFile":source.name,"sourceSha256":hashlib.sha256(source.read_bytes()).hexdigest()})
            record.update({"sourceFile":source.name,"sourceSha256":hashlib.sha256(source.read_bytes()).hexdigest()})
            records.append(record)
            print(f"REFINED {record['file']} {record['triangles']} triangles {record['bytes']} bytes",flush=True)
    path=OUT/"polish-v2-manifest.json"
    if path.is_file():
        previous={a["file"]:a for a in json.loads(path.read_text(encoding="utf-8"))["assets"]}
        previous.update({a["file"]:a for a in records});records=list(previous.values())
    manifest={"schemaVersion":1,"generator":"tools/blender/polish_environment_v2.py","blenderVersion":bpy.app.version_string,
      "seed":SEED,"license":"Refinements of original project MIT assets; original bytes preserved",
      "materials":"shared embedded atlas, normalized UVs, refined cliff normals and baked cavity colours","assets":records}
    path.write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")


if __name__=="__main__":main()

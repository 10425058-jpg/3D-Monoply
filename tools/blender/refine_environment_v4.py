"""Refine the existing V2 kingdom exports; no runtime Blender dependency.

Source GLBs remain immutable. V4 adds restrained architectural details, organic
blossom variation, eroded turf/cliff transitions and baked directional contact
shadows. The shared project atlas keeps each material a single runtime batch.
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
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from core import make_materials,reset_scene,box,mesh,arch,arch_panel,transform_objects,uv_project
from export_assets import export_glb
from polish_environment_v2 import import_original

OUT=HERE.parents[1]/"public/assets/models/environment"
ASSETS=["royal-island-left","royal-island-right","royal-island-citadel","crown-foundation"]
SEED=10425058
SUN=Vector((-.48,-.56,.72)).normalized() # Runtime Y-up [-.48,.72,.56].


def connected_components(data):
    """Recover authored leaf masses even across exported UV/normal seams."""
    parent=list(range(len(data.vertices)))
    def find(index):
        while parent[index]!=index:
            parent[index]=parent[parent[index]];index=parent[index]
        return index
    def union(a,b):
        a,b=find(a),find(b)
        if a!=b:parent[b]=a
    positions={}
    for vertex in data.vertices:
        key=tuple(round(value,5) for value in vertex.co)
        if key in positions:union(vertex.index,positions[key])
        else:positions[key]=vertex.index
    for polygon in data.polygons:
        first=polygon.vertices[0]
        for index in polygon.vertices[1:]:union(first,index)
    result={}
    for vertex in data.vertices:result.setdefault(find(vertex.index),[]).append(vertex.index)
    return list(result.values())


def organic_canopies(objects,materials,tier,rng):
    blossoms=[]
    for obj in objects:
        if obj.type!="MESH" or obj.data.materials[0]!=materials["blossom"]:continue
        data=obj.data;color=data.color_attributes.get("Color")
        component_tints={}
        for indices in connected_components(data):
            vertices=[data.vertices[index] for index in indices]
            lo=Vector(tuple(min(v.co[axis] for v in vertices) for axis in range(3)))
            hi=Vector(tuple(max(v.co[axis] for v in vertices) for axis in range(3)))
            center=(lo+hi)*.5;extent=hi-lo
            if center.z<.8 or max(extent.x,extent.y)<.35 or extent.z<.18:continue
            phase=rng.uniform(0,math.tau)
            sx,sy,sz=rng.uniform(.90,1.09),rng.uniform(.87,1.08),rng.uniform(.72,.94)
            for vertex in vertices:
                local=vertex.co-center
                angle=math.atan2(local.y,local.x)
                ripple=1+.075*math.sin(angle*3+phase)+.035*math.sin(angle*5-phase)
                vertex.co=center+Vector((local.x*sx*ripple,local.y*sy*ripple,local.z*sz))
                component_tints[vertex.index]=(rng.uniform(.98,1.04),rng.uniform(.88,1.00),rng.uniform(.93,1.02))
            blossoms.append((center,extent,phase))
        if color:
            for loop in data.loops:
                tint=component_tints.get(loop.vertex_index)
                if tint:
                    old=color.data[loop.index].color
                    color.data[loop.index].color=tuple(min(1,old[i]*tint[i]) for i in range(3))+(1,)
        data.normals_split_custom_set([(0,0,0)]*len(data.loops));data.update()
    # Visible five-petal accents articulate the canopy without another material
    # or draw. Their asymmetric fans read as foliage, rather than sphere lobes.
    count={"high":22,"balanced":14,"low":8}[tier]
    for center,extent,phase in sorted(blossoms,key=lambda entry:entry[1].length,reverse=True)[:count]:
        radius=min(.16,max(.085,extent.x*.12));z=center.z+extent.z*.34
        vertices=[];faces=[]
        for petal in range(5):
            a=phase+petal*math.tau/5
            origin=len(vertices)
            for r,offset,dz in ((0,0,0),(radius*.83,-.43,.018),(radius*1.6,0,.035),(radius*.83,.43,.018)):
                vertices.append((center.x+math.cos(a+offset)*r,center.y+math.sin(a+offset)*r,z+dz))
            faces.extend([(origin,origin+1,origin+2),(origin,origin+2,origin+3)])
        objects.append(mesh("V4 sculpted five-petal canopy accent",vertices,faces,materials["blossom"]))


def sculpt_edges(objects,materials,asset_id):
    foundation=asset_id=="crown-foundation"
    rx,ry={"royal-island-left":(8.8,5.7),"royal-island-right":(7.8,6.7),
           "royal-island-citadel":(5.8,4.7),"crown-foundation":(12,12)}[asset_id]
    for obj in objects:
        if obj.type!="MESH":continue
        data=obj.data;material=data.materials[0]
        if material not in (materials["grass"],materials["rock"]):continue
        for vertex in data.vertices:
            p=vertex.co
            radial=math.hypot(p.x/rx,p.y/ry);angle=math.atan2(p.y,p.x)
            if material==materials["grass"] and not foundation and p.z<.12:
                mask=max(0,min(1,(radial-.66)/.35))
                p.z+=mask*(.065*math.sin(angle*5+.3)+.025*math.cos(angle*9))
            elif material==materials["rock"] and p.z<(-2.3 if foundation else -.5):
                mask=min(1,abs(p.z)/3)
                p.x+=mask*(.09*math.sin(p.z*1.2+angle*2)+.035*math.cos(angle*7))
                p.y+=mask*.075*math.sin(p.z*.9-angle*3)
        data.normals_split_custom_set([(0,0,0)]*len(data.loops));data.update()


def architectural_details(materials,asset_id,tier):
    if asset_id=="crown-foundation":return []
    origin,scale={"royal-island-left":((-.65,1.15,.16),.9),
                  "royal-island-right":((1.,1.,.88),.9),
                  "royal-island-citadel":((-.2,1.,.2),1.1)}[asset_id]
    objects=[]
    # Blank rear chamber walls gain readable glazing for unrestricted orbits.
    xs=[-.78,0,.78] if tier=="high" else [-.63,.63] if tier=="balanced" else [0]
    for x in xs:
        parts=[arch_panel("V4 rear lancet dark inset",.40,.97,.028,(0,.03,0),materials["rock"],6),
               arch_panel("V4 rear lancet luminous glazing",.30,.86,.025,(0,-.006,.04),materials["window"],6)]
        if tier!="low":
            parts.append(arch("V4 rear lancet carved surround",.33,.91,.09,(0,-.05,0),materials["stone"],.045,6))
            parts.append(box("V4 rear lancet gold mullion",(0,-.065,.40),(.023,.025,.73),materials["gold"],0))
        objects+=transform_objects(parts,(x,1.34,2.68),rotation=math.pi)
    # A compact cantilever balcony grounds the new upper windows in architecture.
    objects.append(box("V4 supported rear balcony",(0,1.57,2.49),(2.40,.60,.13),materials["stone"],.025))
    objects.append(box("V4 rear balcony gold rail",(0,1.85,3.02),(2.35,.045,.045),materials["gold"],0))
    for x in [-1.08,-.54,0,.54,1.08]:
        objects.append(box("V4 rear balcony baluster",(x,1.85,2.77),(.055,.055,.47),materials["ivory"],.01))
    for side in [-1,1]:
        objects.append(box("V4 rear balcony corbel",(side*.85,1.51,2.27),(.23,.36,.36),materials["stone"],.035))
    # Small trim and wrought hinges create highlights with the existing atlas.
    for z in [1.05,1.72,2.24]:
        for side in [-1,1]:
            objects.append(box("V4 oak door gilded hinge",(side*.39,-1.202,z),(.27,.028,.045),materials["gold"],.007))
    for z in [1.18,2.37,3.82]:
        objects.append(box("V4 rear limestone coursing",(0,1.337,z),(2.55,.025,.035),materials["stone"],0))
    return transform_objects(objects,origin,scale)


def bake_contact_shadows(objects,materials):
    """Baked sun visibility and restrained local AO, not runtime shadow draws."""
    bpy.context.view_layer.update()
    graph=bpy.context.evaluated_depsgraph_get();vertices=[];faces=[]
    for obj in objects:
        if obj.type!="MESH":continue
        evaluated=obj.evaluated_get(graph);data=evaluated.to_mesh();offset=len(vertices)
        vertices.extend(obj.matrix_world@vertex.co for vertex in data.vertices)
        faces.extend(tuple(offset+i for i in polygon.vertices) for polygon in data.polygons)
        evaluated.to_mesh_clear()
    tree=BVHTree.FromPolygons(vertices,faces)
    sun_rays=[(SUN+Vector(offset)).normalized() for offset in ((-.025,0,0),(.025,0,0),(0,.02,.01))]
    ao_rays=[Vector(p).normalized() for p in ((.6,.3,1),(-.6,.3,1),(0,-.7,1))]
    for obj in objects:
        if obj.type!="MESH":continue
        data=obj.data;material=data.materials[0]
        color=data.color_attributes.get("Color")
        is_new=color is None or obj.name.startswith("V4")
        if not color:
            color=data.color_attributes.new(name="Color",type="BYTE_COLOR",domain="CORNER")
            color.data.foreach_set("color",[1.,1.,1.,1.]*len(color.data))
        data.color_attributes.active_color=color
        strength=.10 if material==materials["blossom"] else .22 if material==materials["leaf"] else .47 if material==materials["grass"] else .27
        if material==materials["window"]:strength=0
        shading=[]
        normal_matrix=obj.matrix_world.to_3x3().inverted().transposed()
        for vertex in data.vertices:
            normal=(normal_matrix@vertex.normal).normalized()
            point=obj.matrix_world@vertex.co+normal*.035
            sun_hits=sum(tree.ray_cast(point+ray*.025,ray,25)[0] is not None for ray in sun_rays)
            factor=1-strength*sun_hits/len(sun_rays)
            if is_new and material!=materials["window"]:
                directions=[ray for ray in ao_rays if ray.dot(normal)>.15]
                hits=sum(tree.ray_cast(point,ray,1.1)[0] is not None for ray in directions)
                factor*=1-(.035 if material==materials["blossom"] else .12)*hits/max(1,len(directions))
            shading.append(factor)
        for loop in data.loops:
            old=color.data[loop.index].color
            factor=shading[loop.vertex_index]
            color.data[loop.index].color=tuple(max(0,min(1,channel*factor)) for channel in old[:3])+(1,)


def normalize_atlas_uvs(objects):
    """A re-import must not accumulate unused UV sets in every GLB vertex.

    All materials use one shared swatch atlas; normalize imported and new
    pieces together so TEXCOORD_0 always addresses the intended swatch.
    """
    for obj in objects:
        if obj.type!="MESH":continue
        for layer in list(obj.data.uv_layers):obj.data.uv_layers.remove(layer)
        uv_project(obj)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only",default=",".join(ASSETS));parser.add_argument("--tiers",default="high,balanced,low")
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    selected=args.only.split(",");tiers=args.tiers.split(",")
    if not set(selected)<=set(ASSETS) or not set(tiers)<={"high","balanced","low"}:raise ValueError("Unknown asset or tier")
    reset_scene();materials=make_materials()
    materials["window"].node_tree.nodes.get("Principled BSDF").inputs["Emission Strength"].default_value=2.5
    records=[]
    for base_id in selected:
        for tier in tiers:
            suffix="" if tier=="high" else f"-{tier}"
            source=OUT/f"{base_id}-v2{suffix}.glb"
            rng=random.Random(SEED+sum(map(ord,base_id)))
            objects=import_original(source,materials)
            organic_canopies(objects,materials,tier,rng)
            sculpt_edges(objects,materials,base_id)
            objects+=architectural_details(materials,base_id,tier)
            bake_contact_shadows(objects,materials)
            normalize_atlas_uvs(objects)
            asset_id=f"{base_id}-v4"
            record=export_glb(objects,OUT/f"{asset_id}{suffix}.glb",asset_id,tier,SEED,
              {"role":"premium-refined-existing-island","sourceFile":source.name,"sourceSha256":hashlib.sha256(source.read_bytes()).hexdigest()})
            record.update({"sourceFile":source.name,"sourceSha256":hashlib.sha256(source.read_bytes()).hexdigest()})
            budget=12000 if base_id=="crown-foundation" else {"high":40000,"balanced":25000,"low":16000}[tier]
            if record["triangles"]>budget:raise ValueError(f"V4 topology budget exceeded: {record['file']} {record['triangles']} > {budget}")
            records.append(record)
            print(f"V4 REFINED {record['file']} {record['triangles']} triangles {record['bytes']} bytes",flush=True)
    path=OUT/"v4-manifest.json"
    if path.is_file():
        previous={asset["file"]:asset for asset in json.loads(path.read_text(encoding="utf-8"))["assets"]}
        previous.update({asset["file"]:asset for asset in records});records=list(previous.values())
    path.write_text(json.dumps({"schemaVersion":1,"generator":"tools/blender/refine_environment_v4.py","blenderVersion":bpy.app.version_string,
      "seed":SEED,"license":"Original project MIT asset refinements; immutable V2 source hashes retained",
      "materials":"shared embedded 128x128 project atlas, one canonical UV set, retained cavity colours and three-tap directional contact shadow bake",
      "sunDirectionRuntime":[-.48,.72,.56],"sunDirectionBlender":[-.48,-.56,.72],"assets":records},indent=2)+"\n",encoding="utf-8")


if __name__=="__main__":main()

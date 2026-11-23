"""Offline scenic rebuild. Never authors the board, foundation or central city.

Blender --background --factory-startup --python-exit-code 1 --python
tools/blender/final_background_overhaul.py -- --tiers balanced
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import random
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from core import make_materials
from export_assets import export_glb
from polish_environment_v2 import import_original
from refine_environment_v4 import normalize_atlas_uvs
from final_terrain_vegetation import apply_terrain_vegetation
from final_architecture import apply_architecture

OUT = HERE.parents[1] / 'public/assets/models/environment'
ASSETS = ['royal-island-left', 'royal-island-right', 'royal-island-citadel', 'sky-garden', 'sky-windmill']
SEED = 10425058
BUDGETS = {'high': 55000, 'balanced': 38000, 'low': 24000}

# The archived GLBs batch bark with carpentry. These half-open polygon ranges
# trace the original tree objects in the timber primitives at each source LOD.
# Keep the exact cuts here so nearby doors, rails, pines and mill sails survive.
TREE_TIMBER = {
    'royal-island-left': {
        'high': (4330, [(2136, 4051)]), 'balanced': (3085, [(1336, 2650)]), 'low': (1245, [(700, 1174)]),
    },
    'royal-island-right': {
        'high': (3677, [(1384, 3278)]), 'balanced': (2769, [(976, 2288)]), 'low': (1004, [(460, 928)]),
    },
    'royal-island-citadel': {
        'high': (2256, [(1520, 1733), (1847, 2060)]),
        'balanced': (1527, [(754, 926), (1096, 1269)]),
        'low': (481, [(150, 269), (297, 425)]),
    },
    'sky-garden': {
        'high': (1236, [(180, 828)]), 'balanced': (1116, [(180, 708)]), 'low': (564, [(100, 508)]),
    },
    'sky-windmill': {
        'high': (1220, [(988, 1204)]), 'balanced': (1180, [(988, 1164)]), 'low': (772, [(620, 756)]),
    },
}


def cut_faces(mesh, faces):
    if not faces:
        return
    editable = bmesh.new()
    try:
        editable.from_mesh(mesh)
        editable.faces.ensure_lookup_table()
        bmesh.ops.delete(editable, geom=[editable.faces[i] for i in faces], context='FACES')
        editable.to_mesh(mesh)
        mesh.update()
    finally:
        editable.free()


def remove_baked_sakura(objects, materials, asset_id, tier):
    timber, spans = TREE_TIMBER[asset_id][tier]
    wood = next(obj.data for obj in objects if obj.type == 'MESH' and obj.data.materials[0] == materials['wood'])
    if len(wood.polygons) != timber:
        raise ValueError(f'Timber primitive changed in {asset_id} {tier}; check the Sakura polygon ranges')
    cut_faces(wood, [i for start, stop in spans for i in range(start, stop)])

    # The remaining legacy crown accents are well above the meadow flowerbeds.
    for obj in objects:
        if obj.type == 'MESH' and obj.data.materials[0] == materials['blossom']:
            mesh = obj.data
            cut_faces(mesh, [face.index for face in mesh.polygons if all(mesh.vertices[i].co.z > .85 for i in face.vertices)])


def bake_scenic_contacts(objects, additions, materials):
    """New turf receives actual building/tree shadows, not a flat ambient tint.

    Source vertex colours remain untouched. Three broad sun taps soften the
    offline shadows, while short hemisphere rays ground the new stonework.
    There is no additional runtime light, shadow map or render pass.
    """
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    vertices, faces = [], []
    for obj in objects+additions:
        if obj.type!='MESH':
            continue
        data = obj.evaluated_get(graph).to_mesh()
        offset = len(vertices)
        vertices.extend(obj.matrix_world@v.co for v in data.vertices)
        faces.extend(tuple(offset+i for i in polygon.vertices) for polygon in data.polygons)
        obj.evaluated_get(graph).to_mesh_clear()
    tree = BVHTree.FromPolygons(vertices,faces)
    sun = Vector((-.48,-.56,.72)).normalized()
    sun_rays = [(sun+Vector(offset)).normalized() for offset in ((-.10,.04,0),(.09,-.06,0),(0,0,.04))]
    ambient = [Vector(direction).normalized() for direction in ((.7,0,1),(-.7,0,1),(0,.7,1),(0,-.7,1))]
    for obj in additions:
        if obj.type!='MESH':
            continue
        # Blossom primitives deliberately share authoring geometry. A baked
        # instance tint belongs to this placement, never to the cached source.
        # Always copy: even the final single user can still be the cached
        # template reused by a later asset or LOD in this Blender process.
        obj.data=obj.data.copy()
        data = obj.data
        color = data.color_attributes.get('Color')
        if color is None:
            color=data.color_attributes.new(name='Color',type='BYTE_COLOR',domain='CORNER')
            color.data.foreach_set('color',[1,1,1,1]*len(color.data))
        data.color_attributes.active_color=color
        material=data.materials[0]
        is_grass=material==materials['grass']
        strength=.37 if is_grass else .06 if material==materials['blossom'] else .19
        if material==materials['window']:
            strength=0
        normal_matrix=obj.matrix_world.to_3x3().inverted().transposed()
        shading=[]
        for vertex in data.vertices:
            normal=(normal_matrix@vertex.normal).normalized()
            point=obj.matrix_world@vertex.co+normal*.035
            sunlight=sum(tree.ray_cast(point+ray*.02,ray,22)[0] is not None for ray in sun_rays)
            rays=[ray for ray in ambient if ray.dot(normal)>.12]
            contact=sum(tree.ray_cast(point,ray,1.2)[0] is not None for ray in rays)
            shading.append((1-strength*sunlight/3)*(1-.13*contact/max(1,len(rays))))
        for loop in data.loops:
            old=color.data[loop.index].color
            factor=shading[loop.vertex_index]
            color.data[loop.index].color=tuple(channel*factor for channel in old[:3])+(1,)


def crafted_materials():
    """Original 256px swatch atlas: masonry, slate, fibres and mineral beds."""
    materials = make_materials()
    image = next(node.image for node in materials['ivory'].node_tree.nodes if node.type == 'TEX_IMAGE')
    image.scale(256, 256)
    pixels = [.5, .5, .5, 1] * (256 * 256)
    keys = ['ivory','stone','blue','gold','wood','window','grass','rock','blossom','leaf']
    for index, key in enumerate(keys):
        mat = materials[key]
        rgb = mat.diffuse_color[:3]
        rng = random.Random(SEED + index)
        for y in range(64):
            for x in range(64):
                grain = (rng.random()-.5)*.022
                if key in {'ivory','stone'}:
                    row = y//16
                    joint = y%16 == 0 or (x+(row%2)*16)%32 == 0
                    grain += -.075 if joint else math.sin(x*.13+y*.21)*.012
                elif key == 'blue':
                    row = y//12
                    grain += -.055 if y%12<2 or (x+(row%2)*8)%16==0 else .012*math.sin(x*.23)
                elif key == 'wood':
                    grain += math.sin(x*.8+math.sin(y*.11))*.024
                elif key == 'grass':
                    grain += math.sin(x*.67+y*.19)*math.cos(y*.43)*.025
                elif key == 'rock':
                    grain += math.sin(y*.34+math.sin(x*.12))*.038
                elif key == 'blossom':
                    grain += math.sin(x*.7)*math.sin(y*.6)*.022
                start = (((index//4)*64+y)*256+(index%4)*64+x)*4
                pixels[start:start+4] = [max(0,min(1,c+grain)) for c in rgb]+[1]
    image.pixels.foreach_set(pixels)
    image.update()
    image.pack()
    for key, roughness in {'ivory':.78,'stone':.87,'blue':.34,'gold':.29,'grass':.97,'rock':.94,'blossom':.85,'leaf':.91}.items():
        materials[key].node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = roughness
    materials['gold'].node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value = .48
    materials['window'].node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value = 1.6
    return materials


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', default=','.join(ASSETS))
    parser.add_argument('--tiers', default='high,balanced,low')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    selected, tiers = args.only.split(','), args.tiers.split(',')
    if not set(selected)<=set(ASSETS) or not set(tiers)<=set(BUDGETS):
        raise ValueError('Unknown scenic asset or quality')
    materials = crafted_materials()
    records = []
    for base_id in selected:
        for tier in tiers:
            suffix = '' if tier=='high' else f'-{tier}'
            source = OUT / f'{base_id}{"-background-v1" if base_id.startswith("royal-island") else ""}{suffix}.glb'
            source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
            objects = import_original(source, materials)
            terrain, terrain_stats = apply_terrain_vegetation(objects,materials,tier,base_id)
            architecture, architecture_stats = apply_architecture(objects,materials,tier,base_id)
            additions = terrain+architecture
            bake_scenic_contacts(objects,additions,materials)
            # The old silhouettes supply the existing baked contact shading.
            # Export their surroundings and let the shared GLB supply the trees.
            remove_baked_sakura(objects, materials, base_id, tier)
            objects += [obj for obj in additions if not obj.name.startswith((
                'Final branch-led sakura blossom spray', 'Final visible sakura flowering twig',
            ))]
            normalize_atlas_uvs(objects)
            asset_id = base_id+'-final-v1'
            record = export_glb(objects,OUT/f'{asset_id}{suffix}.glb',asset_id,tier,SEED,{
                'role':'scenic-environment-only','sourceFile':source.name,'sourceSha256':source_hash})
            budget = BUDGETS[tier] if base_id.startswith('royal-island') else {'high':18000,'balanced':15000,'low':12000}[tier]
            record.update(sourceFile=source.name,sourceSha256=source_hash,triangleBudget=budget,
                terrain=terrain_stats,architecture=architecture_stats)
            if record['triangles']>budget or record['bytes']>4*1024*1024:
                raise ValueError(f'Asset budget exceeded: {record["file"]}: {record["triangles"]} tris {record["bytes"]} bytes')
            assert hashlib.sha256(source.read_bytes()).hexdigest()==source_hash
            records.append(record)
            print(f'FINAL {record["file"]} {record["triangles"]} triangles {record["bytes"]} bytes',flush=True)
    manifest = OUT/'final-background-manifest.json'
    previous = {} if not manifest.exists() else {r['file']:r for r in json.loads(manifest.read_text())['assets']}
    previous.update({r['file']:r for r in records})
    helpers = ['final_background_overhaul.py','final_terrain_vegetation.py','final_architecture.py',
        'core.py','export_assets.py','polish_environment_v2.py','refine_environment_v4.py','upgrade_background_v1.py',
        'generate_castles.py','generate_vegetation.py','generate_floating_islands.py']
    manifest.write_text(json.dumps({'schemaVersion':1,'generator':'tools/blender/final_background_overhaul.py',
        'blenderVersion':bpy.app.version_string,'seed':SEED,'license':'Original project MIT geometry and textures; no external assets',
        'sourceHashes':{name:hashlib.sha256((HERE/name).read_bytes().replace(b'\r\n',b'\n')).hexdigest() for name in helpers},
        'scope':'Five scenic island families. Sakura are instanced at runtime at the original planting sites.',
        'materials':'Ten shared materials, one original embedded 256px atlas, vertex contact shading',
        'assets':list(previous.values())},indent=2)+'\n',encoding='utf-8')


if __name__=='__main__':
    main()

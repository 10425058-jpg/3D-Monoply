"""Refine immutable V4 surrounding islands into new background-only GLBs.

The world composition, architecture locations, shared atlas, ground origin and
water anchors are retained. This offline pass sculpts existing blossom volumes,
layers their crown silhouettes, shapes the turf/cliff transition and adds small
stone contact details. The board/crown foundation and central city are excluded.
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
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from core import make_materials, reset_scene, box, mesh, tube, transform_objects
from export_assets import export_glb
from polish_environment_v2 import import_original
from refine_environment_v4 import connected_components, normalize_atlas_uvs
from generate_vegetation import _cluster

OUT = HERE.parents[1] / 'public/assets/models/environment'
ASSETS = ['royal-island-left', 'royal-island-right', 'royal-island-citadel']
SEED = 10425058
BUDGETS = {'high': 40000, 'balanced': 25000, 'low': 16000}


def source_bounds(objects):
    coordinates = [obj.matrix_world @ v.co for obj in objects if obj.type == 'MESH' for v in obj.data.vertices]
    return (Vector(tuple(min(p[i] for p in coordinates) for i in range(3))),
            Vector(tuple(max(p[i] for p in coordinates) for i in range(3))))


def sculpt_blossoms(objects, materials, tier, rng):
    """Work on authored lobes, retaining tree positions and all trunk geometry.

    Larger low-frequency scallops and asymmetric shoulders replace smooth pink
    discs. Custom ellipsoid normals keep UV-seam vertices softly connected.
    Added overlapping crown lobes use the same blossom atlas/material batch.
    """
    lobes = []
    for obj in objects:
        if obj.type != 'MESH' or obj.data.materials[0] != materials['blossom']:
            continue
        data = obj.data
        colors = data.color_attributes.get('Color')
        normals = [entry.vector.copy() for entry in data.corner_normals]
        vertex_normals = {}
        tint = {}
        for indices in connected_components(data):
            vertices = [data.vertices[i] for i in indices]
            lo = Vector(tuple(min(v.co[i] for v in vertices) for i in range(3)))
            hi = Vector(tuple(max(v.co[i] for v in vertices) for i in range(3)))
            center, extent = (lo + hi) * 0.5, hi - lo
            if center.z < 0.75 or min(extent.x, extent.y) < 0.3 or extent.z < 0.18:
                continue
            phase = rng.uniform(0, math.tau)
            crown = rng.uniform(0.94, 1.09)
            for vertex in vertices:
                p = vertex.co - center
                angle = math.atan2(p.y, p.x)
                normalized_z = p.z / max(0.05, extent.z * 0.5)
                shoulder = 1 + 0.075 * math.sin(angle * 5 + phase) + 0.035 * math.sin(angle * 8 - phase)
                shoulder *= 1 - 0.04 * normalized_z
                p.x *= shoulder
                p.y *= shoulder * 0.98
                p.z *= crown * (1 + 0.055 * math.cos(angle * 3 + phase))
                vertex.co = center + p
                n = Vector((p.x / max(0.02, extent.x ** 2), p.y / max(0.02, extent.y ** 2), p.z / max(0.02, extent.z ** 2))).normalized()
                vertex_normals[vertex.index] = n
                warmth = 0.5 + 0.5 * n.z
                tint[vertex.index] = (1.0 + warmth * 0.025, 0.95 + warmth * 0.045, 0.98 + warmth * 0.02)
            lobes.append((center, extent, phase))
        for loop in data.loops:
            if loop.vertex_index in vertex_normals:
                normals[loop.index] = vertex_normals[loop.vertex_index]
                if colors:
                    old = colors.data[loop.index].color
                    value = tint[loop.vertex_index]
                    colors.data[loop.index].color = tuple(min(1, old[i] * value[i]) for i in range(3)) + (1,)
        data.normals_split_custom_set(normals)
        data.update()
    count = {'high': 11, 'balanced': 7, 'low': 4}[tier]
    additions = []
    # Spend topology on visible crown shoulders, not miniature individual petals.
    for index, (center, extent, phase) in enumerate(sorted(lobes, key=lambda p: p[1].length, reverse=True)[:count]):
        radius = min(extent.x, extent.y) * 0.22
        position = center + Vector((math.cos(phase) * extent.x * 0.24, math.sin(phase) * extent.y * 0.23, extent.z * 0.24))
        additions.append(_cluster('BG1 layered blossom shoulder', position, (radius, radius * 0.86, extent.z * 0.30),
            materials['blossom'], 'low' if tier == 'low' else 'balanced', index % 3, phase))
    return additions, len(lobes)


def sculpt_cliff(objects, materials):
    """Softly erode the existing strata; never alter ground/building positions."""
    for obj in objects:
        if obj.type != 'MESH' or obj.data.materials[0] != materials['rock']:
            continue
        data = obj.data
        for vertex in data.vertices:
            p = vertex.co
            if p.z > -0.6:
                continue
            angle = math.atan2(p.y, p.x)
            depth = min(1, (-p.z - 0.6) / 3)
            p.x += math.sin(p.z * 1.7 + angle * 2) * 0.055 * depth
            p.y += math.cos(p.z * 1.3 - angle * 3) * 0.045 * depth
        data.normals_split_custom_set([(0, 0, 0)] * len(data.loops))
        data.update()


def hull(points):
    points = sorted(set(points))
    def turn(a, b, c): return (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0])
    lower, upper = [], []
    for p in points:
        while len(lower) > 1 and turn(lower[-2], lower[-1], p) <= 0: lower.pop()
        lower.append(p)
    for p in reversed(points):
        while len(upper) > 1 and turn(upper[-2], upper[-1], p) <= 0: upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def turf_contact(objects, materials):
    """A narrow inward-folded edge articulates the existing meadow silhouette.

    Use the largest near-grade component only; keep every water mouth clear.
    No additional world island or terrain footprint is created.
    """
    candidates = []
    for obj in objects:
        if obj.type != 'MESH' or obj.data.materials[0] != materials['grass']: continue
        for indices in connected_components(obj.data):
            vertices = [obj.data.vertices[i].co for i in indices]
            near = [v for v in vertices if -0.35 < v.z < 0.20]
            if len(near) < 8: continue
            outline = hull([(round(v.x, 5), round(v.y, 5)) for v in near])
            if len(outline) > 6: candidates.append(outline)
    if not candidates: return []
    outline = max(candidates, key=lambda points: sum(abs(x*y2-y*x2) for (x,y),(x2,y2) in zip(points,points[1:]+points[:1])))
    mouths = [obj.matrix_world.translation for obj in objects if obj.type == 'EMPTY' and obj.name.startswith('waterfall_origin')]
    vertices, faces = [], []
    for index, ((x,y),(nx,ny)) in enumerate(zip(outline, outline[1:]+outline[:1])):
        midpoint = Vector(((x+nx)*0.5,(y+ny)*0.5,0))
        if any((midpoint-Vector((mouth.x,mouth.y,0))).length < 1.8 for mouth in mouths): continue
        z = -0.045 + 0.025 * math.sin(index*1.7)
        base = len(vertices)
        vertices.extend([(x*.992,y*.992,z),(nx*.992,ny*.992,z),
                         (nx*.982,ny*.982,-.25-.06*math.sin(index*2.1)),(x*.982,y*.982,-.25-.06*math.sin(index*2.1))])
        faces.extend([(base,base+1,base+2),(base,base+2,base+3)])
    if not vertices: return []
    obj = mesh('BG1 folded moss contact edge', vertices, faces, materials['grass'])
    colors = obj.data.color_attributes.get('Color')
    for loop in obj.data.loops:
        p = obj.data.vertices[loop.vertex_index].co
        shade = 0.76 if p.z < -.15 else 0.97
        colors.data[loop.index].color = (shade*.96,shade,shade*.88,1)
    return [obj]


def architecture_contacts(materials, asset_id, tier):
    origin, scale = {'royal-island-left': ((-.65,1.15,.16),.9),
                     'royal-island-right': ((1,1,.88),.9),
                     'royal-island-citadel': ((-.2,1,.2),1.1)}[asset_id]
    rows = {'high': 6, 'balanced': 4, 'low': 3}[tier]
    parts = []
    for side in (-1, 1):
        for row in range(rows):
            z = .83 + row * (2.65 / max(1, rows-1))
            parts.append(box('BG1 entrance pier dressed quoin', (side*1.365,-1.103,z),(.18,.055,.19),materials['stone'],0))
    # Visible plinth shadow lines connect the keep to its existing raised terrace.
    for side in (-1, 1):
        parts.append(box('BG1 keep stone foot course', (side*.99,-1.115,.56),(.76,.065,.115),materials['stone'],0))
    return transform_objects(parts, origin, scale)


def shade_new_geometry(objects, additions, materials):
    """Bake contact into new pieces only; retain V4's already baked shading."""
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    vertices, faces = [], []
    for obj in objects + additions:
        if obj.type != 'MESH': continue
        evaluated = obj.evaluated_get(graph); data = evaluated.to_mesh(); offset = len(vertices)
        vertices.extend(obj.matrix_world @ v.co for v in data.vertices)
        faces.extend(tuple(offset+i for i in poly.vertices) for poly in data.polygons)
        evaluated.to_mesh_clear()
    tree = BVHTree.FromPolygons(vertices, faces)
    rays = [Vector(p).normalized() for p in ((.6,-.4,1),(-.6,-.4,1),(0,.7,1))]
    for obj in additions:
        if obj.type != 'MESH': continue
        if obj.data.users > 1: obj.data = obj.data.copy()
        data = obj.data
        color = data.color_attributes.get('Color')
        if not color:
            color = data.color_attributes.new(name='Color', type='BYTE_COLOR', domain='CORNER')
            color.data.foreach_set('color', [1,1,1,1] * len(color.data))
        data.color_attributes.active_color = color
        factors = []
        matrix = obj.matrix_world.to_3x3().inverted().transposed()
        strength = .055 if data.materials[0] == materials['blossom'] else .14
        for vertex in data.vertices:
            normal = (matrix @ vertex.normal).normalized()
            point = obj.matrix_world @ vertex.co + normal*.03
            allowed = [ray for ray in rays if ray.dot(normal) > .1]
            hits = sum(tree.ray_cast(point,ray,.8)[0] is not None for ray in allowed)
            factors.append(1-strength*hits/max(1,len(allowed)))
        for loop in data.loops:
            old = color.data[loop.index].color
            color.data[loop.index].color = tuple(v*factors[loop.vertex_index] for v in old[:3])+(1,)


def trim_subpixel_geometry(objects, materials, tier):
    # V4 high citadel is already near the strict 40k cap. Trade a small amount
    # of rock/stone micro-bevel topology for the visibly layered blossom crown.
    ratios = {'high': {'rock': .84, 'stone': .97}, 'balanced': {'rock': .9, 'stone': .985}, 'low': {}}[tier]
    for obj in objects:
        if obj.type != 'MESH': continue
        key = next((key for key in ratios if obj.data.materials[0] == materials[key]), None)
        if key and len(obj.data.polygons) > 120:
            modifier = obj.modifiers.new('BG1 bounded micro-detail exchange', 'DECIMATE')
            modifier.ratio = ratios[key]
            modifier.use_collapse_triangulate = True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', default=','.join(ASSETS))
    parser.add_argument('--tiers', default='high,balanced,low')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    selected, tiers = args.only.split(','), args.tiers.split(',')
    if not set(selected) <= set(ASSETS) or not set(tiers) <= set(BUDGETS): raise ValueError('Unknown background asset or tier')
    materials = make_materials()
    materials['gold'].node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value = .48
    materials['window'].node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value = 1.7
    records = []
    for base_id in selected:
        for tier in tiers:
            suffix = '' if tier == 'high' else f'-{tier}'
            source = OUT / f'{base_id}-v4{suffix}.glb'
            source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
            objects = import_original(source, materials)
            bounds = source_bounds(objects)
            rng = random.Random(SEED+sum(map(ord,base_id)))
            accents, lobe_count = sculpt_blossoms(objects,materials,tier,rng)
            sculpt_cliff(objects,materials)
            additions = accents + turf_contact(objects,materials) + architecture_contacts(materials,base_id,tier)
            shade_new_geometry(objects,additions,materials)
            trim_subpixel_geometry(objects,materials,tier)
            objects += additions
            # Keep all improvements inside the source's same camera-safe envelope.
            for obj in objects:
                if obj.type != 'MESH': continue
                for vertex in obj.data.vertices:
                    world = obj.matrix_world @ vertex.co
                    clamped = Vector(tuple(max(bounds[0][axis],min(bounds[1][axis],world[axis])) for axis in range(3)))
                    vertex.co = obj.matrix_world.inverted() @ clamped
            normalize_atlas_uvs(objects)
            asset_id = f'{base_id}-background-v1'
            record = export_glb(objects,OUT/f'{asset_id}{suffix}.glb',asset_id,tier,SEED,{
                'role':'background-only-refined-island','sourceFile':source.name,'sourceSha256':source_hash,
                'refinement':'sculpted layered blossom crowns, folded turf lip, eroded strata and architectural contact detail'})
            record.update({'sourceFile':source.name,'sourceSha256':source_hash,'sculptedCanopyLobes':lobe_count,
                           'addedCrownLobes':len(accents),'triangleBudget':BUDGETS[tier]})
            if record['triangles'] > BUDGETS[tier]: raise ValueError(f"Triangle budget exceeded: {record['file']} {record['triangles']}")
            if record['bytes'] > 3*1024*1024: raise ValueError(f"Byte budget exceeded: {record['file']} {record['bytes']}")
            if hashlib.sha256(source.read_bytes()).hexdigest() != source_hash: raise ValueError('Original source was modified')
            records.append(record)
            print(f"BACKGROUND {record['file']} {record['triangles']} triangles {record['bytes']} bytes; sculpted {lobe_count} existing crown lobes",flush=True)
    manifest = OUT/'background-v1-manifest.json'
    if manifest.is_file():
        previous = {item['file']:item for item in json.loads(manifest.read_text(encoding='utf-8'))['assets']}
        previous.update({item['file']:item for item in records}); records = list(previous.values())
    manifest.write_text(json.dumps({'schemaVersion':1,'generator':'tools/blender/upgrade_background_v1.py',
        'sourceHashes':{name:hashlib.sha256((HERE/name).read_bytes().replace(b'\r\n',b'\n')).hexdigest() for name in
            ['upgrade_background_v1.py','core.py','export_assets.py','polish_environment_v2.py','refine_environment_v4.py','generate_vegetation.py']},
        'blenderVersion':bpy.app.version_string,'seed':SEED,'license':'Original project MIT asset refinements; immutable V4 source hashes retained',
        'materials':'One shared embedded 128x128 project atlas, one canonical UV set, retained V4 cavity shading and new-piece-only contact bake',
        'scope':'surrounding royal islands only; no board, crown foundation, central city, layout or gameplay assets',
        'assets':records},indent=2)+'\n',encoding='utf-8')


if __name__ == '__main__': main()

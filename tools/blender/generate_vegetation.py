"""Reusable curved sakura, shrubs and garden stones with shared PBR materials.

Canopies use a handful of softly warped lobes, not individual petals. Three
vertex-tint families preserve pink depth without multiplying material batches.
"""
import math
import random
import bpy
from core import mesh, tube, transform_objects, uv_project


_CANOPY_CACHE = {}


def _canopy_data(detail, material, tint_index):
    key = (detail, material.name, tint_index)
    if key in _CANOPY_CACHE and _CANOPY_CACHE[key].name in bpy.data.meshes:
        return _CANOPY_CACHE[key]
    # Blender's 80-triangle icosphere gives each lobe a much softer silhouette
    # than a UV sphere at the same budget. The shape is subtly organic.
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1 if detail == "low" else 2, radius=1)
    obj = bpy.context.object
    obj.name = f"Sakura_cluster_source_{detail}_{tint_index}"
    for vertex in obj.data.vertices:
        x, y, z = vertex.co
        ripple = 1 + .065 * math.sin(x * 5 + y * 2.4) * math.cos(z * 4 - x)
        vertex.co *= ripple
    obj.data.materials.append(material)
    for face in obj.data.polygons:
        face.use_smooth = True
    # Blender's built-in ico UVs span the full texture. Remove them so the
    # shared material samples only its assigned atlas swatch at render/export.
    for layer in list(obj.data.uv_layers):
        obj.data.uv_layers.remove(layer)
    uv_project(obj)
    colors = obj.data.color_attributes.get("Color") or obj.data.color_attributes.new(name="Color", type="BYTE_COLOR", domain="CORNER")
    tints = ((1, 1, 1), (.97, .87, .95), (.88, .76, .87))
    tint = tints[tint_index % 3]
    for polygon in obj.data.polygons:
        # Tiny per-lobe tint changes shade branches, not noisy petal speckles.
        for loop in polygon.loop_indices:
            colors.data[loop].color = (*tint, 1)
    data = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    _CANOPY_CACHE[key] = data
    return data


def _cluster(name, location, scale, material, detail, tint_index=0, rotation=0):
    obj = bpy.data.objects.new(name, _canopy_data(detail, material, tint_index))
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.scale = scale
    obj.rotation_euler.z = rotation
    return obj


def generate_tree(materials, variant="large", detail="high", origin=(0, 0, 0), scale=1):
    """Generate a large / medium / small flowering tree, return local objects.

    High: ~1.4k triangles; low: <400. Cluster mesh data is shared across all
    trees of the same detail/tint, allowing the exporter to preserve reuse.
    """
    seed = 2471 + sum((i + 1) * ord(c) for i, c in enumerate(str(variant)))
    rng = random.Random(seed)
    low = detail == "low"
    sides = 4 if low else 6
    size = {"large": 1, "medium": .78, "small": .55}.get(variant, 1)
    phase = rng.uniform(-.2, .2)
    trunk = [(0, 0, 0), (.10, .03, .55), (-.08, .06, 1.25), (.15, .13, 1.95), (.33, .10, 2.55)]
    objects = [tube(f"Sakura_{variant}_curved_trunk", trunk, [.23, .20, .16, .12, .055], materials["wood"], sides=sides)]
    root_count = 3 if low else 5
    for i in range(root_count):
        angle = i * math.tau / root_count + .4
        objects.append(tube(f"Sakura_{variant}_root_{i}",
                            [(0, 0, .25), (.34 * math.cos(angle), .34 * math.sin(angle), .07),
                             (.69 * math.cos(angle + .15), .69 * math.sin(angle + .15), .025)],
                            [.13, .095, .012], materials["wood"], sides=4))

    # Broad slightly flattened silhouette, with asymmetry and a visible branch
    # structure below it. Sparse upper lobes avoid a single candyfloss ball.
    canopy_count = 7 if low else 10 if detail == "balanced" else 12
    for i in range(canopy_count):
        outer = i < (5 if low else 8)
        angle = i * 2.399963 + phase
        radial = (1.35 if outer else .65) * rng.uniform(.9, 1.12)
        x = math.cos(angle) * radial
        y = math.sin(angle) * radial * .83
        z = (2.75 if outer else 3.45) + rng.uniform(-.12, .22)
        radius = rng.uniform(.78, 1.0) if outer else rng.uniform(.72, .87)
        objects.append(_cluster(f"Sakura_{variant}_blossom_{i:02d}", (x, y, z),
                                (radius, radius * .89, radius * .76), materials["blossom"], detail,
                                (i + (1 if not outer else 0)) % 3, angle))
        if outer and (not low or i < 4):
            branch_start = (.03, .07, 1.30 + (i % 3) * .21)
            objects.append(tube(f"Sakura_{variant}_branch_{i:02d}",
                                [branch_start, (x * .43, y * .40, z - .80), (x * .84, y * .86, z - .20)],
                                [.105, .075, .025], materials["wood"], sides=sides))
    for obj in objects:
        obj["asset_module"] = "cherry_blossom_tree"
        obj["variant"] = str(variant)
    return transform_objects(objects, origin=origin, scale=scale * size, rotation=phase)


def generate_shrub(materials, origin=(0, 0, 0), scale=1, flowering=False, detail="high", seed=114):
    """Reusable three-lobed hedges; blossom caps add garden colour at tiny cost."""
    rng = random.Random(seed)
    objects = []
    for i, (x, y, z, width) in enumerate(((-.25, 0, .26, .40), (.22, .09, .28, .39), (0, -.08, .40, .42))):
        material = materials["blossom"] if flowering and i == 2 else materials["leaf"]
        objects.append(_cluster(f"Garden_{'flowering' if flowering else 'hedge'}_{i}", (x, y, z),
                                (width, width * .8, width * .77), material, "low" if detail != "high" else "balanced",
                                i % 3 if flowering and i == 2 else 0, rng.random() * math.tau))
    for obj in objects:
        obj["asset_module"] = "garden_shrub"
    return transform_objects(objects, origin=origin, scale=scale)


def generate_garden_rocks(materials, origin=(0, 0, 0), scale=1, seed=921):
    """Three low garden boulders reuse the small lobe mesh, with stone material."""
    rng = random.Random(seed)
    objects = []
    for i in range(3):
        objects.append(_cluster(f"Garden_boulder_{i}", (i * .38 - .38, rng.uniform(-.2, .2), .12),
                                (rng.uniform(.25, .45), rng.uniform(.2, .35), rng.uniform(.2, .32)),
                                materials["rock"], "low", 0, rng.random() * math.tau))
    return transform_objects(objects, origin=origin, scale=scale)

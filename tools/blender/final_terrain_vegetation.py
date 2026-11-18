"""Offline scenery reconstruction for the final floating-kingdom art pass.

The existing castle, promenade and water-anchor coordinates are contractual.
Only the large ground component and below-grade rock are rebuilt.  Large sakura
ellipsoids are replaced with branch-led flower sprays rather than inflated.
Everything uses the project's atlas and is merged into the existing batches.
"""
import math
import random

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

from core import mesh, tube
from generate_floating_islands import _surface, _tint
from generate_vegetation import _cluster
from refine_environment_v4 import connected_components

SEED = 10425058


def _bounds(data, indices):
    points = [data.vertices[i].co for i in indices]
    low = Vector(tuple(min(p[a] for p in points) for a in range(3)))
    high = Vector(tuple(max(p[a] for p in points) for a in range(3)))
    return low, high


def _remove_vertices(objects, obj, indices):
    if not indices:
        return
    data = obj.data
    bm = bmesh.new()
    bm.from_mesh(data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in indices], context='VERTS')
    bm.to_mesh(data)
    bm.free()
    data.update()
    if len(data.polygons):
        # Imported custom normals address old loop indices. Fresh geometric
        # normals are essential after deleting the replaced components.
        data.normals_split_custom_set([(0, 0, 0)] * len(data.loops))
    else:
        objects.remove(obj)
        bpy.data.objects.remove(obj, do_unlink=True)


def _main_meadow(objects, materials):
    candidates = []
    for obj in objects:
        if obj.type != 'MESH' or obj.data.materials[0] != materials['grass']:
            continue
        for ids in connected_components(obj.data):
            low, high = _bounds(obj.data, ids)
            extent = high - low
            if extent.x > 5 and extent.y > 4 and high.z < .4:
                candidates.append((extent.x * extent.y, obj, ids, low, high))
    return max(candidates, key=lambda item: item[0]) if candidates else None


def _outline(data, ids, count):
    points = [data.vertices[i].co.copy() for i in ids]
    near = [p for p in points if p.z > -.46]
    rx = max(abs(p.x) for p in near)
    ry = max(abs(p.y) for p in near)
    polar = {}
    for p in near:
        angle = math.atan2(p.y / ry, p.x / rx) % math.tau
        radius = math.hypot(p.x / rx, p.y / ry)
        if radius < .65:
            continue
        key = round(angle, 4)
        polar[key] = max(polar.get(key, 0), radius)
    keys = sorted(polar)
    result = []
    for i in range(count):
        angle = i * math.tau / count
        nearest = min(keys, key=lambda a: abs((a - angle + math.pi) % math.tau - math.pi))
        radius = polar[nearest]
        # Broad coves and shoulders carry the silhouette. Small jagged noise
        # is deliberately absent; the original water mouths stay unobstructed.
        radius *= 1 + .026 * math.sin(angle * 5 + .7) + .018 * math.sin(angle * 9 - .4)
        result.append(Vector((math.cos(angle) * rx * radius, math.sin(angle) * ry * radius, 0)))
    return result, rx, ry


def _tint_meadow(obj, strength=1):
    color = obj.data.color_attributes.get('Color')
    for polygon in obj.data.polygons:
        for loop in polygon.loop_indices:
            p = obj.data.vertices[obj.data.loops[loop].vertex_index].co
            variation = .94 + .045 * math.sin(p.x * 1.17 + p.y * .43) * math.sin(p.y * .89)
            # Richer shaded lip, quiet warm meadow top.
            shade = variation * (.78 if p.z < -.15 else 1)
            color.data[loop].color = (shade * .96, shade, shade * .89, 1)
    return obj


def _ground_details(objects, materials, outline, tier, rng):
    """Sparse planted meadow groups, placed only on unoccupied outer land.

    A downward authoring ray excludes castle courts, paths, channels and tree
    crowns. Broad hummocks add actual relief; leaves and flowers are grouped
    into the existing material batches, never added as runtime draw objects.
    """
    vertices, faces = [], []
    for obj in objects:
        if obj.type != 'MESH':
            continue
        offset = len(vertices)
        vertices.extend(obj.matrix_world @ p.co for p in obj.data.vertices)
        faces.extend(tuple(offset + i for i in face.vertices) for face in obj.data.polygons)
    tree = BVHTree.FromPolygons(vertices, faces) if faces else None
    water = [obj.matrix_world.translation for obj in objects
             if obj.type == 'EMPTY' and (obj.name.startswith('watercourse_') or obj.name.startswith('waterfall_origin'))]
    target = {'high': 10, 'balanced': 8, 'low': 5}[tier]
    additions, sites = [], []
    for index in range(len(outline) * 2):
        if len(sites) >= target:
            break
        i = (index * 13 + 3) % len(outline)
        radial = .72 + (index % 3) * .075
        point = outline[i] * radial
        if any((Vector((p.x, p.y, 0)) - point).length < 1.25 for p in water):
            continue
        if any((p - point).length < 1.7 for p in sites):
            continue
        if tree:
            hit = tree.ray_cast(point + Vector((0, 0, 30)), Vector((0, 0, -1)), 31)[0]
            if hit is not None and hit.z > -.025:
                continue
        sites.append(point)
        sx, sy = rng.uniform(.65, .92), rng.uniform(.48, .70)
        height = rng.uniform(.18, .28)
        verts = [(point.x, point.y, height)]
        for radius, z in ((.46, height * .64), (1, .018)):
            verts.extend((point.x + math.cos(j * math.tau / 8) * sx * radius,
                          point.y + math.sin(j * math.tau / 8) * sy * radius, z) for j in range(8))
        polys = [(0, j + 1, (j + 1) % 8 + 1) for j in range(8)]
        polys.extend((j + 1, j + 9, (j + 1) % 8 + 9, (j + 1) % 8 + 1) for j in range(8))
        hill = mesh('Final planted meadow microterrace', verts, polys, materials['grass'], smooth=True)
        color = hill.data.color_attributes.get('Color')
        for face in hill.data.polygons:
            for loop in face.loop_indices:
                v = hill.data.vertices[hill.data.loops[loop].vertex_index].co
                shade = .84 + .13 * v.z / height
                color.data[loop].color = (shade * .91, shade, shade * .80, 1)
        additions.append(hill)

        # Three broad curved blades read as a planted group, not grass noise.
        leaves, leaf_faces = [], []
        for j in range(3):
            a = j * 2.399963 + index
            x = point.x + math.cos(a) * sx * .54
            y = point.y + math.sin(a) * sy * .54
            n = len(leaves)
            leaves.extend([(x, y, .07), (x - math.sin(a) * .12, y + math.cos(a) * .12, .20),
                           (x + math.cos(a) * .32, y + math.sin(a) * .32, .38),
                           (x + math.sin(a) * .12, y - math.cos(a) * .12, .20)])
            leaf_faces.extend([(n, n + 1, n + 2), (n, n + 2, n + 3)])
        additions.append(mesh('Final meadow broad-leaf plant group', leaves, leaf_faces, materials['leaf']))
        flowers, flower_faces = [], []
        for j in range(3):
            a = j * 2.399963 + .7
            x = point.x + math.cos(a) * sx * .38
            y = point.y + math.sin(a) * sy * .38
            for petal in range(5):
                b = petal * math.tau / 5
                n = len(flowers)
                flowers.extend([(x, y, height + .04),
                                (x + math.cos(b - .37) * .15, y + math.sin(b - .37) * .15, height + .095),
                                (x + math.cos(b + .37) * .15, y + math.sin(b + .37) * .15, height + .095)])
                flower_faces.append((n, n + 1, n + 2))
        additions.append(mesh('Final meadow open flower grouping', flowers, flower_faces,
                              materials['ivory' if index % 3 == 0 else 'blossom']))

    # Low dark planted discs meet the original tree roots at their exact grade.
    root_count = 0
    for obj in objects:
        if obj.type != 'MESH' or obj.data.materials[0] != materials['wood']:
            continue
        for ids in connected_components(obj.data):
            low, high = _bounds(obj.data, ids)
            extent = high - low
            if not (0 <= low.z < .19 and extent.z > 1.2 and extent.x + extent.y < 1.4):
                continue
            center = (low + high) * .5
            radius = max(.27, min(.52, extent.z * .17))
            points = [(center.x, center.y, low.z - .005)]
            points.extend((center.x + math.cos(i * math.tau / 8) * radius,
                           center.y + math.sin(i * math.tau / 8) * radius * .76, low.z - .01) for i in range(8))
            soil = mesh('Final rooted meadow contact patch', points,
                        [(0, i + 1, (i + 1) % 8 + 1) for i in range(8)], materials['grass'])
            for color in soil.data.color_attributes.get('Color').data:
                color.color = (.53, .48, .35, 1)
            additions.append(soil)
            root_count += 1
    return additions, len(sites), root_count


def _terrain(objects, materials, tier, rng):
    selected = _main_meadow(objects, materials)
    if not selected:
        return [], {'rebuiltCliff': False, 'meadowRings': 0}
    _, meadow, ids, low, high = selected
    count = {'high': 56, 'balanced': 40, 'low': 28}[tier]
    outline, rx, ry = _outline(meadow.data, ids, count)
    _remove_vertices(objects, meadow, ids)

    depth = 0
    removed = 0
    # Retain garden boulders, architecture recesses and separate satellite
    # islands. Replace the hanging repeated spikes with one sculpted massif.
    for obj in list(objects):
        if obj.type != 'MESH' or obj.data.materials[0] != materials['rock']:
            continue
        discard = []
        for indices in connected_components(obj.data):
            lo, hi = _bounds(obj.data, indices)
            center = (lo + hi) * .5
            radial = math.hypot(center.x / rx, center.y / ry)
            if hi.z < .08 and lo.z < -.45 and radial < 1.36:
                discard.extend(indices)
                depth = max(depth, -lo.z)
                removed += 1
        _remove_vertices(objects, obj, discard)
    depth = max(4.4, depth)

    # Five broad steps have alternating undercuts and buttressed shoulders.
    # The lower massif splits into three unequal lobes instead of a single
    # repeated cone. Facets remain broad enough to read from gameplay distance.
    profiles = [(1, -.31), (1.025, -.78), (.955, -1.28), (.99, -1.72),
                (.80, -2.28), (.83, -2.71), (.62, -depth * .62),
                (.43, -depth * .82), (.16, -depth * .98)]
    if tier == 'low':
        profiles = [profiles[i] for i in (0, 1, 3, 4, 6, 8)]
    rings = []
    for level, (radius, z) in enumerate(profiles):
        ring = []
        for i, point in enumerate(outline):
            a = i * math.tau / count
            fracture = (.045 * math.sin(a * 7 + level * 1.3) + .025 * math.cos(a * 11 - level))
            fracture *= min(1, level * .5)
            if level >= len(profiles) - 2:
                fracture += .10 * math.sin(a * 3 + .45)
            r = radius + fracture
            ring.append((point.x * r + level * .06, point.y * r - level * .035,
                         z + (0 if level == 0 else .13 * math.sin(a * 5 + level * .8))))
        rings.append(ring)
    cliff = _surface('Final sculpted undercut limestone massif', rings, materials['rock'], cap_bottom=True)
    colors = cliff.data.color_attributes.get('Color')
    for face in cliff.data.polygons:
        center = face.center
        level = min(len(profiles) - 2, face.index // (count * 2))
        shade = .96 - min(1, -center.z / depth) * .15
        # Consecutive courses show geological logic, without zebra striping.
        warm = (1.0, .94, .90) if level in (0, 2, 4) else (.87, .91, 1.0)
        for loop in face.loop_indices:
            colors.data[loop].color = tuple(channel * shade for channel in warm) + (1,)
    additions = [cliff]

    # A genuinely tessellated landform replaces the old center fan. The inner
    # court stays at the exact original grade; low rolling swells live only in
    # the outer meadow, clear of the castle terrace and its promenade.
    turf_rings = []
    for radial in (.04, .28, .51, .69, .84, .96, 1.015):
        ring = []
        for i, p in enumerate(outline):
            a = i * math.tau / count
            x, y = p.x * radial, p.y * radial
            edge = max(0, (radial - .70) / .315)
            undulate = (.085 * math.sin(a * 4 + .3) + .045 * math.sin(a * 7 - .5)) * edge
            z = .018 + undulate
            # Below-grade low swales never swallow architectural detail.
            if radial < .70:
                z = .012
            ring.append((x, y, z))
        turf_rings.append(ring)
    # _surface reverses winding for a descending shell; these rings expand
    # outward, so the same winding correctly faces the meadow towards +Z.
    ground = _surface('Final tessellated rolling meadow', turf_rings, materials['grass'], cap_top=True)
    for face in ground.data.polygons:
        face.use_smooth = True
    additions.append(_tint_meadow(ground))
    lip_lower = [(p.x * 1.007, p.y * 1.007, -.34 - .09 * math.sin(i * 2.11)) for i, p in enumerate(outline)]
    lip = _surface('Final folded living turf overhang', [turf_rings[-1], lip_lower], materials['grass'])
    additions.append(_tint_meadow(lip))

    # Broken projecting strata, draped moss shoulders and exposed soil make
    # grass/rock transitions tactile; each is intentionally a broad landform.
    ledge_count = {'high': 11, 'balanced': 8, 'low': 5}[tier]
    for index in range(ledge_count):
        a = index * 2.399963 + .35
        i = int(a % math.tau / math.tau * count)
        p = outline[i]
        x, y = p.x * .96, p.y * .96
        scale = rng.uniform(.7, 1.2)
        tangent = Vector((-math.sin(a), math.cos(a), 0))
        outward = Vector((math.cos(a), math.sin(a), 0))
        top, bottom = [], []
        z = -.64 - (index % 3) * .39
        for j in range(8):
            b = j * math.tau / 8
            q = tangent * (math.cos(b) * scale * 1.3) + outward * (math.sin(b) * scale * .48)
            top.append((x + q.x, y + q.y, z + .08 * math.sin(j * 2.7)))
            bottom.append((x + q.x * .87, y + q.y * .87, z - .29))
        ledge = _tint(_surface('Final broken broad cliff course', [top, bottom], materials['rock'], cap_top=True, cap_bottom=True), 'rock', index)
        additions.append(ledge)
        if index % 2 == 0:
            moss = mesh('Final hanging moss shelf', top, [tuple(range(8))], materials['grass'])
            additions.append(_tint_meadow(moss))
    planting, meadow_groups, rooted_contacts = _ground_details(objects, materials, outline, tier, rng)
    additions += planting
    return additions, {'rebuiltCliff': True, 'removedRockComponents': removed,
                       'cliffCourses': len(profiles), 'meadowRings': len(turf_rings), 'broadLedges': ledge_count,
                       'plantedMeadowGroups': meadow_groups, 'rootContactPatches': rooted_contacts}


def _blossom_sprays(objects, materials, tier, rng, asset_id):
    additions = []
    count = 0
    total_sprays = 0
    hero = asset_id.startswith('royal-island')
    for obj in list(objects):
        if obj.type != 'MESH' or obj.data.materials[0] != materials['blossom']:
            continue
        removed = []
        for indices in connected_components(obj.data):
            low, high = _bounds(obj.data, indices)
            center, extent = (low + high) * .5, high - low
            if center.z < .78 or min(extent.x, extent.y) < .35 or extent.z < .22:
                continue
            removed.extend(indices)
            phase = rng.uniform(0, math.tau)
            large_lobe = max(extent.x, extent.y) > 1.0
            if hero:
                spray_count = ({'high': 5, 'balanced': 4, 'low': 3} if large_lobe
                               else {'high': 3, 'balanced': 3, 'low': 2})[tier]
                if not large_lobe and tier == 'high' and count % 4 == 0:
                    spray_count = 2
            else:
                spray_count = 3 if large_lobe else 2
                if tier == 'high' and not large_lobe and count % 3 == 0:
                    spray_count = 1
            total_sprays += spray_count
            # Varied horizontal branch tiers leave breathing room below the
            # crowns. Smaller interlocking sprays replace every smooth blob.
            for j in range(spray_count):
                a = j * 2.399963 + phase
                radial = (.21 if spray_count < 4 else .26) if j < spray_count - 1 else .04
                point = center + Vector((math.cos(a) * extent.x * radial,
                                         math.sin(a) * extent.y * radial,
                                         extent.z * (rng.uniform(-.09, .14) + (.06 if j == spray_count - 1 else 0))))
                size = rng.uniform(.32, .38) if spray_count < 4 else rng.uniform(.26, .32)
                if j == spray_count - 1:
                    size *= 1.12  # A continuous central bough unifies its smaller shoulder sprays.
                scale = (extent.x * size, extent.y * size * .91, extent.z * rng.uniform(.23, .34))
                spray = _cluster('Final branch-led sakura blossom spray', point, scale,
                                 materials['blossom'], 'low', (count + j) % 3, a)
                additions.append(spray)
                # Small source lobes already occur in branch-led groups of
                # 5–6. A new twig for every micro-spray would be subpixel noise
                # and an avoidable topology multiplier on distant gardens.
                twig_count = (2 if tier == 'high' else 1) if large_lobe else (1 if count % 9 == 0 else 0)
                if not hero:
                    twig_count = 1 if large_lobe and count % 3 == 0 else 0
                if j < twig_count:
                    start = center + Vector((0, 0, -extent.z * .44))
                    mid = start.lerp(point, .55) - Vector((0, 0, extent.z * .10))
                    tip = point - Vector((0, 0, extent.z * .06))
                    additions.append(tube('Final visible sakura flowering twig', [start, mid, tip],
                                          [min(.045, extent.x * .032), .025, .006], materials['wood'], sides=3))
            count += 1
        _remove_vertices(objects, obj, removed)
    return additions, {'replacedCanopyLobes': count, 'authoredBlossomSprays': total_sprays}


def apply_terrain_vegetation(objects, materials, tier, asset_id):
    """Mutate imported Z-up assets; return additions and reviewable metrics.

    Caller owns export, atlas normalization, baked contact and manifest hashes.
    Effect anchors, architecture, path objects and tree roots are never moved.
    """
    rng = random.Random(SEED + sum((i + 1) * ord(c) for i, c in enumerate(asset_id)))
    terrain, terrain_stats = _terrain(objects, materials, tier, rng)
    blossoms, blossom_stats = _blossom_sprays(objects, materials, tier, rng, asset_id)
    return terrain + blossoms, {**terrain_stats, **blossom_stats}

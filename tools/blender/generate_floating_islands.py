"""Deterministic faceted floating landforms; Z-up, grass grade at Z=0.

The flat, irregular rim and broken vertical strata are deliberate. These are
separate background islands, never a swollen terrain bowl below the game board.
Water is animated in the browser; exported empties mark its static cliff mouth.
"""
import math
import random
import bpy
from core import mesh, tube


def _tint(obj, family, seed=0):
    """Three gentle vertex tints share one atlas material and one draw batch."""
    if obj.type != "MESH":
        return obj
    colors = obj.data.color_attributes.get("Color") or obj.data.color_attributes.new(name="Color", type="BYTE_COLOR", domain="CORNER")
    rng = random.Random(seed)
    for polygon in obj.data.polygons:
        center_z = sum(obj.data.vertices[index].co.z for index in polygon.vertices) / len(polygon.vertices)
        if family == "rock":
            shade = 1 if center_z > -1.4 else .86 if center_z > -3.5 else .72
            tint = ((1, .96, .91), (.9, .94, 1), (.95, .91, .99))[polygon.index % 3]
        else:
            # Keep the large meadow quiet. Alternating face tints on a center
            # fan would create distracting radial stripes behind the castle.
            shade = 1 if obj.name.endswith("flat_meadow") else rng.uniform(.87, 1)
            tint = (.96, 1, .91) if obj.name.endswith("flat_meadow") else ((.96, 1, .85), (.88, .97, .87), (1, .99, .93))[polygon.index % 3]
        value = tuple(channel * shade for channel in tint) + (1,)
        for loop in polygon.loop_indices:
            colors.data[loop].color = value
    return obj


def _empty(name, position, **extras):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    for key, value in extras.items():
        obj[key] = value
    return obj


def _surface(name, rings, material, cap_top=False, cap_bottom=False):
    count = len(rings[0])
    vertices = [point for ring in rings for point in ring]
    faces = []
    for level in range(len(rings) - 1):
        for index in range(count):
            a = level * count + index
            b = level * count + (index + 1) % count
            # A diagonal produces a readable angular fault rather than a smooth
            # lathed mountain. Alternating directions avoid a repetitive fan.
            if (index + level) % 2:
                faces += [(a, b, a + count), (b, b + count, a + count)]
            else:
                faces += [(a, b, b + count), (a, b + count, a + count)]
    if cap_top:
        faces.append(tuple(reversed(range(count))))
    if cap_bottom:
        faces.append(tuple((len(rings) - 1) * count + i for i in range(count)))
    # Ring order runs downward. Reverse to keep outward-facing normals.
    return mesh(name, vertices, [tuple(reversed(face)) for face in faces], material)


def _rock_shard(name, x, y, top, radius, depth, material, rng, detail):
    count = 7 if detail == "high" else 5
    phase = rng.uniform(0, math.tau)
    lean_x, lean_y = rng.uniform(-.8, .8), rng.uniform(-.65, .65)
    rings = []
    for level, (fraction, z) in enumerate(((1, top), (1.02, top - depth * .25), (.58, top - depth * .72), (.06, top - depth))):
        rings.append([(x + math.cos(phase + i * math.tau / count) * radius * fraction + lean_x * level / 3,
                       y + math.sin(phase + i * math.tau / count) * radius * fraction + lean_y * level / 3,
                       z + (rng.uniform(-.16, .16) if level < 3 else 0)) for i in range(count)])
    return _surface(name, rings, material, cap_top=True, cap_bottom=True)


def _path(name, points, widths, material):
    """A low raised irregular stone ribbon, not a separate terrain arch."""
    vertices = []
    for i, point in enumerate(points):
        before, after = points[max(0, i - 1)], points[min(len(points) - 1, i + 1)]
        dx, dy = after[0] - before[0], after[1] - before[1]
        length = max(.001, math.hypot(dx, dy))
        nx, ny = -dy / length * widths[i] / 2, dx / length * widths[i] / 2
        vertices.extend([(point[0] + nx, point[1] + ny, point[2]),
                         (point[0] - nx, point[1] - ny, point[2])])
    faces = [(i * 2, i * 2 + 1, i * 2 + 3, i * 2 + 2) for i in range(len(points) - 1)]
    return mesh(name, vertices, faces, material)


def generate_island(materials, variant="left", detail="high", seed=10425058):
    """Return an unparented local island, including named waterfall anchors.

    `detail` accepts high / balanced / low. Ground stays close to zero so the
    architecture, reusable gardens and water can share a stable placement API.
    """
    if variant not in ("left", "right"):
        raise ValueError("Island variant must be left or right")
    rng = random.Random(seed + (0 if variant == "left" else 101))
    high = detail == "high"
    count = 44 if high else 32 if detail == "balanced" else 24
    sign = 1 if variant == "left" else -1
    angles = [i * math.tau / count for i in range(count)]
    # Two composed outlines, not mirrored copies: left is a long crescent rim;
    # right has a broad rear terrace and a cut-back front-right shoulder.
    def radius(angle):
        if variant == "left":
            return 1 + .075 * math.sin(angle * 3 + .4) + .045 * math.sin(angle * 7 - .3)
        return 1 + .085 * math.cos(angle * 4 - .6) + .05 * math.sin(angle * 3 + .8)

    outlines = [radius(a) * (1 + rng.uniform(-.023, .023)) for a in angles]
    cliff_rings = []
    profiles = ((1, -.22), (1.025, -1.15), (.89, -1.6), (.88, -3.35), (.60, -4.9), (.35, -6.4), (.10, -7.1))
    if not high:
        profiles = ((1, -.22), (1.01, -1.2), (.87, -3.0), (.57, -4.8), (.12, -6.8))
    for level, (fraction, z) in enumerate(profiles):
        ring = []
        for i, angle in enumerate(angles):
            fault = .045 * math.sin(i * 2.73 + level * 1.82) if level else 0
            horizontal = max(.045, fraction + fault)
            shift_x = sign * level * .16
            shift_y = .14 * level * math.sin(level * .8)
            ring.append((math.cos(angle) * 8 * outlines[i] * horizontal + shift_x,
                         math.sin(angle) * 6 * outlines[i] * horizontal + shift_y,
                         z + (0 if level == 0 else .23 * math.sin(i * 1.91 + level))))
        cliff_rings.append(ring)
    objects = [_surface(f"{variant}_broken_cliff_strata", cliff_rings, materials["rock"], cap_bottom=True)]

    # The meadow is a shallow plateau with a narrow folded turf lip. No smooth
    # hemisphere, no central elevation and no giant convex foreground mass.
    turf_outer, turf_inner = [], []
    for i, angle in enumerate(angles):
        x, y, _ = cliff_rings[0][i]
        turf_outer.append((x * 1.014, y * 1.014, -.27 + .045 * math.sin(i * 2.2)))
        turf_inner.append((x * .975, y * .975, .045 + .035 * math.sin(i * 1.6)))
    objects.append(_surface(f"{variant}_meadow_turf_rim", [turf_inner, turf_outer], materials["grass"]))
    # A center fan is planar at the castle footprint and softly faceted outside.
    verts = [(0, 0, 0)] + turf_inner
    faces = [(0, i + 1, (i + 1) % count + 1) for i in range(count)]
    objects.append(mesh(f"{variant}_flat_meadow", verts, faces, materials["grass"]))

    # Hanging buttresses break up the underside into distinct cliff columns.
    shard_count = 13 if high else 9 if detail == "balanced" else 6
    for i in range(shard_count):
        angle = math.tau * i / shard_count + .18
        x = math.cos(angle) * 6.55 * radius(angle)
        y = math.sin(angle) * 4.8 * radius(angle)
        depth = rng.uniform(2.9, 5.5)
        objects.append(_rock_shard(f"{variant}_hanging_rock_{i:02d}", x, y, -.9,
                                  rng.uniform(.67, 1.15), depth, materials["rock"], rng, detail))
        if high or i % 2 == 0:
            # Thin grass overhangs read as a moss/stone transition from above.
            patch = [(x + math.cos(j * math.tau / 7) * .85,
                      y + math.sin(j * math.tau / 7) * .65, -.78) for j in range(7)]
            objects.append(mesh(f"{variant}_moss_shelf_{i:02d}", patch,
                                [tuple(range(7))], materials["grass"]))

    # Small stepped shelves are intentionally asymmetric and sit below grade.
    terraces = [(-6.0, -2.5, -.28, 1.7, 1.25), (5.9, 1.5, -.42, 1.65, 1.15)] if variant == "left" else [(-5.9, -2.5, -.3, 2.2, 1.5), (5.8, -1.5, -.55, 1.5, 1.0), (-5.1, 3.4, -.22, 1.8, 1.0)]
    for i, (x, y, z, sx, sy) in enumerate(terraces):
        segments = 9 if high else 7
        top = [(x + math.cos(j * math.tau / segments) * sx,
                y + math.sin(j * math.tau / segments) * sy, z) for j in range(segments)]
        lower = [(x + (px - x) * .8, y + (py - y) * .8, z - .75) for px, py, _ in top]
        objects.append(_surface(f"{variant}_terrace_cliff_{i}", [top, lower], materials["rock"], cap_bottom=True))
        objects.append(mesh(f"{variant}_terrace_grass_{i}", top, [tuple(range(segments))], materials["grass"]))

    # Gently curved promenade from the entrance toward the village, plus a
    # separate carved channel whose last segment will meet animated water.
    path_points = [(-5.2, -2.6, .085), (-3.7, -3.0, .08), (-1.8, -3.3, .075),
                   (0, -3.35, .08), (1.8, -3.0, .07), (3.8, -2.4, .075), (5.8, -1.7, .08)]
    if variant == "right":
        path_points = [(x, y + .35 * math.sin(x), z) for x, y, z in path_points]
    objects.append(_path(f"{variant}_garden_promenade", path_points, [.6, .68, .72, .85, .72, .65, .5], materials["stone"]))
    # Face the falling water outward, away from the gameplay-board silhouette.
    water_sign = -sign
    channel = [(water_sign * 2.7, -1.5, .085), (water_sign * 3.6, -2.5, .07),
               (water_sign * 4.6, -3.4, .06), (water_sign * 5.5, -4.15, .04)]
    objects.append(_path(f"{variant}_watercourse_bed", channel, [.68, .78, .9, 1.02], materials["stone"]))
    for side in (-1, 1):
        bank = [(x + side * .42, y, z + .06) for x, y, z in channel]
        objects.append(tube(f"{variant}_channel_bank_{side}", bank, .075, materials["stone"], sides=5))
    mouth = channel[-1]
    objects.append(_empty(f"waterfall_origin_{variant}", mouth, width=1.02, semantic="waterfall_source", variant=variant))
    objects.append(_empty(f"waterfall_end_{variant}", (mouth[0] + water_sign * .5, mouth[1] - .65, -9.5), semantic="waterfall_end", variant=variant))

    # Moss runners hug the cliff rather than forming a heavy low green mound.
    vine_count = 15 if high else 9 if detail == "balanced" else 5
    for i in range(vine_count):
        angle = -math.pi + (i + .3) * math.tau / vine_count
        x, y = math.cos(angle) * 8 * radius(angle), math.sin(angle) * 6 * radius(angle)
        length = rng.uniform(.9, 2.7)
        points = [(x, y, -.15), (x * 1.015, y * 1.015, -.7),
                  (x * .99 + .1, y * .99, -length * .7), (x * .94, y * .94, -length)]
        objects.append(tube(f"{variant}_trailing_moss_{i:02d}", points,
                            [.075, .085, .06, .018], materials["grass"], sides=5 if high else 4))
    for obj in objects:
        obj["asset_module"] = "floating_island"
        obj["variant"] = variant
        if obj.type == "MESH":
            family = "rock" if obj.data.materials[0] == materials["rock"] else "grass" if obj.data.materials[0] == materials["grass"] else None
            if family:
                _tint(obj, family, seed + len(obj.name))
    return objects

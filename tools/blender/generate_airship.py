"""A reusable ribbed royal airship, authored entirely in Blender Python.

Envelope length is eight metres along local X; Z is up. The light gondola,
rigging, tapered fins and antique-gold ribs keep its distant silhouette legible.
"""
import math
from mathutils import Vector
from core import mesh, tube, box


def _fin(name, vertices, material, thickness=.035):
    """A thin closed bevel-free panel; silhouette detail without tiny polygons."""
    points = [Vector(point) for point in vertices]
    offset = (points[1]-points[0]).cross(points[2]-points[0]).normalized() * thickness / 2
    front = [point-offset for point in points]
    back = [point+offset for point in points]
    count = len(front)
    faces = [tuple(reversed(range(count))), tuple(count + i for i in range(count))]
    faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
    return mesh(name, front + back, faces, material)


def _envelope_ring(x, radius, count, vertical=.9):
    return [(x, math.cos(i * math.tau / count) * radius, .5 + math.sin(i * math.tau / count) * radius * vertical)
            for i in range(count)]


def generate_airship(materials, detail="high"):
    """Return unparented local airship objects; no animation/export side effects."""
    high = detail == "high"
    low = detail == "low"
    count = 20 if high else 16 if not low else 12
    profile = [(-4, .045), (-3.8, .48), (-3.35, .83), (-2.5, 1.13), (-1.2, 1.29),
               (0, 1.34), (1.2, 1.29), (2.5, 1.13), (3.35, .83), (3.8, .48), (4, .045)]
    if low:
        profile = [profile[i] for i in (0, 1, 3, 5, 7, 9, 10)]
    vertices = [point for x, radius in profile for point in _envelope_ring(x, radius, count)]
    faces = []
    for i in range(len(profile) - 1):
        for j in range(count):
            a, b = i * count + j, i * count + (j + 1) % count
            faces.append((a, b, b + count, a + count))
    faces += [tuple(reversed(range(count))), tuple((len(profile) - 1) * count + j for j in range(count))]
    objects = [mesh("Airship_embroidered_ivory_envelope", vertices, faces, materials["ivory"], smooth=True)]

    # Raised longitudinal seams join the crown and two narrow equatorial bands.
    # These actual ribs survive GLB export; no unsupported procedural shader.
    rib_count = 10 if high else 8
    for j in range(rib_count):
        angle = j * math.tau / rib_count
        points = [(x, math.cos(angle) * radius * 1.014,
                   .5 + math.sin(angle) * radius * .914) for x, radius in profile]
        objects.append(tube(f"Airship_gold_longitudinal_rib_{j:02d}", points,
                            .027 if high else .032, materials["gold"], sides=4 if high else 3))
    for index, x in enumerate((-2.5, 0, 2.5) if high else (-2.5, 2.5)):
        radius = 1.34 if x == 0 else 1.13
        points = _envelope_ring(x, radius * 1.018, count)
        points.append(points[0])
        objects.append(tube(f"Airship_gold_circumference_band_{index}", points,
                            .041, materials["gold"], sides=4 if high else 3))

    # Royal-blue fabric inserts form long tapered panels with gold edges. They
    # occupy a small part of the ivory envelope, preserving its lightness.
    for j, center in enumerate((0, math.pi)):
        strip_vertices = []
        for x, radius in profile:
            for angle in (center - .07, center + .07):
                strip_vertices.append((x, math.cos(angle) * radius * 1.012,
                                       .5 + math.sin(angle) * radius * .913))
        strip_faces = [(i * 2, i * 2 + 1, i * 2 + 3, i * 2 + 2) for i in range(len(profile) - 1)]
        objects.append(mesh(f"Airship_royal_blue_fabric_band_{j}", strip_vertices, strip_faces, materials["blue"], smooth=True))

    # A double-curved little boat hull replaces a box gondola. The tapered bow
    # and stern plus dark keel remain readable even when the asset is distant.
    hull_profile = [(-1.85, .035), (-1.45, .40), (-.65, .56), (.65, .56), (1.45, .40), (1.85, .035)]
    hull_rings = []
    for x, width in hull_profile:
        hull_rings += [(x, -width, -1.28), (x, -width * .9, -1.64),
                       (x, 0, -1.91), (x, width * .9, -1.64), (x, width, -1.28)]
    hull_faces = []
    for i in range(len(hull_profile) - 1):
        hull_faces += [(i * 5 + j, i * 5 + j + 1, (i + 1) * 5 + j + 1, (i + 1) * 5 + j) for j in range(4)]
    hull_faces += [(i * 5, (i + 1) * 5, (i + 1) * 5 + 4, i * 5 + 4) for i in range(len(hull_profile) - 1)]
    hull_faces += [tuple(reversed(range(5))), tuple((len(hull_profile) - 1) * 5 + j for j in range(5))]
    objects.append(mesh("Airship_curved_timber_gondola", hull_rings, hull_faces, materials["wood"], smooth=True))
    for side in (-1, 1):
        rail = [(x, side * width, -1.26) for x, width in hull_profile]
        objects.append(tube(f"Airship_gilded_gunwale_{side}", rail, .048, materials["gold"], sides=5 if high else 3))
        if not low:
            lower = [(x, side * width * .9, -1.6) for x, width in hull_profile]
            objects.append(tube(f"Airship_hull_strake_{side}", lower, .025, materials["gold"], sides=4))

    # Deck cabin, warm windows, decorative posts, and tensioned suspension.
    objects.append(box("Airship_deck_cabin", (0, 0, -1.14), (1.55, .78, .57), materials["ivory"], .06))
    objects.append(box("Airship_blue_cabin_roof", (0, 0, -.82), (1.72, .91, .13), materials["blue"], .055))
    for side in (-1, 1):
        for i, x in enumerate((-.48, 0, .48)):
            objects.append(box(f"Airship_warm_cabin_window_{side}_{i}", (x, side * .397, -1.11),
                               (.25, .024, .27), materials["window"], .025))
        for i, x in enumerate((-1.40, -.85, .85, 1.40)):
            objects.append(tube(f"Airship_suspension_{side}_{i}",
                                [(x * 1.08, side * .97, -.29), (x, side * .45, -1.26)],
                                .026, materials["wood"], sides=4 if high else 3))
    if high:
        objects.append(tube("Airship_bow_keel_accent", [(x, 0, -1.94) for x, _ in hull_profile], .033, materials["gold"], sides=4))

    # Two vertical and two horizontal tapered fins give a heraldic tail shape.
    fin = [(-3.05, 0, .73), (-4.55, 0, 1.93), (-4.35, 0, .57), (-3.62, 0, .35)]
    objects.append(_fin("Airship_dorsal_tail_fin", fin, materials["blue"]))
    lower_fin = [(x, y, 1 - z) for x, y, z in fin]
    objects.append(_fin("Airship_ventral_tail_fin", lower_fin, materials["blue"]))
    for side in (-1, 1):
        wing = [(-3.0, side * .28, .50), (-4.47, side * 1.55, .50),
                (-4.3, side * .22, .50), (-3.65, side * .08, .50)]
        objects.append(_fin(f"Airship_horizontal_tail_fin_{side}", wing, materials["blue"]))
    for label, contour in (("dorsal", fin), ("ventral", lower_fin)):
        objects.append(tube(f"Airship_gold_{label}_fin_trim", contour + [contour[0]],
                            .035, materials["gold"], sides=4 if high else 3))

    # A stylized propeller on the rear axis is static authored geometry; the
    # browser moves the whole craft slowly rather than adding another rig.
    objects.append(tube("Airship_propeller_axle", [(-4.0, 0, .5), (-4.75, 0, .5)], .10, materials["gold"], sides=8 if high else 6))
    for i in range(3):
        angle = i * math.tau / 3
        def blade_point(radius, offset):
            return (-4.64 + offset, math.cos(angle) * radius, .5 + math.sin(angle) * radius)
        blade = [blade_point(.12, 0), blade_point(.85, -.08),
                 blade_point(.96, .03), blade_point(.28, .10)]
        objects.append(_fin(f"Airship_wooden_propeller_blade_{i}", blade, materials["wood"], thickness=.02))
    for obj in objects:
        obj["asset_module"] = "fantasy_airship"
    return objects

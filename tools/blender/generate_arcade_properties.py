"""Author the four original Arcade property miniatures and their UI previews."""

import hashlib
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from core import arch_panel, box, lathe, mesh, reset_scene, transform_objects
from export_assets import export_glb


OUTPUT = HERE.parents[1] / "public/assets/models/arcade-properties"
SEED = 2408
PALETTE = (
    ("ivory", "ecd6b8", "Painted limestone"),
    ("trim", "fff0cf", "Painted limestone"),
    ("plinth", "a9958d", "Painted limestone"),
    ("slate", "2857a6", "Glazed slate"),
    ("navy", "183663", "Glazed slate"),
    ("timber", "6a3c33", "Painted limestone"),
    ("gold", "eab956", "Antique brass"),
    ("glass", "ffcc6f", "Lit glass"),
    ("fern", "337249", "Painted limestone"),
    ("lawn", "779b47", "Painted limestone"),
    ("blossom", "ee8ab5", "Painted limestone"),
    ("petal", "ffd0dd", "Painted limestone"),
    ("paving", "cbab88", "Painted limestone"),
    ("stone", "c6b2a4", "Painted limestone"),
)


def make_material(name, roughness, metalness=0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metalness
    return material, shader


def property_palette():
    """UV swatches collapse to five actual PBR primitives, sharing one image."""
    size, cell = 128, 32
    atlas = bpy.data.images.new("Arcade craft atlas", width=size, height=size, alpha=False)
    atlas.colorspace_settings.name = "sRGB"
    pixels = [0.5, 0.5, 0.5, 1.0] * (size * size)
    authored = {}
    runtime = {}
    for category, roughness, metalness in (
        ("Painted limestone", 0.72, 0),
        ("Glazed slate", 0.41, 0.08),
        ("Antique brass", 0.34, 0.52),
        ("Lit glass", 0.33, 0),
    ):
        material, shader = make_material(f"Arcade {category}", roughness, metalness)
        texture = material.node_tree.nodes.new("ShaderNodeTexImage")
        texture.image = atlas
        material.node_tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
        if category == "Lit glass":
            shader.inputs["Emission Color"].default_value = (1.0, 0.47, 0.10, 1.0)
            shader.inputs["Emission Strength"].default_value = 1.02
        runtime[category] = material
    owner, shader = make_material("Arcade owner pennant", 0.55)
    shader.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    authored["owner"] = owner
    remap = {owner: owner}

    for index, (name, hex_color, category) in enumerate(PALETTE):
        swatch = bpy.data.materials.new(f"UV {name}")
        swatch["atlas_index"] = index
        authored[name] = swatch
        remap[swatch] = runtime[category]
        rgb = tuple(int(hex_color[offset:offset + 2], 16) / 255 for offset in (0, 2, 4))
        rng = random.Random(SEED + index)
        for y in range(cell):
            for x in range(cell):
                grain = (rng.random() - 0.5) * 0.048
                if name in {"slate", "navy"}:
                    joint = y % 8 == 0 or (x + (y // 8 % 2) * 4) % 8 == 0
                    grain += -0.048 if joint else 0.015 * math.sin(y % 8 / 8 * math.pi)
                elif name in {"ivory", "stone", "plinth"}:
                    grain += -0.026 if y % 11 == 0 or (x + (y // 11 % 2) * 8) % 16 == 0 else 0
                elif name == "timber":
                    grain += 0.024 * math.sin(x * 1.1 + math.sin(y * 0.27))
                elif name == "glass":
                    grain += 0.075 * (1 - y / cell)
                px, py = index % 4 * cell + x, index // 4 * cell + y
                offset = (py * size + px) * 4
                pixels[offset:offset + 4] = [min(1, max(0, value + grain)) for value in rgb] + [1.0]
    atlas.pixels.foreach_set(pixels)
    atlas.update()
    atlas.pack()
    return authored, remap


def cut_rectangle(name, width, depth, bottom, top, material):
    x, y = width / 2, depth / 2
    chamfer = 0.053
    rim = [(-x + chamfer, -y), (x - chamfer, -y), (x, -y + chamfer), (x, y - chamfer),
           (x - chamfer, y), (-x + chamfer, y), (-x, y - chamfer), (-x, -y + chamfer)]
    vertices = [(x, y, z) for z in (bottom, top) for x, y in rim]
    faces = [tuple(reversed(range(8))), tuple(range(8, 16))]
    faces.extend((i, (i + 1) % 8, (i + 1) % 8 + 8, i + 8) for i in range(8))
    return mesh(name, vertices, faces, material)


def shrub(materials, position, radius, bloom=True):
    pieces = [lathe("Clipped boxwood", [(radius * .70, 0), (radius, radius * .68),
                    (radius * .73, radius * 1.28), (.005, radius * 1.44)], 7, materials["fern"], position)]
    if bloom:
        x, y, z = position
        for i in range(3):
            angle = i * math.tau / 3
            center = (x + math.cos(angle) * radius * .52, y + math.sin(angle) * radius * .52, z + radius * 1.10)
            petals = [(radius * .21, 0), (radius * .30, radius * .20), (.007, radius * .42)]
            pieces.append(lathe("Miniature blossom", petals, 5, materials["petal" if i == 1 else "blossom"], center))
    return pieces


def pennant(materials, x, y, z, height, size):
    banner = [(.007, 0), (size, 0), (size * .80, -size * .32), (size, -size * .68), (.007, -size * .68)]
    panel = [(x + dx, y + .015 * math.sin(dx / size * math.pi), z + height + dz) for dx, dz in banner]
    # The thin profile stays readable from both sides of the tabletop.
    vertices = [(a, b + depth, c) for depth in (-.004, .004) for a, b, c in panel]
    faces = [(0, 4, 3, 2, 1), (5, 6, 7, 8, 9)]
    faces.extend((i, (i + 1) % 5, (i + 1) % 5 + 5, i + 5) for i in range(5))
    return [
        lathe("Brass pennant staff", [(.019, 0), (.012, .025), (.009, height + .019)], 6, materials["gold"], (x, y, z)),
        lathe("Pennant finial", [(.009, 0), (.018, .013), (.006, .029)], 7, materials["gold"], (x, y, z + height)),
        mesh("Owner-color enamel pennant", vertices, faces, materials["owner"]),
    ]


def garden_plinth(materials, bright=True):
    pieces = [
        cut_rectangle("Cream terraced foundation", 1.475, .654, 0, .034, materials["plinth"]),
        cut_rectangle("Carved pale stone border", 1.431, .627, .034, .079, materials["trim"]),
        cut_rectangle("Inset planted lawn", 1.355, .567, .078, .096, materials["lawn"]),
    ]
    for side in (-1, 1):
        for x, y, radius in ((.609, -.195, .071), (.491, -.232, .061)):
            pieces.extend(shrub(materials, (side * x, y, .095), radius, bright))
    pieces.extend(pennant(materials, -.670, .152, .083, .294, .174))
    return pieces


def light_opening(materials, loc, width, height, *, door=False, rotation=0, bars=True):
    frame = materials["trim" if not door else "gold"]
    depth = .023 if door else .013
    pieces = [
        arch_panel("Moulded warm-stone arch", width + .032, height + .026, depth, (0, 0, -.007), frame, segments=7),
        arch_panel("Recessed amber window" if not door else "Lantern-lit oak portal", width, height,
                   depth, (0, -.010, 0), materials["glass" if not door else "timber"], segments=7),
        box("Dressed stone sill", (0, -.012, -.008), (width + .059, .051, .025), materials["stone"], .003),
    ]
    if bars:
        pieces.extend([
            box("Arched light central muntin", (0, -.023, height * .51), (.013, .009, height * .93), materials["gold"], 0),
            box("Arched light cross rail", (0, -.024, height * .54), (width, .012, .013), materials["gold"], 0),
        ])
    if door:
        pieces.extend([
            arch_panel("Portal amber fanlight", width * .65, height * .40, .011,
                       (0, -.024, height * .556), materials["glass"], segments=7),
            box("Carved brass door pull", (width * .24, -.024, height * .35), (.029, .016, .014), materials["gold"], 0),
        ])
    return transform_objects(pieces, loc, rotation=rotation)


def landing_stairs(materials, width, y):
    return [
        box("Shallow sculpted garden step", (0, y - .025, .110), (width + .10, .094, .029), materials["paving"], .008),
        box("Bright threshold step", (0, y, .136), (width, .076, .035), materials["trim"], .008),
    ]


def window_planter(materials, x, y, z):
    pieces = [box("Carved timber window planter", (x, y, z), (.160, .053, .047), materials["timber"], .006)]
    for dx in (-.046, .002, .046):
        pieces.append(lathe("Pink sill flowers", [(.025, 0), (.028, .020), (.013, .037)], 5,
                           materials["petal" if dx > 0 else "blossom"], (x + dx, y - .003, z + .025)))
    return pieces


def slate_gable(materials, center, length, width, rise, rotation=0):
    """Sagging eaves with a fitted ivory pediment and a capped long ridge."""
    half = width / 2
    contour = [(-half, -.025), (-half, .018), (-half * .70, rise * .40), (0, rise),
               (half * .70, rise * .40), (half, .018), (half, -.025), (0, rise - .052)]
    vertices = [(x, y, z) for x in (-length / 2, length / 2) for y, z in contour]
    count = len(contour)
    faces = [tuple(range(count)), tuple(reversed(range(count, count * 2)))]
    faces.extend((i, i + count, (i + 1) % count + count, (i + 1) % count) for i in range(count))
    pieces = [
        mesh("Swept glazed-slate cottage roof", vertices, faces, materials["slate"]),
        box("Tiled roof ridge cap", (0, 0, rise + .004), (length + .033, .046, .036), materials["navy"], .009),
    ]
    for side in (-1, 1):
        pieces.append(box("Deep fascia beneath copper eaves", (0, side * (half - .016), -.023),
                          (length + .005, .032, .041), materials["navy"], .005))
        pieces.append(box("Gilt fascia edge", (0, side * (half + .006), -.029),
                          (length + .012, .021, .016), materials["gold"], .003))
    return transform_objects(pieces, center, rotation=rotation)


def land(materials):
    pieces = garden_plinth(materials)
    pieces.append(cut_rectangle("Surveyed building foundation", .715, .316, .098, .119, materials["paving"]))
    for x in (-.205, 0, .205):
        pieces.append(box("Scored courtyard limestone", (x, .055, .124), (.171, .232, .016), materials["trim"], .005))
    for side in (-1, 1):
        for x, z in ((.145, .202), (.497, .184)):
            pieces.append(box("Estate entrance square pillar", (side * x, -.205, z), (.069, .067, 2 * (z - .094)), materials["ivory"]))
            pieces.append(box("Smartly capped pillar", (side * x, -.205, 2 * z - .078), (.087, .084, .035), materials["trim"], .008))
        for height in (.144, .230):
            pieces.append(box("Brass fence rails", (side * .322, -.204, height), (.31, .024, .016), materials["gold"], 0))
        for x in (.215, .281, .350, .422):
            pieces.append(box("Low estate palisade", (side * x, -.204, .185), (.024, .027, .141), materials["timber"], .004))
        pieces.extend(shrub(materials, (side * .54, .113, .097), .112, False))
    pieces.extend(landing_stairs(materials, .215, -.244))
    return pieces


def house(materials):
    pieces = garden_plinth(materials)
    pieces.extend([
        box("Ivory cottage body", (0, .043, .365), (1.015, .413, .536), materials["ivory"], .025),
        box("Stone skirting", (0, .043, .125), (1.057, .448, .066), materials["stone"], .009),
        box("Faceted projecting dormer", (-.067, -.113, .655), (.406, .237, .395), materials["trim"], .014),
        box("Brick chimney", (.324, .168, .888), (.145, .143, .398), materials["stone"], .012),
        box("Chimney copper coping", (.324, .168, 1.078), (.175, .165, .052), materials["gold"], .006),
    ])
    pieces.extend(slate_gable(materials, (0, .043, .639), 1.079, .481, .312))
    pieces.extend(slate_gable(materials, (-.067, -.077, .829), .372, .455, .225, math.pi / 2))
    pieces.extend(landing_stairs(materials, .250, -.232))
    pieces.extend(light_opening(materials, (0, -.173, .151), .170, .279, door=True, bars=False))
    pieces.extend(light_opening(materials, (-.067, -.236, .678), .114, .136))
    for side in (-1, 1):
        pieces.extend(light_opening(materials, (side * .305, -.171, .293), .155, .213))
        pieces.extend(window_planter(materials, side * .305, -.218, .269))
        pieces.extend(light_opening(materials, (side * .309, .255, .293), .155, .211, rotation=math.pi))
        pieces.extend(light_opening(materials, (side * .517, .043, .301), .145, .208, rotation=side * math.pi / 2))
        pieces.append(box("Gilt porch lantern", (side * .120, -.201, .353), (.031, .035, .070), materials["glass"], .007))
    return pieces


def mansard(materials, width, depth, base, height, center_y):
    rings = (
        (width, depth, base),
        (width * .98, depth * .97, base + .030),
        (width * .82, depth * .67, base + height * .73),
        (width * .65, depth * .42, base + height),
    )
    vertices = [(sx * w / 2, center_y + sy * d / 2, z) for w, d, z in rings
                for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    faces = [(0, 3, 2, 1), (12, 13, 14, 15)]
    for row in range(len(rings) - 1):
        for i in range(4):
            a, b = row * 4 + i, row * 4 + (i + 1) % 4
            faces.append((a, b, b + 4, a + 4))
    return [
        mesh("Mansard slate shell", vertices, faces, materials["slate"]),
        box("Continuous cream roof cornice", (0, center_y, base - .010), (width + .030, depth + .020, .036), materials["trim"], .006),
        box("Mansard gold cap", (0, center_y, base + height), (width * .68, depth * .44, .024), materials["gold"], .004),
    ]


def balcony(materials, x, h):
    pieces = [
        box("Private balcony platform", (x, -.222, h), (.305, .141, .032), materials["trim"], .006),
        box("Gilt balcony railing", (x, -.281, h + .086), (.289, .021, .015), materials["gold"], 0),
    ]
    for shift in (-.125, -.065, 0, .065, .125):
        pieces.append(box("Tapered bronze balcony picket", (x + shift, -.282, h + .045), (.014, .015, .083), materials["gold"], 0))
    pieces.append(box("Window flower box", (x, -.274, h + .029), (.147, .039, .042), materials["timber"], .007))
    for shift in (-.044, .001, .047):
        pieces.append(lathe("Balcony flower crowns", [(.025, 0), (.029, .019), (.013, .039)], 5,
                           materials["blossom"], (x + shift, -.276, h + .055)))
    return pieces


def apartment(materials):
    pieces = garden_plinth(materials)
    pieces.extend([
        box("Multi-storey limestone residence", (0, .047, .524), (1.135, .460, .850), materials["ivory"], .022),
        box("Dressed ashlar ground floor", (0, .047, .247), (1.173, .479, .296), materials["stone"], .018),
        box("Separate middle-floor cornice", (0, .047, .416), (1.189, .483, .035), materials["trim"], .007),
        box("Top-floor string course", (0, .047, .707), (1.176, .478, .028), materials["trim"], .006),
        box("Roof chimney cap", (.399, .193, 1.194), (.136, .105, .058), materials["plinth"], .008),
    ])
    pieces.extend(mansard(materials, 1.264, .538, .944, .324, .036))
    pieces.extend(landing_stairs(materials, .301, -.237))
    pieces.extend(light_opening(materials, (0, -.205, .150), .179, .228, door=True, bars=False))
    for x in (-.370, .370):
        pieces.extend(light_opening(materials, (x, -.205, .206), .151, .162))
        pieces.extend(light_opening(materials, (x, -.190, .473), .147, .184))
        pieces.extend(light_opening(materials, (x, -.190, .747), .152, .151))
        pieces.extend(light_opening(materials, (x, .286, .497), .155, .180, rotation=math.pi))
        pieces.extend(balcony(materials, x, .456))
    for x in (-.239, .239):
        pieces.append(box("Gabled roof dormer cheek", (x, -.120, 1.066), (.202, .176, .197), materials["trim"], .010))
        pieces.extend(slate_gable(materials, (x, -.118, 1.150), .193, .229, .095, math.pi / 2))
        pieces.extend(light_opening(materials, (x, -.213, 1.010), .102, .123, bars=False))
    for side in (-1, 1):
        x = side * .574
        pieces.append(box("Ivory corner quoin", (side * .546, -.183, .693), (.084, .050, .476), materials["trim"], .008))
        for height in (.455, .734):
            pieces.extend(light_opening(materials, (x, .030, height), .172, .147, rotation=side * math.pi / 2))
    return pieces


def hotel(materials):
    pieces = garden_plinth(materials)
    pieces.extend([
        box("Ivory hotel grand hall", (0, .055, .536), (1.095, .454, .882), materials["ivory"], .027),
        box("Squared gold hotel belt course", (0, .055, .620), (1.138, .469, .037), materials["gold"], .006),
        box("Grand portico facade", (0, -.177, .489), (.591, .160, .782), materials["trim"], .017),
        box("Gold capitals across portico", (0, -.239, .788), (.647, .139, .071), materials["gold"], .010),
        box("Layered portico pediment base", (0, -.234, .848), (.657, .141, .065), materials["trim"], .008),
    ])
    pieces.extend(mansard(materials, 1.111, .502, .957, .206, .048))
    pieces.extend(slate_gable(materials, (0, -.213, .903), .172, .644, .148, math.pi / 2))
    pieces.append(mesh("Gilded ornamental portico pediment",
                       [(-.268, -.296, .901), (.268, -.296, .901), (0, -.296, 1.032)],
                       [(0, 1, 2)], materials["trim"]))
    crest = box("Hotel sunstone crest", (0, -.303, .946), (.078, .024, .078), materials["gold"], .009)
    crest.rotation_euler.y = math.pi / 4
    pieces.append(crest)
    pieces.extend(landing_stairs(materials, .463, -.250))
    pieces.extend(light_opening(materials, (0, -.264, .151), .320, .495, door=True, bars=False))
    pieces.extend(light_opening(materials, (0, -.267, .675), .153, .091, bars=False))
    for side in (-1, 1):
        x = side * .538
        center = (x, -.023, 0)
        pieces.extend([
            lathe("Octagonal hotel guest tower", [(.176, .096), (.192, .189), (.165, .250), (.165, .938)],
                  8, materials["ivory"], center, smooth=False),
            lathe("Gold tower string courses", [(.182, .897), (.188, .911), (.176, .949)],
                  8, materials["gold"], center, smooth=False),
            lathe("Royal blue spire roof", [(.181, .947), (.177, .997), (.105, 1.166), (.067, 1.273), (.010, 1.401)],
                  8, materials["slate"], center),
            lathe("Spire brass finial", [(.016, 1.383), (.029, 1.414), (.005, 1.456)],
                  8, materials["gold"], center),
            lathe("Carved face column", [(.057, .129), (.046, .180), (.029, .211), (.029, .731), (.053, .768)],
                  8, materials["trim"], (side * .273, -.241, 0)),
            box("Aged brass entrance lantern", (side * .217, -.278, .339), (.049, .034, .095), materials["glass"], .010),
        ])
        for h in (.268, .477, .694):
            pieces.extend(light_opening(materials, (x, -.189, h), .104, .153))
            pieces.extend(light_opening(materials, (x * .70, .286, h), .102, .145, rotation=math.pi))
        pieces.extend(light_opening(materials, (side * .702, -.026, .575), .105, .193, rotation=side * math.pi / 2))
    drum = (0, .044, 0)
    pieces.extend([
        lathe("Round ivory lantern drum", [(.267, 1.061), (.269, 1.112), (.239, 1.150), (.234, 1.267)],
              12, materials["trim"], drum, smooth=False),
        lathe("Gilded dome eaves", [(.251, 1.241), (.268, 1.269), (.265, 1.301)],
              12, materials["gold"], drum),
        lathe("Royal blue octagonal dome", [(.265, 1.291), (.256, 1.350), (.193, 1.435), (.099, 1.512), (.022, 1.534)],
              12, materials["slate"], drum),
        lathe("Dome lantern gold finial", [(.030, 1.509), (.034, 1.550), (.055, 1.587), (.027, 1.616), (.009, 1.671)],
              10, materials["gold"], drum),
    ])
    for x in (-.112, 0, .112):
        window_y = .044 - math.sqrt(.235**2 - x**2)
        pieces.extend(light_opening(materials, (x, window_y, 1.145), .071, .090,
                                    bars=False, rotation=math.asin(x / .235)))
        pieces.extend(light_opening(materials, (x, .273, 1.150), .058, .084,
                                    bars=False, rotation=math.pi))
    return pieces


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def render_thumbnail(destination, owner_material):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 320, 280
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = str(destination)
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.use_nodes = True
    scene.world.node_tree.nodes.get("Background").inputs[0].default_value = (.44, .51, .64, 1)
    scene.world.node_tree.nodes.get("Background").inputs[1].default_value = .38
    camera = bpy.data.objects.new("Arcade model sheet camera", bpy.data.cameras.new("Estate comparison"))
    bpy.context.collection.objects.link(camera)
    camera.location = (2.6, -5.8, 3.0)
    point_at(camera, (0, 0, .691))
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 2.27
    scene.camera = camera
    for name, location, power, size, color in (
        ("Golden key", (-3.4, -4.8, 5.5), 530, 4.2, (1.0, .86, .72)),
        ("Cool bounce", (4.0, -2.5, 3.2), 367, 3.0, (.65, .78, 1.0)),
        ("Warm rim", (.5, 3.3, 4.7), 540, 3.2, (1.0, .77, .53)),
    ):
        lamp = bpy.data.lights.new(name, "AREA")
        lamp.energy, lamp.shape, lamp.size, lamp.color = power, "DISK", size, color
        light = bpy.data.objects.new(name, lamp)
        bpy.context.collection.objects.link(light)
        light.location = location
        point_at(light, (0, 0, .55))
    color = owner_material.node_tree.nodes.get("Principled BSDF").inputs["Base Color"]
    color.default_value = (.036, .149, .480, 1)
    bpy.ops.render.render(write_still=True)
    color.default_value = (1, 1, 1, 1)


def main():
    reset_scene()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    materials, remap = property_palette()
    assets = []
    for level, generate in enumerate((land, house, apartment, hotel)):
        reset_scene()
        name = generate.__name__
        pieces = generate(materials)
        for piece in pieces:
            piece.data.materials[0] = remap[piece.data.materials[0]]
        thumbnail = OUTPUT / f"{name}.png"
        render_thumbnail(thumbnail, materials["owner"])
        asset = export_glb(pieces, OUTPUT / f"{name}.glb", f"arcade-{name}", "shared", SEED,
                           {"development_level": level, "plot_front": "+Z"})
        asset["level"] = level
        asset["preview"] = thumbnail.name
        asset["previewSha256"] = hashlib.sha256(thumbnail.read_bytes()).hexdigest()
        assets.append(asset)
    manifest = {
        "schema": "monopoly.arcade-property-assets.v1",
        "source": "tools/blender/generate_arcade_properties.py",
        "authoringTool": f"Blender {bpy.app.version_string}",
        "license": "MIT (repository LICENSE)",
        "provenance": "Original parametric geometry, UV atlas and rendered previews. No external textures or geometry.",
        "profiles": "A single batched mesh per material per level. Low skips property shadows and particles; high adds contact shadows and a larger construction burst.",
        "assets": assets,
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

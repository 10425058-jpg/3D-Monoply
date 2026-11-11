"""Small deterministic Blender construction API. Blender Z-up, semantic front -Y.

All dimensions are in metres. Imports never reset a scene or run an export.
The ten shared textured PBR materials keep material batching predictable.
"""
import math
import random
import bpy
from mathutils import Vector


def reset_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def make_materials():
    palette = {
        "ivory": ("Ivory limestone", "e9dfc5", .76, 0),
        "stone": ("Carved sandstone", "b9b29c", .83, 0),
        "blue": ("Royal blue glazed slate", "315b9c", .43, .06),
        "gold": ("Brushed antique gold", "d1a950", .32, .7),
        "wood": ("Warm carved timber", "754832", .79, 0),
        "window": ("Warm lit glass", "ffd088", .36, 0),
        "grass": ("Meadow and moss", "71a35a", .96, 0),
        "rock": ("Lavender layered cliff", "837b91", .96, 0),
        "blossom": ("Sakura blossom clusters", "efa8cf", .91, 0),
        "leaf": ("Deep evergreen foliage", "40725b", .94, 0),
    }
    # One shared atlas, ten 32-pixel swatches, embedded by the glTF exporter.
    atlas = bpy.data.images.new("Kingdom_Surface_Atlas_128", width=128, height=128)
    # Blender 5.2 reallocates generated image pixels on a colour-space change.
    # Set the interpretation first, then fill and pack the final byte source.
    atlas.colorspace_settings.name = "sRGB"
    atlas_pixels = [.6, .6, .6, 1] * (128 * 128)
    materials = {}
    for index, (key, (label, color, roughness, metallic)) in enumerate(palette.items()):
        mat = bpy.data.materials.get(label) or bpy.data.materials.new(label)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        shader = nodes.get("Principled BSDF")
        rgb = [int(color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        mat.diffuse_color = (*rgb, 1)
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Metallic"].default_value = metallic
        if key == "window":
            shader.inputs["Emission Color"].default_value = (*rgb, 1)
            shader.inputs["Emission Strength"].default_value = 1.3
        # The export uses actual embedded UV textures rather than unsupported
        # procedural shader nodes. Low-amplitude colour variation preserves scale.
        rng = random.Random(8103 + index)
        tile_x, tile_y = (index % 4) * 32, (index // 4) * 32
        for y in range(32):
            for x in range(32):
                grain = (rng.random() - .5) * .055
                if key == "blue":
                    grain += -.035 if y % 16 < 2 else .012
                elif key == "wood":
                    grain += math.sin(y * .85 + math.sin(x * .12)) * .025
                elif key == "rock":
                    grain += math.sin(y * .44 + x * .035) * .035
                pixel = ((tile_y + y) * 128 + tile_x + x) * 4
                atlas_pixels[pixel:pixel + 4] = [max(0, min(1, channel + grain)) for channel in rgb] + [1]
        mat["atlas_index"] = index
        texture = nodes.new("ShaderNodeTexImage")
        texture.image = atlas
        texture.interpolation = "Linear"
        if key in {"blossom", "grass", "rock"}:
            tint = nodes.new("ShaderNodeVertexColor")
            tint.layer_name = "Color"
            multiply = nodes.new("ShaderNodeMixRGB")
            multiply.blend_type = "MULTIPLY"
            multiply.inputs[0].default_value = 1
            mat.node_tree.links.new(texture.outputs["Color"], multiply.inputs[1])
            mat.node_tree.links.new(tint.outputs["Color"], multiply.inputs[2])
            mat.node_tree.links.new(multiply.outputs[0], shader.inputs["Base Color"])
        else:
            mat.node_tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
        materials[key] = mat
    atlas.pixels.foreach_set(atlas_pixels)
    atlas.update()
    atlas.pack()
    # Aliases share the same data blocks and add no material slots/draw calls.
    for alias, key in {"stone_trim": "stone", "stone_dark": "rock", "roof": "blue", "roof_light": "blue",
                       "glass": "window", "pink": "blossom", "pink_light": "blossom", "pink_dark": "blossom",
                       "cliff": "rock", "moss": "grass", "foliage": "leaf", "terracotta": "wood"}.items():
        materials[alias] = materials[key]
    materials["trunk"] = materials["wood"]
    return materials


def uv_project(obj):
    """Planar face projection, deliberately repeating a tiny subtle surface map."""
    data = obj.data
    if not data.polygons:
        return obj
    uv = data.uv_layers.get("SurfaceUV") or data.uv_layers.new(name="SurfaceUV")
    data.uv_layers.active = uv
    uv.active_render = True
    index = int(data.materials[0].get("atlas_index", 0)) if data.materials else 0
    tile_x, tile_y = index % 4, index // 4
    bounds_min = [min(vertex.co[i] for vertex in data.vertices) for i in range(3)]
    bounds_max = [max(vertex.co[i] for vertex in data.vertices) for i in range(3)]
    for poly in data.polygons:
        normal = poly.normal
        axis = max(range(3), key=lambda i: abs(normal[i]))
        a, b = ((1, 2), (0, 2), (0, 1))[axis]
        for loop_index in poly.loop_indices:
            vertex = data.vertices[data.loops[loop_index].vertex_index].co
            u = (vertex[a] - bounds_min[a]) / max(.001, bounds_max[a] - bounds_min[a])
            v = (vertex[b] - bounds_min[b]) / max(.001, bounds_max[b] - bounds_min[b])
            uv.data[loop_index].uv = ((tile_x + .035 + u * .93) / 4, (tile_y + .035 + v * .93) / 4)
    return obj


def mesh(name, vertices, faces, material=None, location=(0, 0, 0), smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    if material is not None:
        data.materials.append(material)
        if material.name in {"Sakura blossom clusters", "Meadow and moss", "Lavender layered cliff"}:
            attribute = data.color_attributes.new(name="Color", type="BYTE_COLOR", domain="CORNER")
            for value in attribute.data:
                value.color = (1, 1, 1, 1)
    for polygon in data.polygons:
        polygon.use_smooth = smooth
    uv_project(obj)
    return obj


def box(name, location, scale, material, bevel=.04):
    x, y, z = (value / 2 for value in scale)
    obj = mesh(name, [(-x,-y,-z), (x,-y,-z), (x,y,-z), (-x,y,-z),
                      (-x,-y,z), (x,-y,z), (x,y,z), (-x,y,z)],
               [(0,3,2,1), (4,5,6,7), (0,1,5,4), (1,2,6,5), (2,3,7,6), (3,0,4,7)], material, location)
    if bevel > 0:
        modifier = obj.modifiers.new("Crafted bevel", "BEVEL")
        modifier.width = min(bevel, min(scale) * .22)
        modifier.segments = 1
        modifier.affect = "EDGES"
    return obj


def lathe(name, profile, segments, material, location=(0, 0, 0), smooth=True):
    vertices = [(radius * math.cos(i * math.tau / segments), radius * math.sin(i * math.tau / segments), z)
                for radius, z in profile for i in range(segments)]
    faces = []
    for ring in range(len(profile) - 1):
        for i in range(segments):
            a = ring * segments + i
            b = ring * segments + (i + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    faces.extend([tuple(reversed(range(segments))), tuple((len(profile) - 1) * segments + i for i in range(segments))])
    return mesh(name, vertices, faces, material, location, smooth)


def tube(name, points, radius, material, sides=6):
    """Polygonal tube following a polyline; no curve bevel/export conversion needed."""
    points = [Vector(p) for p in points]
    vertices = []
    for i, point in enumerate(points):
        tangent = (points[min(i + 1, len(points)-1)] - points[max(i - 1, 0)]).normalized()
        reference = Vector((0, 0, 1)) if abs(tangent.z) < .9 else Vector((1, 0, 0))
        u = tangent.cross(reference).normalized()
        v = tangent.cross(u).normalized()
        r = radius[i] if isinstance(radius, (tuple, list)) else radius
        for j in range(sides):
            vertices.append(point + (u * math.cos(j * math.tau / sides) + v * math.sin(j * math.tau / sides)) * r)
    faces = []
    for i in range(len(points) - 1):
        for j in range(sides):
            a = i * sides + j; b = i * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.extend([tuple(reversed(range(sides))), tuple((len(points)-1) * sides + j for j in range(sides))])
    return mesh(name, vertices, faces, material, smooth=True)


curve = tube


def arch(name, width, height, depth, location, material, thickness=.10, segments=12):
    """A genuinely open U-shaped arch surround, with top, sides and intrados."""
    radius = width / 2
    spring = height - radius
    inner = [(-radius, 0), (-radius, spring)]
    inner += [(math.cos(math.pi - i * math.pi / segments) * radius,
               spring + math.sin(math.pi - i * math.pi / segments) * radius) for i in range(1, segments + 1)]
    inner += [(radius, 0)]
    outer = [(-radius - thickness, 0), (-radius - thickness, spring)]
    outer += [(math.cos(math.pi - i * math.pi / segments) * (radius + thickness),
               spring + math.sin(math.pi - i * math.pi / segments) * (radius + thickness)) for i in range(1, segments + 1)]
    outer += [(radius + thickness, 0)]
    n = len(inner)
    vertices = [(x, y, z) for y in (-depth/2, depth/2) for contour in (inner, outer) for x, z in contour]
    faces = []
    for i in range(n - 1):
        faces.append((i, i+1, n+i+1, n+i))
        faces.append((2*n+i, 3*n+i, 3*n+i+1, 2*n+i+1))
        faces.append((i, 2*n+i, 2*n+i+1, i+1))
        faces.append((n+i, n+i+1, 3*n+i+1, 3*n+i))
    faces.extend([(0,n,3*n,2*n), (n-1,3*n-1,4*n-1,2*n-1)])
    return mesh(name, vertices, faces, material, location)


def arch_panel(name, width, height, depth, location, material, segments=10):
    radius = width / 2; spring = height - radius
    contour = [(-radius, 0), (radius, 0), (radius, spring)]
    contour += [(math.cos(i * math.pi / segments) * radius, spring + math.sin(i * math.pi / segments) * radius)
                for i in range(1, segments + 1)]
    vertices = [(x, y, z) for y in (-depth/2, depth/2) for x, z in contour]
    n = len(contour)
    faces = [tuple(range(n)), tuple(reversed(tuple(n+i for i in range(n))))]
    faces += [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
    return mesh(name, vertices, faces, material, location)


def transform_objects(objects, origin=(0,0,0), scale=1, rotation=0):
    """Apply a local module placement without adding empty scene nodes."""
    c, s = math.cos(rotation), math.sin(rotation)
    for obj in objects:
        x, y, z = obj.location
        obj.location = (origin[0] + (x*c-y*s)*scale, origin[1] + (x*s+y*c)*scale, origin[2] + z*scale)
        obj.rotation_euler.z += rotation
        obj.scale *= scale
    return objects

"""Small geometry tools for the four hand-profiled royal miniatures."""

import math
from collections import defaultdict
from math import cos, pi, sin

import bmesh
import bpy
import numpy as np
from mathutils import Vector


X = Vector((1, 0, 0))
Y = Vector((0, 1, 0))
Z = Vector((0, 0, 1))
PALETTE = {
    "Ivory porcelain": ("F1E6D5", .02, .34, 0),
    "Ivory feather": ("F1E6D5", .02, .38, 0),
    "Ivory shadow": ("DEC9B0", .02, .42, 0),
    "Satin enamel": ("244DA5", .04, .43, 0),
    "Velvet": ("2446A2", 0, .55, 0),
    "Midnight enamel": ("24376D", .05, .45, 0),
    "Upholstery": ("627DA7", 0, .58, 0),
    "Gilded brass": ("D4A63C", .52, .34, 0),
    "Recessed brass": ("AD8238", .53, .42, 0),
    "Sapphire": ("1444C2", .17, .18, 0),
    "Sapphire shade": ("123480", .21, .22, 0),
    "Sapphire light": ("407CF5", .12, .19, 0),
    "Eye": ("271913", .02, .16, 0),
    "Rose": ("D9937C", 0, .54, 0),
    "Ivory glint": ("FFF3DD", 0, .23, .09),
    "Lantern glass": ("FFDA7F", 0, .23, .75),
}
IVORY, FEATHER, CREAM, BLUE, VELVET, NAVY, SEAT, GOLD, BRASS, GEM, GEM_DARK, GEM_LIGHT, EYE, ROSE, GLINT, LAMP = PALETTE


def linear(hex_rgb):
    srgb = np.frombuffer(bytes.fromhex(hex_rgb), dtype=np.uint8).astype(float) / 255
    return np.where(srgb <= .04045, srgb / 12.92, ((srgb + .055) / 1.055) ** 2.4)


def curve(points, steps, closed=False):
    """Evaluate artist control points with interpolating smooth cubic segments."""
    rows = [np.array(point, dtype=float) for point in points]
    result = []
    for i, start in enumerate(rows if closed else rows[:-1]):
        preceding = rows[i - 1] if i or closed else 2 * rows[0] - rows[1]
        end = rows[(i + 1) % len(rows)]
        following = rows[(i + 2) % len(rows)] if i + 2 < len(rows) or closed else 2 * end - start
        for j in range(steps):
            t = j / steps
            result.append(.5 * ((2 * start) + (end - preceding) * t
                + (2 * preceding - 5 * start + 4 * end - following) * t**2
                + (3 * start - preceding - 3 * end + following) * t**3))
    if not closed:
        result.append(rows[-1])
    return result


def select(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


class Sculpt:
    def __init__(self, master):
        self.master = master
        self.steps = 5 if master else 3
        self.sides = 16 if master else 10
        self.materials = {}
        tile = 64 if master else 32
        size = 4 * tile
        pixels = np.ones((size, size, 4), dtype=np.float32)
        rng = np.random.default_rng(194)
        y, x = np.mgrid[:tile, :tile] / tile
        grain = rng.normal(0, .22, (tile, tile))
        for index, (name, (color, metal, rough, emissive)) in enumerate(PALETTE.items()):
            vibrance = .047 if name in (VELVET, SEAT, BLUE) else .022
            texture = np.clip(1 + vibrance * (
                .52 * np.cos(24 * pi * x) * np.sin(28 * pi * y)
                + .27 * np.sin(6 * pi * (x + y)) + grain
            ), .9, 1.1)
            row, column = divmod(index, 4)
            tint = linear(color)
            srgb = np.frombuffer(bytes.fromhex(color), dtype=np.uint8) / 255
            pixels[row*tile:(row+1)*tile, column*tile:(column+1)*tile, :3] = np.minimum(1,texture[:, :, None] * srgb)
            material = bpy.data.materials.new(name)
            material.diffuse_color = (*tint, 1)
            material.use_nodes = True
            shader = material.node_tree.nodes.get("Principled BSDF")
            shader.inputs["Metallic"].default_value = metal
            shader.inputs["Roughness"].default_value = rough
            if emissive:
                shader.inputs["Emission Color"].default_value = (*tint, 1)
                shader.inputs["Emission Strength"].default_value = emissive
            self.materials[name] = material
        atlas = bpy.data.images.new("Royal finishes | painted color atlas", size, size, alpha=False)
        atlas.pixels.foreach_set(pixels.ravel())
        atlas.pack()
        for material in self.materials.values():
            nodes = material.node_tree.nodes
            texture = nodes.new("ShaderNodeTexImage")
            texture.image = atlas
            material.node_tree.links.new(texture.outputs["Color"], nodes.get("Principled BSDF").inputs["Base Color"])

    def mesh(self, name, vertices, faces, material, flat=False):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        normal_mesh = bmesh.new()
        normal_mesh.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(normal_mesh, faces=list(normal_mesh.faces))
        normal_mesh.to_mesh(mesh)
        normal_mesh.free()
        mesh.materials.append(self.materials[material])
        for face in mesh.polygons:
            face.use_smooth = not flat
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        return obj

    def rings(self, name, rings, material, loop=False, ends=None):
        sides = len(rings[0])
        vertices = [vertex for ring in rings for vertex in ring]
        faces = []
        for i in range(len(rings) if loop else len(rings) - 1):
            this = i * sides
            following = ((i + 1) % len(rings)) * sides
            for j in range(sides):
                k = (j + 1) % sides
                faces.append((this + j, this + k, following + k, following + j))
        if not loop:
            for start, target in zip((0, (len(rings) - 1)*sides), ends or (None, None)):
                if target is None:
                    target = sum((Vector(v) for v in vertices[start:start+sides]), Vector()) / sides
                center = len(vertices)
                vertices.append(target)
                for j in range(sides):
                    faces.append((center, start + j, start + (j + 1) % sides))
        return self.mesh(name, vertices, faces, material)

    def sweep(self, name, points, material, guide=X, closed=False, steps=None, sides=None, ridge=0,
              face=None, channels=False):
        """Cambered ellipse sections in stable frames following a spatial path."""
        samples = curve(points, steps or self.steps, closed)
        sides = sides or self.sides
        rings = []
        last_frame = None
        for i, (x, y, z, w, h) in enumerate(samples):
            previous = samples[i - 1] if i or closed else samples[i]
            following = samples[(i + 1) % len(samples)] if i + 1 < len(samples) or closed else samples[i]
            origin = Vector((x, y, z))
            direction = Vector(following[:3] - previous[:3]).normalized()
            across = face.cross(direction) if face is not None else guide - direction * guide.dot(direction)
            weight = min(1,max(0,(across.length-.045)/.30))
            if across.length < .00001:
                reference = min((X, Y, Z), key=lambda axis: abs(axis.dot(direction)))
                across = reference - direction * reference.dot(direction)
            across.normalize()
            if last_frame is not None:
                previous_direction, previous_across = last_frame
                transported = previous_direction.rotation_difference(direction) @ previous_across
                if across.dot(transported) < 0:
                    across.negate()
                across = transported.lerp(across,weight).normalized()
            last_frame = direction, across
            normal = direction.cross(across)
            ring = []
            for j in range(sides):
                c, s = cos(2*pi*j/sides), sin(2*pi*j/sides)
                groove = (.13*math.exp(-((abs(c)-.48)/.14)**2)
                          + .12*math.exp(-((abs(c)-.79)/.10)**2)) if channels else 0
                ring.append(origin + across * max(w,.002)*c + normal * max(h,.002)*s * (1 + ridge*s**4 - groove))
            rings.append(ring)
        return self.rings(name, rings, material, loop=closed)

    def line(self, name, points, radius, material=GOLD, closed=False, guide=Z):
        return self.sweep(name, [(*p, radius, radius) for p in points], material, guide,
                          closed, steps=3 if self.master else 2, sides=12 if self.master else 8)

    def sectional(self, name, profiles, material, plane=(X, Y), exponent=1, sides=None):
        sides = sides or (48 if self.master else 32)
        rings = []
        for x, y, z, w, h in curve(profiles, self.steps):
            origin = Vector((x, y, z))
            ring = []
            for i in range(sides):
                angle = 2*pi*i/sides
                c, s = cos(angle), sin(angle)
                ring.append(origin + plane[0] * max(w, .002) * math.copysign(abs(c)**exponent, c)
                            + plane[1] * max(h, .002) * math.copysign(abs(s)**exponent, s))
            rings.append(ring)
        return self.rings(name, rings, material)

    def pebble(self, name, center, across, up, normal, widths, material, sides=None):
        """A shallow domed setting, bead, cushion or sculpted facial detail."""
        sides = sides or (24 if self.master else 16)
        center, across, up, normal = map(Vector, (center, across, up, normal))
        w, h, deep = widths
        rings = []
        for i in range(1, sides//2):
            latitude = pi*i/(sides//2)
            rings.append([
                center + normal*(deep*cos(latitude)) + sin(latitude)*(
                    across*w*cos(2*pi*j/sides) + up*h*sin(2*pi*j/sides))
                for j in range(sides)
            ])
        return self.rings(name, rings, material, ends=(center + normal*deep, center - normal*deep))

    def bead(self, name, center, radius, material=GOLD):
        return self.pebble(name, center, X, Z, Y, (radius, radius, radius), material)

    def relief(self, name, outline, center, across, up, normal, depth, material, rounded=True):
        """Closed cabochon or relief with a beveled perimeter."""
        center, across, up, normal = map(Vector, (center, across, up, normal))
        outline = curve(outline, 3, True) if rounded else outline
        bevels = ((.94, -.28), (1, .02), (.96, .56), (.80, .95), (.51, 1.08))
        rings = [[center + across*u*size + up*v*size + normal*depth*z
                  for u, v in outline] for size, z in bevels]
        return self.rings(name, rings, material)

    def feather(self, name, start, control, tip, width, thickness, material, normal, twist=0, blunt=False):
        """A curved flight feather with a softly rounded tip and a raised rachis."""
        start, control, tip, normal = map(Vector, (start, control, tip, normal))
        across = normal.cross(tip - start).normalized()
        tip_profile = ((.76,.95,.72),(.91,.73,.51),(.977,.36,.28),(1,.022,.049)) if blunt else (
            (.75,.83,.65),(.91,.45,.36),(.975,.15,.16),(1,.016,.04))
        profile = ((0,.13,.32),(.16,.62,.86),(.34,.94,1),(.55,1,.91)) + tip_profile
        points = []
        for t, section, depth in profile:
            point = (1-t)**2*start + 2*t*(1-t)*control + t**2*tip
            point += normal * twist * sin(pi*t)
            points.append((*point, width*section, thickness*depth))
        return self.sweep(name, points, material, across, steps=3 if self.master else 2,
                          sides=14 if self.master else 8, ridge=.21)

    def volute(self, name, center, across, up, radius, phase, material=GOLD, handedness=1):
        center, across, up = map(Vector, (center, across, up))
        points = []
        for i in range(13):
            t = i / 12
            angle = phase + handedness * t * 1.57 * pi
            radial = radius * (1 - .80*t)
            point = center + across*radial*cos(angle) + up*radial*sin(angle)
            points.append((*point, radius*(.22 - .11*t), radius*(.19 - .07*t)))
        return self.sweep(name, points, material, up.cross(across).normalized(), sides=12 if self.master else 8)

    def jewel(self, name, center, across, up, normal, width, height):
        center, across, up, normal = map(Vector, (center, across, up, normal))
        setting = [(0,height),(width,0),(0,-height),(-width,0)]
        outline = []
        for i, a in enumerate(setting):
            b = setting[(i+1)%4]
            outline.append((a[0]*.91+b[0]*.09,a[1]*.91+b[1]*.09))
            outline.append((a[0]*.09+b[0]*.91,a[1]*.09+b[1]*.91))
        self.rings(name + " • gilt bezel", [
            [center + across*u*r + up*v*r + normal*width*d for u,v in outline]
            for r,d in ((.86,-.21),(1,.03),(1,.22),(.894,.35),(.72,.30))
        ], GOLD)
        gem = [center + across*x*.71 + up*y*.71 + normal*width*.36 for x, y in setting]
        table = center + normal*width*.72 + up*height*.06
        for i, material in enumerate((GEM_LIGHT, GEM, GEM_DARK, GEM)):
            self.mesh(name + " • sapphire facet", [gem[i], gem[(i + 1) % 4], table,
                      center + normal*width*.26], [(0,1,2), (0,3,1), (0,2,3), (1,3,2)], material, flat=True)

    def fleur(self, name, center, across, up, normal, size):
        center, across, up, normal = map(Vector, (center, across, up, normal))
        def point(u, v):
            return center + across*(u*size) + up*(v*size)

        self.feather(name + " • lily", point(0, -.45), point(.08, .09), point(0, .69),
                     .15*size, .063*size, GOLD, normal)
        for side in (-1, 1):
            self.sweep(name + " • petals", [(*point(u*side, v), size*w, size*.059)
                for u, v, w in [(0, -.29, .09), (.15, -.03, .103), (.29, .12, .145),
                                (.46, .1, .132), (.48, -.12, .051), (.37, -.154, .014)]], GOLD, normal)
        self.pebble(name + " • tie", point(0, -.30) + normal*.021, across, up, normal,
                    (size*.22, size*.078, size*.057), GOLD)

    def laurel(self, name, center, across, up, normal, size, side):
        center, across, up, normal = map(Vector, (center, across, up, normal))
        def point(u, v):
            return center + across*(u*side*size) + up*(v*size)
        self.line(name + " • stem", [point(0, 0), point(.39, .19), point(.56, .54), point(.53, .83)], .028*size)
        for i in range(3):
            for sign in (-1, 1):
                root = point(.22 + i*.15, .10 + .20*i)
                tip = point(.27 + i*.13 + sign*.22, .53 + .18*i - sign*.09)
                self.feather(name + " • leaf", root, (root + tip)/2, tip, .09*size, .040*size, GOLD, normal)

    def tassel(self, name, x, y, z, scale=1):
        self.bead(name + " • cap", (x, y, z), .075*scale)
        profiles = [(0, .037), (-.072, .038), (-.135, .070), (-.218, .097), (-.24, .09)]
        rings = []
        sides = 42 if self.master else 28
        for depth, radius in curve(profiles, self.steps):
            rings.append([
                (x + scale*radius*cos(a)*(1 + .095*cos(7*a)),
                 y + scale*radius*sin(a)*(1 + .095*cos(7*a)), z + scale*depth)
                for a in (2*pi*j/sides for j in range(sides))
            ])
        self.rings(name + " • fluted skirt", rings, GOLD)

    def fuse(self, name, parts, voxel):
        select(parts)
        bpy.ops.object.join()
        obj = bpy.context.object
        obj.name = name
        obj.data.remesh_voxel_size = voxel
        bpy.ops.object.voxel_remesh()
        smoothing = obj.modifiers.new("Relax anatomical transitions", "SMOOTH")
        smoothing.factor = .74
        smoothing.iterations = 8
        bpy.ops.object.modifier_apply(modifier=smoothing.name)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        return obj

    def finish(self, name):
        parts = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
        for obj in parts:
            if not self.master:
                self.simplify(obj)
            for vert in obj.data.vertices:
                if name == "RoyalCarriage":
                    vert.co.x *= 1.11
                    continue
                # Broader collectible proportions with the same hoof and accessory contact surfaces.
                z = min(1,vert.co.z/1.2)
                vert.co.z -= (.16 if name == "RoyalGriffin" else .18)*z*z*(3-2*z)
                if name != "RoyalGriffin":
                    vert.co.x *= 1.14
                    vert.co.y *= .94
        vertices = np.array([tuple(v.co) for obj in parts for v in obj.data.vertices])
        lower, upper = vertices.min(axis=0), vertices.max(axis=0)
        pivot = Vector((*((lower[:2] + upper[:2]) / 2), lower[2]))
        height = float(upper[2] - lower[2])
        batches = defaultdict(list)
        for obj in parts:
            material = obj.data.materials[0].name
            self.unwrap(obj)
            if not self.master:
                material = {FEATHER: IVORY, GEM_DARK: GEM, GEM_LIGHT: GEM,
                            BRASS: GOLD}.get(material, material)
                obj.data.materials[0] = self.materials[material]
                batches[material].append(obj)
            for vert in obj.data.vertices:
                vert.co = (vert.co - pivot) / height
            obj.data.update()
        for material, batch in batches.items():
            if len(batch) > 1:
                select(batch)
                bpy.ops.object.join()
            batch[0].name = material

    def simplify(self, obj):
        triangles = sum(len(face.vertices) - 2 for face in obj.data.polygons)
        if triangles <= 180:
            return
        select([obj])
        reduction = obj.modifiers.new("Board silhouette mesh reduction", "DECIMATE")
        reduction.ratio = max(.31,115/triangles)
        bpy.ops.object.modifier_apply(modifier=reduction.name)

    def unwrap(self, obj):
        # A single embedded atlas. Every part stays inside its swatch including at low mip levels.
        mesh = obj.data
        index = list(self.materials).index(mesh.materials[0].name)
        row, col = divmod(index, 4)
        uv = mesh.uv_layers.new(name="Royal finish").data
        coords = np.array([tuple(v.co) for v in mesh.vertices])
        lower, extent = coords.min(axis=0), np.ptp(coords, axis=0)
        axes = np.argsort(extent)[-2:]
        normalized = np.divide(coords[:, axes] - lower[axes], np.maximum(extent[axes], .0001))
        for loop in mesh.loops:
            u, v = normalized[loop.vertex_index]
            uv[loop.index].uv = ((col + .15 + .7*u)/4, (row + .15 + .7*v)/4)

"""Inspect real GLB bytes without Blender, third-party packages, or a renderer.

Checks the exported artifact, not generator source text. Run with ordinary Python:
    python tools/blender/validate_assets.py
    python tools/blender/validate_assets.py path/to/model.glb --output report.json
The JSON report includes SHA-256 hashes, actual indexed triangle counts, bounds,
PBR/material/image budgets, and texture memory estimates for review.
"""
from __future__ import annotations

import argparse
import base64
import binascii
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
import zlib


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DIRECTORY = ROOT / "public/assets/models/environment"
COMPONENTS = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2),
              5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
WIDTHS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4,
          "MAT2": 4, "MAT3": 9, "MAT4": 16}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def image_dimensions(data):
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        require(len(data) >= 24 and data[12:16] == b"IHDR", "invalid PNG header")
        return struct.unpack_from(">II", data, 16)
    if data[:2] == b"\xff\xd8":
        offset = 2
        while offset + 4 <= len(data):
            if data[offset] != 255:
                offset += 1
                continue
            marker = data[offset + 1]
            offset += 2
            if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
                continue
            size = struct.unpack_from(">H", data, offset)[0]
            require(size >= 2, "invalid JPEG segment")
            if marker in (0xC0, 0xC1, 0xC2):
                height, width = struct.unpack_from(">HH", data, offset + 3)
                return width, height
            offset += size
    raise ValueError("unsupported or invalid embedded texture; expected PNG or JPEG")


def png_statistics(data):
    """Decode PNG scanline filters to catch a valid-but-black Blender atlas.

    Dimensions and nonempty image bytes alone do not prove that a generated
    texture exported correctly. No Pillow installation is needed for this gate.
    """
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        return None, None
    width, height, bits, kind, _, _, interlace = struct.unpack_from(">IIBBBBB", data, 16)
    require(bits == 8 and kind in (0, 2, 4, 6) and interlace == 0,
            "expected non-interlaced 8-bit RGB/RGBA/gray atlas PNG")
    channels = {0: 1, 2: 3, 4: 2, 6: 4}[kind]
    compressed, offset = bytearray(), 8
    while offset < len(data):
        require(offset + 12 <= len(data), "truncated PNG chunk")
        size = struct.unpack_from(">I", data, offset)[0]
        chunk_type = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + size]
        require(offset + 12 + size <= len(data), "PNG chunk exceeds image")
        checksum = struct.unpack_from(">I", data, offset + 8 + size)[0]
        require(binascii.crc32(chunk_type + payload) & 0xFFFFFFFF == checksum, "PNG CRC mismatch")
        if chunk_type == b"IDAT":
            compressed.extend(payload)
        offset += 12 + size
    raw = zlib.decompress(compressed)
    stride = width * channels
    require(len(raw) == height * (stride + 1), "PNG scanline length mismatch")
    previous, colors, rows = bytearray(stride), set(), []
    channel_min, channel_max = [255] * channels, [0] * channels
    for row in range(height):
        filter_kind = raw[row * (stride + 1)]
        require(filter_kind <= 4, "invalid PNG row filter")
        encoded = raw[row * (stride + 1) + 1:(row + 1) * (stride + 1)]
        decoded = bytearray(stride)
        for index, value in enumerate(encoded):
            left = decoded[index-channels] if index >= channels else 0
            above = previous[index]
            upper_left = previous[index-channels] if index >= channels else 0
            if filter_kind == 1:
                value += left
            elif filter_kind == 2:
                value += above
            elif filter_kind == 3:
                value += (left + above) // 2
            elif filter_kind == 4:
                estimate = left + above - upper_left
                distances = [abs(estimate-candidate) for candidate in (left, above, upper_left)]
                value += (left, above, upper_left)[distances.index(min(distances))]
            decoded[index] = value & 255
        for pixel in range(width):
            color = tuple(decoded[pixel * channels:(pixel + 1) * channels])
            colors.add(color)
            for channel, value in enumerate(color):
                channel_min[channel] = min(channel_min[channel], value)
                channel_max[channel] = max(channel_max[channel], value)
        previous = decoded
        rows.append(decoded)
    require(len(colors) > 1, "exported atlas is constant/black; generated pixels were lost")
    if kind in (4, 6):
        require(channel_max[-1] > 0, "exported atlas is entirely transparent")
    return {"uniqueColors": len(colors), "channelMin": channel_min, "channelMax": channel_max}, (rows, channels)


def identity():
    return [[float(row == col) for col in range(4)] for row in range(4)]


def multiply(a, b):
    return [[sum(a[row][n] * b[n][col] for n in range(4)) for col in range(4)] for row in range(4)]


def transform(node):
    if "matrix" in node:
        require(not any(key in node for key in ("translation", "rotation", "scale")), "node mixes matrix and TRS")
        values = node["matrix"]
        require(len(values) == 16 and all(math.isfinite(v) for v in values), "invalid node matrix")
        return [[values[col * 4 + row] for col in range(4)] for row in range(4)]
    translation = node.get("translation", [0, 0, 0])
    scale = node.get("scale", [1, 1, 1])
    quaternion = node.get("rotation", [0, 0, 0, 1])
    require(len(translation) == 3 and len(scale) == 3 and len(quaternion) == 4, "invalid node TRS dimensions")
    require(all(math.isfinite(v) for v in translation + scale + quaternion), "non-finite node TRS")
    require(all(v > 0 for v in scale), "negative or zero node scale")
    x, y, z, w = quaternion
    require(abs(sum(v*v for v in quaternion) - 1) < .001, "non-unit node quaternion")
    rotation = [[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]]
    return [[rotation[row][col] * scale[col] if col < 3 else translation[row] for col in range(4)]
            for row in range(3)] + [[0, 0, 0, 1]]


class GLB:
    def __init__(self, filename):
        self.path = Path(filename)
        self.raw = self.path.read_bytes()
        require(len(self.raw) >= 28, "GLB shorter than header + JSON chunk")
        magic, version, length = struct.unpack_from("<4sII", self.raw)
        require(magic == b"glTF", "invalid GLB magic")
        require(version == 2, "only GLB 2 is supported")
        require(length == len(self.raw), "GLB declared length does not match file")
        chunks, offset = [], 12
        while offset < length:
            require(offset + 8 <= length, "truncated GLB chunk header")
            size, kind = struct.unpack_from("<II", self.raw, offset)
            require(size % 4 == 0, "chunk length is not 4-byte aligned")
            offset += 8
            require(offset + size <= length, "GLB chunk exceeds file")
            chunks.append((kind, self.raw[offset:offset + size]))
            offset += size
        require(chunks[0][0] == 0x4E4F534A, "first GLB chunk must be JSON")
        require(len(chunks) == 2 and chunks[1][0] == 0x004E4942, "expected one JSON and one BIN chunk")
        self.doc = json.loads(chunks[0][1].rstrip(b" \0"))
        self.binary = chunks[1][1]
        self.cache = {}

    def view(self, index):
        views = self.doc.get("bufferViews", [])
        require(isinstance(index, int) and 0 <= index < len(views), "invalid bufferView reference")
        view = views[index]
        require(view.get("buffer", 0) == 0, "bufferView references external buffer")
        offset, length = view.get("byteOffset", 0), view["byteLength"]
        require(isinstance(offset, int) and isinstance(length, int) and offset >= 0 and length > 0,
                "invalid bufferView byte range")
        require(offset + length <= self.doc["buffers"][0]["byteLength"], "bufferView exceeds BIN buffer")
        return view, memoryview(self.binary)[offset:offset + length]

    def accessor(self, index):
        if index in self.cache:
            return self.cache[index]
        accessors = self.doc.get("accessors", [])
        require(isinstance(index, int) and 0 <= index < len(accessors), "invalid accessor reference")
        accessor = accessors[index]
        require("sparse" not in accessor, "sparse accessors are outside this uncompressed export contract")
        require(accessor["componentType"] in COMPONENTS and accessor["type"] in WIDTHS, "invalid accessor format")
        require(isinstance(accessor["count"], int) and accessor["count"] > 0, "empty or invalid accessor")
        fmt, size = COMPONENTS[accessor["componentType"]]
        count, width = accessor["count"], WIDTHS[accessor["type"]]
        view, data = self.view(accessor["bufferView"])
        offset = accessor.get("byteOffset", 0)
        matrix_width = int(math.sqrt(width)) if accessor["type"].startswith("MAT") else 0
        column_stride = ((matrix_width * size + 3) // 4 * 4) if matrix_width else 0
        element_size = column_stride * matrix_width if matrix_width else width * size
        stride = view.get("byteStride", element_size)
        require(isinstance(offset, int) and offset >= 0 and offset % size == 0, "invalid accessor byteOffset")
        require(stride >= element_size and stride % size == 0, "invalid accessor stride")
        require(offset + (count - 1) * stride + element_size <= len(data), "accessor exceeds bufferView")
        if matrix_width:
            offsets = [col * column_stride + row * size for col in range(matrix_width) for row in range(matrix_width)]
        else:
            offsets = [i * size for i in range(width)]
        values = [tuple(struct.unpack_from("<" + fmt, data, offset + item * stride + component)[0]
                        for component in offsets) for item in range(count)]
        require(all(math.isfinite(value) for vector in values for value in vector), "non-finite accessor data")
        for key, reducer in (("min", min), ("max", max)):
            if key in accessor:
                actual = [reducer(vector[axis] for vector in values) for axis in range(width)]
                require(len(accessor[key]) == width and all(abs(a-b) <= max(.0001, abs(a) * .00001)
                        for a, b in zip(actual, accessor[key])), f"accessor {index} declared {key} differs from bytes")
        self.cache[index] = values
        return values

    def inspect(self):
        doc = self.doc
        require(doc.get("asset", {}).get("version") == "2.0", "glTF version must be 2.0")
        require(len(doc.get("buffers", [])) == 1 and "uri" not in doc["buffers"][0], "GLB must embed its single geometry buffer")
        require(0 <= len(self.binary) - doc["buffers"][0]["byteLength"] <= 3, "BIN length/padding mismatch")
        require(not doc.get("cameras") and not doc.get("animations") and not doc.get("skins"), "static environment asset contains camera, animation or skin")
        require("KHR_lights_punctual" not in doc.get("extensionsUsed", []), "static asset exports lights")
        require(not doc.get("extensionsRequired"), "unexpected required decoder or extension")
        require(len(self.raw) <= 3 * 1024 * 1024, "asset exceeds 3 MiB budget")
        for index in range(len(doc.get("bufferViews", []))):
            self.view(index)
        for index in range(len(doc.get("accessors", []))):
            self.accessor(index)
        materials = doc.get("materials", [])
        require(0 < len(materials) <= 12, "material budget is 1..12")
        images, decoded_images, used_image_colors = [], [], {}
        for image in doc.get("images", []):
            if "bufferView" in image:
                _, data = self.view(image["bufferView"])
                data = bytes(data)
            else:
                uri = image.get("uri", "")
                require(uri.startswith("data:image/") and ";base64," in uri, "texture URI is not embedded")
                data = base64.b64decode(uri.split(",", 1)[1], validate=True)
            width, height = image_dimensions(data)
            require(0 < width <= 256 and 0 < height <= 256, "texture dimension exceeds 256px budget")
            statistics, decoded = png_statistics(data)
            decoded_images.append(decoded)
            images.append({"name": image.get("name"), "width": width, "height": height, "bytes": len(data),
                           "pixels": statistics})
        require(len(images) <= 12 and sum(image["width"] * image["height"] for image in images) <= 256*256*12,
                "embedded texture pixel budget exceeded")
        textures = doc.get("textures", [])
        for texture in textures:
            require(0 <= texture.get("source", -1) < len(images), "invalid image reference")
        for material in materials:
            pbr = material.get("pbrMetallicRoughness", {})
            require(0 <= pbr.get("roughnessFactor", 1) <= 1 and 0 <= pbr.get("metallicFactor", 1) <= 1,
                    "PBR scalar outside 0..1")
            for owner in (material, pbr):
                for name, value in owner.items():
                    if name.endswith("Texture"):
                        require(0 <= value.get("index", -1) < len(textures), "invalid material texture reference")
        mesh_stats, local_bounds, primitive_count = [], [], 0
        for mesh in doc.get("meshes", []):
            positions, triangles = [], 0
            for primitive in mesh["primitives"]:
                primitive_count += 1
                require(primitive.get("mode", 4) == 4, "only triangle primitives are admitted")
                require(not primitive.get("extensions"), "compressed primitive not supported by this export contract")
                require(0 <= primitive.get("material", -1) < len(materials), "invalid primitive material")
                attributes = primitive["attributes"]
                require("POSITION" in attributes and "NORMAL" in attributes, "mesh requires positions and normals")
                position_accessor = doc["accessors"][attributes["POSITION"]]
                require(position_accessor["type"] == "VEC3" and position_accessor["componentType"] == 5126,
                        "positions must be float VEC3")
                require("min" in position_accessor and "max" in position_accessor, "position accessor needs declared bounds")
                vertices = self.accessor(attributes["POSITION"])
                require(len(vertices) == len(self.accessor(attributes["NORMAL"])), "normal count mismatch")
                for attribute in attributes.values():
                    require(len(self.accessor(attribute)) == len(vertices), "vertex attribute count mismatch")
                material = materials[primitive["material"]]
                color_texture = material.get("pbrMetallicRoughness", {}).get("baseColorTexture")
                if color_texture:
                    require("TEXCOORD_0" in attributes, "textured primitive has no UVs")
                    image_index = textures[color_texture["index"]]["source"]
                    decoded = decoded_images[image_index]
                    if decoded:
                        rows, channels = decoded
                        image_report = images[image_index]
                        uv_index = attributes.get(f"TEXCOORD_{color_texture.get('texCoord', 0)}")
                        require(uv_index is not None, "material requests a missing UV channel")
                        uv_values = self.accessor(uv_index)
                        sampled = used_image_colors.setdefault(image_index, set())
                        # Sampling actual referenced UV texels prevents unused gray
                        # atlas padding from hiding a black or blank material tile.
                        for u, v in uv_values:
                            x = min(image_report["width"]-1, max(0, int(u * image_report["width"])))
                            # glTF UV origin is the image's top-left; Blender's
                            # exporter has already inverted its authoring V axis.
                            y = min(image_report["height"]-1, max(0, int(v * image_report["height"])))
                            sampled.add(tuple(rows[y][x * channels:x * channels + min(3, channels)]))
                if "indices" in primitive:
                    index_accessor = doc["accessors"][primitive["indices"]]
                    require(index_accessor["type"] == "SCALAR" and index_accessor["componentType"] in (5121, 5123, 5125), "invalid index format")
                    indices = self.accessor(primitive["indices"])
                    require(all(0 <= value[0] < len(vertices) for value in indices), "index references missing vertex")
                    count = len(indices)
                else:
                    count = len(vertices)
                require(count % 3 == 0, "triangle index/vertex count not divisible by 3")
                triangles += count // 3
                positions.extend(vertices)
            require(positions, "empty mesh")
            local_bounds.append(([min(v[axis] for v in positions) for axis in range(3)],
                                 [max(v[axis] for v in positions) for axis in range(3)]))
            mesh_stats.append({"name": mesh.get("name"), "triangles": triangles, "primitives": len(mesh["primitives"])})
        require(mesh_stats, "no exported mesh")
        for image_index, colors in used_image_colors.items():
            require(len(colors) > 3 and max(max(color) for color in colors) > 5,
                    "referenced atlas texels are blank/black or lack expected procedural color variation")
            images[image_index]["referencedTexelColors"] = len(colors)
        nodes = doc.get("nodes", [])
        scene_index = doc.get("scene", 0)
        require(0 <= scene_index < len(doc.get("scenes", [])), "invalid default scene")
        roots = doc["scenes"][scene_index].get("nodes", [])
        require(roots, "empty default scene")
        bounds_min, bounds_max = [math.inf] * 3, [-math.inf] * 3
        used, instance_triangles, drawn_primitives = set(), 0, 0

        def visit(index, parent, ancestors):
            nonlocal instance_triangles, drawn_primitives
            require(isinstance(index, int) and 0 <= index < len(nodes), "invalid node reference")
            require(index not in ancestors, "node hierarchy cycle")
            require(index not in used, "node is attached to multiple parents")
            used.add(index)
            node = nodes[index]
            world = multiply(parent, transform(node))
            if "mesh" in node:
                mesh_index = node["mesh"]
                require(0 <= mesh_index < len(mesh_stats), "invalid mesh reference")
                instance_triangles += mesh_stats[mesh_index]["triangles"]
                drawn_primitives += mesh_stats[mesh_index]["primitives"]
                lower, upper = local_bounds[mesh_index]
                for mask in range(8):
                    point = [upper[axis] if mask & (1 << axis) else lower[axis] for axis in range(3)] + [1]
                    converted = [sum(world[row][col] * point[col] for col in range(4)) for row in range(3)]
                    for axis, value in enumerate(converted):
                        bounds_min[axis] = min(bounds_min[axis], value)
                        bounds_max[axis] = max(bounds_max[axis], value)
            for child in node.get("children", []):
                visit(child, world, ancestors | {index})

        for root_index in roots:
            root = nodes[root_index]
            # Assets are authored around their local placement origin; conversion
            # is baked by the exporter, so runtime does not guess a scale factor.
            anchor = root.get("extras", {}).get("role") == "effect-anchor" and "mesh" not in root and not root.get("children")
            require(anchor or root.get("translation", [0, 0, 0]) == [0, 0, 0], "root mesh origin must be zero")
            require(root.get("scale", [1, 1, 1]) == [1, 1, 1], "root scale must be applied")
            visit(root_index, identity(), set())
        require(len(used) == len(nodes), "unreachable exported nodes")
        extent = [b-a for a, b in zip(bounds_min, bounds_max)]
        require(all(math.isfinite(v) for v in bounds_min + bounds_max), "invalid world bounds")
        require(max(abs(v) for v in bounds_min + bounds_max) < 128, "model dimensions exceed local environment scale")
        name = self.path.stem
        if name.startswith("royal-island"):
            budget = 8000 if "distant" in name else 16000 if "low" in name else 25000 if "balanced" in name else 40000
            require(8 <= extent[0] <= 40 and 5 <= extent[2] <= 40 and 3 <= extent[1] <= 32,
                    "island export bounds do not match metre-scale authored footprint")
            require(bounds_min[1] < 0 < bounds_max[1], "island origin must sit between cliff underside and architecture")
            require(abs((bounds_min[0] + bounds_max[0]) / 2) < extent[0] * .25 and
                    abs((bounds_min[2] + bounds_max[2]) / 2) < extent[2] * .25, "island placement origin is not centered")
        elif name.startswith("fantasy-airship"):
            budget = 4000 if "low" in name else 6000
            require(2 <= max(extent) <= 20, "airship has incorrect metre scale")
        elif name.startswith("royal-castle"):
            budget = 8000 if "low" in name else 20000
            require(3 <= max(extent) <= 20, "castle has incorrect metre scale")
        else:
            budget = 12000
            require(.1 <= max(extent) <= 30, "prop has incorrect metre scale")
        require(instance_triangles <= budget, f"triangle budget exceeded: {instance_triangles} > {budget}")
        require(drawn_primitives <= 24, "asset exceeds 24 primitive draw budget")
        return {
            "file": self.path.name, "bytes": len(self.raw), "sha256": hashlib.sha256(self.raw).hexdigest(),
            "triangles": instance_triangles, "triangleBudget": budget, "drawPrimitives": drawn_primitives,
            "meshes": mesh_stats, "nodes": len(nodes), "materials": len(materials),
            "materialNames": [material.get("name") for material in materials], "images": images,
            "textureRgbaBytes": sum(image["width"] * image["height"] * 4 for image in images),
            "textureRgbaMipBytes": math.ceil(sum(image["width"] * image["height"] * 4 for image in images) * 4 / 3),
            "bounds": {"min": bounds_min, "max": bounds_max, "extent": extent},
            "rootTransforms": [{"name": nodes[index].get("name"), "translation": nodes[index].get("translation", [0, 0, 0]),
                                "scale": nodes[index].get("scale", [1, 1, 1])} for index in roots],
            "valid": True,
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", type=Path, nargs="*", help="GLB files, defaults to generated environment directory")
    parser.add_argument("--output", type=Path, help="write the complete inspection JSON")
    parser.add_argument("--manifest", type=Path, help="verify generation receipt names, byte counts, triangles, hashes and bounds")
    args = parser.parse_args()
    files = args.files or sorted(DEFAULT_DIRECTORY.glob("*.glb"))
    require(files, f"no generated GLB artifacts found in {DEFAULT_DIRECTORY}")
    results, failures = [], []
    for filename in files:
        try:
            results.append(GLB(filename).inspect())
        except (ValueError, KeyError, TypeError, IndexError, struct.error, zlib.error, OSError) as error:
            failures.append({"file": str(filename), "error": str(error), "valid": False})
    if args.manifest:
        try:
            manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
            receipts = manifest["assets"]
            require(len({receipt["file"] for receipt in receipts}) == len(receipts), "manifest has duplicate filenames")
            inspected = {asset["file"]: asset for asset in results}
            for receipt in receipts:
                require(receipt["file"] in inspected, f"manifest artifact was not validated: {receipt['file']}")
                artifact = inspected[receipt["file"]]
                for key in ("bytes", "sha256", "triangles"):
                    require(receipt[key] == artifact[key], f"manifest {key} differs from artifact bytes: {receipt['file']}")
                require(receipt.get("origin") == [0, 0, 0], f"manifest origin is not zero: {receipt['file']}")
                for key in ("min", "max"):
                    require(all(abs(a-b) < .001 for a, b in zip(receipt["bounds"][key], artifact["bounds"][key])),
                            f"manifest bounds differ from artifact: {receipt['file']}")
        except (ValueError, KeyError, TypeError, OSError) as error:
            failures.append({"file": str(args.manifest), "error": str(error), "valid": False})
    report = {"schema": "monopoly.environment-glb-inspection.v1", "valid": not failures,
              "assets": results, "failures": failures}
    encoded = json.dumps(report, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded + "\n", encoding="utf-8")
    print(encoded)
    return 1 if failures else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except ValueError as error:
        print(json.dumps({"valid": False, "error": str(error)}))
        sys.exit(1)

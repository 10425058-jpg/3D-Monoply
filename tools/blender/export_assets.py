"""Evaluate authoring modifiers and export portable, material-batched GLBs.

Authoring remains Blender Z-up. The official glTF exporter converts to Y-up;
runtime assets must not receive another 90-degree correction.
"""
import hashlib
from pathlib import Path
import bpy
from mathutils import Matrix


def export_glb(objects, destination, asset_id, detail, seed, metadata=None):
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    staging = []
    anchors = {}
    for source in objects:
        if source.type == "EMPTY":
            point = source.matrix_world.translation
            anchors[source.name] = [round(point.x, 6), round(point.z, 6), round(-point.y, 6)]
            clone = bpy.data.objects.new(source.name, None)
            bpy.context.collection.objects.link(clone)
            clone.matrix_world = source.matrix_world.copy()
            for key, value in source.items():
                clone[key] = value
            clone["role"] = "effect-anchor"
            staging.append(clone)
        elif source.type == "MESH":
            evaluated = source.evaluated_get(depsgraph)
            data = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=depsgraph)
            data.transform(source.matrix_world)
            # A missing tint layer must be white when mixed with tinted foliage.
            # Otherwise joining meshes would turn architecture black in COLOR_0.
            color = data.color_attributes.get("Color")
            if color is None:
                color = data.color_attributes.new(name="Color", type="BYTE_COLOR", domain="CORNER")
                color.data.foreach_set("color", [1.0, 1.0, 1.0, 1.0] * len(color.data))
            data.color_attributes.active_color = color
            clone = bpy.data.objects.new(f"{asset_id}_part", data)
            bpy.context.collection.objects.link(clone)
            clone.matrix_world = Matrix.Identity(4)
            staging.append(clone)
    meshes = [obj for obj in staging if obj.type == "MESH"]
    empties = [obj for obj in staging if obj.type == "EMPTY"]
    if not meshes:
        raise ValueError(f"No mesh geometry for {asset_id}")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    batch = bpy.context.object
    batch.name = asset_id
    if detail == "distant":
        simplify = batch.modifiers.new("Distant topology LOD", "DECIMATE")
        simplify.ratio = .50
        simplify.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=simplify.name)
    batch["asset_id"] = asset_id
    batch["detail"] = detail
    batch["seed"] = seed
    batch["units"] = "metres"
    batch["authoring_up"] = "Z"
    batch["runtime_up"] = "Y"
    batch["ground_plane"] = 0.0
    for key, value in (metadata or {}).items():
        batch[key] = value
    batch.data.calc_loop_triangles()
    triangles = len(batch.data.loop_triangles)
    vertices = [vertex.co for vertex in batch.data.vertices]
    lo = [min(v[i] for v in vertices) for i in range(3)]
    hi = [max(v[i] for v in vertices) for i in range(3)]
    runtime_bounds = {"min": [lo[0], lo[2], -hi[1]], "max": [hi[0], hi[2], -lo[1]]}
    bpy.ops.object.select_all(action="DESELECT")
    batch.select_set(True)
    for obj in empties:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = batch
    bpy.ops.export_scene.gltf(filepath=str(destination), export_format="GLB", use_selection=True,
        export_yup=True, export_apply=False, export_extras=True, export_animations=False,
        export_cameras=False, export_lights=False, export_materials="EXPORT", export_image_format="AUTO",
        export_texcoords=True, export_normals=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False)
    if not destination.is_file() or destination.stat().st_size < 100:
        raise RuntimeError(f"GLB export missing or empty: {destination}")
    return {"id": asset_id, "file": destination.name, "tier": detail, "triangles": triangles,
        "bytes": destination.stat().st_size, "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        "bounds": runtime_bounds, "anchors": anchors,
        "materials": sorted({slot.material.name for slot in batch.material_slots if slot.material}),
        "origin": [0, 0, 0], "coordinateSystem": "glTF Y-up, metres, semantic front +Z", "seed": seed}

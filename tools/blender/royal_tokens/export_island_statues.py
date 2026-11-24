"""Make compact, pedestal-ready sculptures from the project's four royal tokens."""

from pathlib import Path

import bpy


ASSETS = Path(__file__).resolve().parents[3] / "public/assets/models"
MODELS = ("RoyalCarriage", "RoyalUnicorn", "RoyalPegasus", "RoyalGriffin")


def export_statue(name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ASSETS / "player-tokens" / f"{name}.glb"))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        # Simplify the glazed surfaces while retaining small relief and precious stones.
        modifier = obj.modifiers.new("Landmark silhouette", 'DECIMATE')
        modifier.ratio = 0.23 if len(obj.data.polygons) > 800 else 0.55
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.select_set(False)

    vertices = [vertex for obj in meshes for vertex in obj.data.vertices]
    center_x = (min(v.co.x for v in vertices) + max(v.co.x for v in vertices)) / 2
    center_y = (min(v.co.y for v in vertices) + max(v.co.y for v in vertices)) / 2
    floor = min(v.co.z for v in vertices)
    radius = max(((v.co.x - center_x)**2 + (v.co.y - center_y)**2)**.5 for v in vertices)
    scale = min(1.32 / radius, 2.72 / (max(v.co.z for v in vertices) - floor))
    for vertex in vertices:
        vertex.co = ((vertex.co.x - center_x) * scale, (vertex.co.y - center_y) * scale,
                     (vertex.co.z - floor) * scale)

    # Bake the miniature's materials into two buffers to limit every landmark to two draws.
    # The existing shared UV atlas stays in place. Clear glaze gives the porcelain a sheen.
    finishes = bpy.data.materials.new("Glazed porcelain and enamel")
    gilding = bpy.data.materials.new("Satin gilding")
    source_image = next(node.image for material in bpy.data.materials if material.use_nodes
                        for node in material.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image)
    for material, metal, roughness in [(finishes, .03, .43), (gilding, .62, .29)]:
        material.use_nodes = True
        shader = material.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Metallic"].default_value = metal
        shader.inputs["Roughness"].default_value = roughness
        texture = material.node_tree.nodes.new('ShaderNodeTexImage')
        texture.image = source_image
        material.node_tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])

    for obj in meshes:
        for index, material in enumerate(obj.data.materials):
            shader = material.node_tree.nodes.get("Principled BSDF")
            obj.data.materials[index] = gilding if shader.inputs["Metallic"].default_value > .4 else finishes
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    statue = bpy.context.object
    statue.name = f"{name} Statue"
    statue.data.name = statue.name
    material_indices = [0 if statue.data.materials[face.material_index] == finishes else 1
                        for face in statue.data.polygons]
    statue.data.materials.clear()
    statue.data.materials.append(finishes)
    statue.data.materials.append(gilding)
    statue.data.polygons.foreach_set('material_index', material_indices)
    output = ASSETS / "player-islands" / f"{name}Statue.glb"
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True,
                              export_animations=False, export_cameras=False, export_lights=False)


for model in MODELS:
    export_statue(model)

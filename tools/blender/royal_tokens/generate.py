"""Generate and review the four royal token exports with headless Blender."""

import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import carriage
import griffin
import horses
from sculpt import Sculpt, linear


ROOT = Path(__file__).resolve().parents[3]
REVIEW = ROOT / "docs/royal-player-tokens"
MODELS = {
    "RoyalCarriage": (carriage.build, (1.68,-2.31,.94)),
    "RoyalUnicorn": (horses.build, (1.92,-2.12,.72)),
    "RoyalPegasus": (lambda sculpt: horses.build(sculpt, True), (1.86,-2.12,.69)),
    "RoyalGriffin": (griffin.build, (1.34,-2.58,.63)),
}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    return scene


def generate(name, output, master):
    reset()
    sculpt = Sculpt(master)
    MODELS[name][0](sculpt)
    sculpt.finish(name)
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB", export_yup=True,
                              export_apply=True, export_texcoords=True, export_normals=True,
                              export_animations=False, export_cameras=False, export_lights=False)


def aim(obj, location):
    obj.rotation_euler = (Vector(location) - obj.location).to_track_quat("-Z", "Y").to_euler()


def softbox(name, location, color, power, width, height):
    data = bpy.data.lights.new(name, "AREA")
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    data.color, data.energy, data.shape = color, power, "RECTANGLE"
    data.size, data.size_y = width, height
    aim(obj, (0,0,.47))


def render(name, source, output, size, views):
    scene = reset()
    bpy.ops.import_scene.gltf(filepath=str(source))
    scene.world = bpy.data.worlds.new("Studio ambient")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (*linear("AFC3EC"), 1)
    bg.inputs["Strength"].default_value = .56
    softbox("Warm front key", (-2,-3,4), (1,.96,.87), 265, 3, 3)
    softbox("Soft right reflection", (2.6,-1.2,2.2), (.94,.97,1), 195, 2.0, 3.2)
    softbox("Overhead rim", (.25,2.1,3.3), (1,.91,.73), 355, 2.8, 1.7)
    softbox("Rear-left reflection", (-2.3,1.05,1.45), (.74,.83,1), 68, 2.1, 1.9)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.004))
    floor = bpy.context.object
    floor.name = "Studio sweep"
    matte = bpy.data.materials.new("Slate matte")
    matte.use_nodes = True
    surface = matte.node_tree.nodes["Principled BSDF"]
    surface.inputs["Base Color"].default_value = (*linear("263344"), 1)
    surface.inputs["Roughness"].default_value = .88
    floor.data.materials.append(matte)
    data = bpy.data.cameras.new("Collectible study")
    camera = bpy.data.objects.new("Collectible study", data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    data.type = "ORTHO"
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 32 if size >= 600 else 12
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -.22
    x,y,z = MODELS[name][1]
    angles = {"front": (x,y,z), "opposite": (-x,y,z), "rear": (x*.72,-y,z+.12)}
    target = Vector((0,0,.513))
    vertices = [obj.matrix_world @ vert.co for obj in scene.objects if obj.type == "MESH" and obj != floor
                for vert in obj.data.vertices]
    output.mkdir(parents=True,exist_ok=True)
    for view in views:
        camera.location = target + Vector(angles[view])
        aim(camera, target)
        rotation = camera.rotation_euler.to_quaternion()
        right, up = rotation @ Vector((1,0,0)), rotation @ Vector((0,1,0))
        horizontal = [point.dot(right) for point in vertices]
        vertical = [point.dot(up) for point in vertices]
        data.ortho_scale = max(max(horizontal)-min(horizontal), max(vertical)-min(vertical))*1.13
        offset = right*((min(horizontal)+max(horizontal))/2-target.dot(right))
        offset += up*((min(vertical)+max(vertical))/2-target.dot(up))
        camera.location += offset
        scene.render.filepath = str(output / f"{name}-{view}.png")
        bpy.ops.render.render(write_still=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", nargs="+", choices=MODELS, default=list(MODELS))
    parser.add_argument("--tier", choices=["master","game"], default="master")
    parser.add_argument("--render", nargs="+", choices=["front","opposite","rear"])
    parser.add_argument("--render-only", action="store_true")
    parser.add_argument("--size", type=int, default=720)
    parser.add_argument("--review-dir", type=Path, default=REVIEW)
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    for name in args.only:
        source = args.review_dir / args.tier / f"{name}.glb"
        if not args.render_only:
            generate(name, source, args.tier == "master")
        if args.render:
            render(name, source, args.review_dir / ("renders" if args.tier == "master" else "game-renders"),
                   args.size, args.render)


if __name__ == "__main__":
    main()

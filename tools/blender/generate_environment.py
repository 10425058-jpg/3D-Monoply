"""Deterministic command-line entry point. Run with Blender --background.

blender --background --python tools/blender/generate_environment.py -- --milestone foundation
"""
import argparse
import json
from pathlib import Path
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent
sys.path.insert(0, str(SCRIPT_DIR))
import bpy
from core import reset_scene, make_materials
from export_assets import export_glb
from generate_floating_islands import generate_island


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--milestone", choices=["foundation", "architecture", "nature", "final"], default="final")
    parser.add_argument("--seed", type=int, default=10425058)
    parser.add_argument("--out-dir", type=Path, default=ROOT / "public/assets/models/environment")
    parser.add_argument("--tiers", default="high,balanced,low,distant")
    parser.add_argument("--only", help="comma-separated asset IDs; update these assets without rebuilding the others")
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])


def generate(args):
    reset_scene()
    materials = make_materials()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    records = []
    selected = set(args.only.split(",")) if args.only else None
    valid_ids = {"foundation-island"} if args.milestone == "foundation" else {"royal-island-left", "royal-island-right"}
    if args.milestone in ["nature", "final"]:
        valid_ids |= {"fantasy-airship", "cherry-blossom", "fantasy-house", "royal-bridge", "garden-lantern", "royal-castle"}
    if selected and not selected <= valid_ids:
        raise ValueError(f"Assets not available in {args.milestone}: {sorted(selected-valid_ids)}")
    tiers = [tier.strip() for tier in args.tiers.split(",")]
    if any(tier not in ["high", "balanced", "low", "distant"] for tier in tiers):
        raise ValueError("Unknown detail tier")
    variants = ["left"] if args.milestone == "foundation" else ["left", "right"]
    for variant in variants:
        asset_id = "foundation-island" if args.milestone == "foundation" else f"royal-island-{variant}"
        if selected and asset_id not in selected:
            continue
        for tier in tiers:
            if args.milestone == "foundation" and tier != "high":
                continue
            reset_scene()
            detail = "low" if tier == "distant" else tier
            objects = generate_island(materials, variant=variant, detail=detail, seed=args.seed)
            if args.milestone != "foundation":
                from generate_castles import generate_castle
                from generate_villages import generate_house
                objects += generate_castle(materials, variant=variant, detail=detail, origin=(0, 1.0, .16), scale=.9)
                for index, (x, y, rotation) in enumerate([(-4.7, -1.3, -.2), (4.1, -1.8, .2), (-3.7, 2.8, .15)]):
                    house_detail = "low" if detail != "high" and index > 0 else detail
                    objects += generate_house(materials, variant=["cafe", "boutique", "cottage"][index], detail=house_detail,
                        origin=(x, y, .16), scale=.8, rotation=rotation)
            if args.milestone in ["nature", "final"]:
                from generate_vegetation import generate_tree, generate_shrub, generate_garden_rocks
                from generate_bridges import generate_bridge
                from generate_lanterns import generate_lantern
                tree_sites = [(-6,.2,1),(6,-.2,.8),(-4.5,2.9,.8),(3.8,3.1,.7),(1.8,-4.2,.65)]
                if detail == "balanced": tree_sites = tree_sites[:4]
                if detail == "low": tree_sites = tree_sites[:3]
                for index, (x, y, size) in enumerate(tree_sites):
                    objects += generate_tree(materials, variant=index, detail=detail, origin=(x, y, .12), scale=size)
                water_sign = -1 if variant == "left" else 1
                objects += generate_bridge(materials, detail=detail, origin=(water_sign*3.6,-2.5,.25), scale=.38, rotation=water_sign*.7854)
                for x, y in [(-2.3,-3.4),(2.3,-3.4),(-5.2,1),(5.2,1)]:
                    objects += generate_lantern(materials, detail=detail, origin=(x, y, .12), scale=.65)
                for index, (x, y) in enumerate([(-1.6,-3.9),(.3,-4.1),(4.9,2.5)]):
                    objects += generate_shrub(materials, detail=detail, origin=(x,y,.1), scale=.85, flowering=index != 1, seed=args.seed+index)
                objects += generate_garden_rocks(materials, origin=(6.1,2.2,.12), scale=1.3, seed=args.seed)
            asset_id = "foundation-island" if args.milestone == "foundation" else f"royal-island-{variant}"
            suffix = "" if tier == "high" else f"-{tier}"
            records.append(export_glb(objects, args.out_dir / f"{asset_id}{suffix}.glb", asset_id, tier, args.seed,
                {"milestone": args.milestone, "role": "background-floating-island"}))
            print(f"ASSET {records[-1]['file']} {records[-1]['triangles']} triangles {records[-1]['bytes']} bytes", flush=True)
    if args.milestone in ["nature", "final"]:
        from generate_airship import generate_airship
        from generate_vegetation import generate_tree
        from generate_villages import generate_house
        from generate_bridges import generate_bridge
        from generate_lanterns import generate_lantern
        from generate_castles import generate_castle
        generators = {"fantasy-airship": generate_airship, "cherry-blossom": generate_tree,
            "fantasy-house": generate_house, "royal-bridge": generate_bridge,
            "garden-lantern": generate_lantern, "royal-castle": generate_castle}
        for name, builder in generators.items():
            if selected and name not in selected:
                continue
            prop_tiers = [t for t in tiers if t != "distant" and (name == "fantasy-airship" or t != "balanced")]
            for tier in prop_tiers:
                reset_scene()
                objects = builder(materials, detail=tier)
                suffix = "" if tier == "high" else f"-{tier}"
                records.append(export_glb(objects, args.out_dir / f"{name}{suffix}.glb", name, tier, args.seed,
                    {"milestone": args.milestone, "role": "reusable-environment-prop"}))
                print(f"ASSET {records[-1]['file']} {records[-1]['triangles']} triangles {records[-1]['bytes']} bytes", flush=True)
    manifest = {"schemaVersion": 1, "generator": "tools/blender/generate_environment.py", "blenderVersion": bpy.app.version_string,
        "milestone": args.milestone, "seed": args.seed, "license": "Original procedural project assets; repository license applies",
        "materials": "one embedded 128x128 surface atlas; shared PBR materials", "assets": records}
    path = args.out_dir / ("foundation-manifest.json" if args.milestone == "foundation" else "manifest.json")
    if selected and path.is_file():
        existing = json.loads(path.read_text(encoding="utf-8"))["assets"]
        updated = {record["file"]: record for record in existing}
        updated.update({record["file"]: record for record in records})
        manifest["assets"] = list(updated.values())
    path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"MANIFEST {path}", flush=True)


if __name__ == "__main__":
    generate(arguments())

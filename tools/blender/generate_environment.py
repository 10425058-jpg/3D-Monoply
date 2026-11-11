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
                castle_site = (-.65,1.15,.16) if variant == "left" else (1.0,1.0,.88)
                objects += generate_castle(materials, variant=variant, detail=detail, origin=castle_site, scale=.9)
                house_sites = [(-5.8,-.8,-.1,"cafe",.82),(4.9,-1.4,.35,"boutique",.85),(-3.2,-3.9,-.2,"cottage",.70)] if variant == "left" else [
                    (-5.3,.6,.35,"boutique",.82),(5.5,2.8,-.35,"cottage",.70)]
                for index, (x, y, rotation, house_variant, size) in enumerate(house_sites):
                    house_detail = "low" if detail != "high" and index > 0 else detail
                    objects += generate_house(materials, variant=house_variant, detail=house_detail,
                        origin=(x, y, .16), scale=size, rotation=rotation)
            if args.milestone in ["nature", "final"]:
                from generate_vegetation import generate_tree, generate_shrub, generate_garden_rocks
                from generate_bridges import generate_bridge
                from generate_lanterns import generate_lantern
                from generate_gardens import generate_pavilion, generate_garden_accents
                tree_sites = [(-6.6,1.8,.92,"umbrella"),(6.1,2.7,.82,"windward"),(3.9,-3.5,.72,"upright"),
                              (-1.7,-4.5,.65,"umbrella"),(-4.0,3.8,.72,"windward")] if variant == "left" else [
                              (-4.4,3.2,1.02,"windward"),(6.4,.5,.75,"upright"),(-1.6,-4.3,.70,"umbrella"),
                              (2.7,-4.6,.6,"windward"),(-6.5,-1.0,.6,"upright")]
                if detail == "balanced": tree_sites = tree_sites[:4]
                if detail == "low": tree_sites = tree_sites[:3]
                for index, (x, y, size, form) in enumerate(tree_sites):
                    # A small distant tree uses its inexpensive silhouette LOD;
                    # spend those saved triangles on the gardens, not more lobes.
                    tree_detail = "low" if detail == "balanced" and index == 3 else detail
                    objects += generate_tree(materials, variant=f"{variant}-{index}", detail=tree_detail, origin=(x,y,.12), scale=size, form=form)
                water_sign = -1 if variant == "left" else 1
                bridge_site = (-4.2,-2.3,.25) if variant == "left" else (4.1,-2.6,.25)
                objects += generate_bridge(materials, detail=detail, origin=bridge_site, scale=.38 if variant == "left" else .43, rotation=water_sign*.7854)
                lamp_sites = [(-2.3,-3.4),(2.3,-3.4),(-5.2,1),(5.2,1)] if variant == "left" else [(-3.6,-3.2),(2.3,-3.8),(-3.8,1.5),(5.8,1.4)]
                for x, y in lamp_sites:
                    objects += generate_lantern(materials, detail=detail, origin=(x, y, .12), scale=.65)
                shrub_sites = [(-.7,-3.7),(1.4,-4.1),(5.2,2)] if variant == "left" else [(-5.2,-3.6),(-2.5,-4.3),(5.5,-.8)]
                for index, (x, y) in enumerate(shrub_sites):
                    objects += generate_shrub(materials, detail=detail, origin=(x,y,.1), scale=.85, flowering=index != 1, seed=args.seed+index)
                objects += generate_garden_rocks(materials, origin=(-7.1,-1.3,.12) if variant == "left" else (4.8,-4.7,.12), scale=1.3, seed=args.seed)
                objects += generate_garden_accents(materials, variant=variant, detail=detail)
                if variant == "right":
                    objects += generate_pavilion(materials, detail=detail, origin=(-4.2,-2.7,.12), scale=.9, rotation=.2)
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

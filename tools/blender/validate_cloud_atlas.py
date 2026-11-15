"""Inspect actual offline cloud PNGs: bytes, alpha, gutters and eight variants."""
import argparse
import hashlib
import json
from pathlib import Path
from validate_assets import image_dimensions,png_statistics,require

ROOT=Path(__file__).resolve().parents[2]
MANIFEST=ROOT/"public/assets/textures/environment/cloud-volume-v2-manifest.json"


def inspect(path,receipt):
    raw=path.read_bytes();digest=hashlib.sha256(raw).hexdigest()
    require(digest==receipt["sha256"],"cloud atlas hash differs from generation receipt")
    require(len(raw)==receipt["bytes"] and len(raw)<330000,"cloud atlas byte budget or receipt mismatch")
    width,height=image_dimensions(raw)
    require([width,height]==[receipt["width"],receipt["height"]],"cloud dimensions differ from receipt")
    statistics,decoded=png_statistics(raw);rows,channels=decoded
    require(channels==4,"cloud atlas requires actual RGBA pixels")
    require(width%4==0 and height%2==0,"cloud atlas must have a 4 by 2 cell grid")
    tw,th=width//4,height//2
    variants=[]
    for cell in range(8):
        alphas=bytearray();soft=solid=empty=gutter_max=0
        for y in range(th):
            row=rows[(cell//4)*th+y]
            for x in range(tw):
                a=row[((cell%4)*tw+x)*4+3];alphas.append(a)
                empty+=a==0;soft+=0<a<180;solid+=a>=180
                if x<2 or x>=tw-2 or y<2 or y>=th-2:gutter_max=max(gutter_max,a)
        require(empty>tw*th*.30 and soft>tw*th*.01 and solid>tw*th*.05,"cloud cell lacks soft density transitions")
        require(gutter_max<=4,"cloud cell gutter can bleed at atlas boundaries")
        variants.append({"cell":cell,"alphaSha256":hashlib.sha256(alphas).hexdigest(),"empty":empty,"soft":soft,"body":solid,"gutterAlphaMax":gutter_max})
    require(len({v["alphaSha256"] for v in variants})==8,"cloud silhouettes repeat")
    return {"file":path.name,"bytes":len(raw),"sha256":digest,"width":width,"height":height,
      "rgbaMipEstimateBytes":round(width*height*4*4/3),"variants":variants,"valid":True}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument("--output",type=Path)
    args=parser.parse_args();manifest=json.loads(MANIFEST.read_text(encoding="utf-8"))
    assets=[];failures=[]
    for receipt in manifest["assets"]:
        try:assets.append(inspect(MANIFEST.parent/receipt["file"],receipt))
        except (ValueError,KeyError,OSError) as error:failures.append({"file":receipt["file"],"error":str(error)})
    report={"valid":not failures,"assets":assets,"failures":failures}
    encoded=json.dumps(report,indent=2)
    if args.output:args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(encoded+"\n",encoding="utf-8")
    print(encoded)
    return 0 if report["valid"] else 1


if __name__=="__main__":raise SystemExit(main())

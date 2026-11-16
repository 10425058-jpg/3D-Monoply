"""Describe colour/contrast in an explicitly chosen matched screenshot crop.

This reads actual PNG bytes using the repository's stdlib decoder. It reports
descriptive image statistics, not an automatic visual-quality acceptance test.
Select the rectangle only after inspecting the real application captures.
"""
import argparse
import colorsys
import json
import math
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/blender'))
from validate_assets import image_dimensions,png_statistics


def describe(path,rect):
    raw=path.read_bytes();dimensions=image_dimensions(raw);_,decoded=png_statistics(raw)
    if not decoded:raise ValueError('requires PNG capture')
    x,y,width,height=rect
    if min(x,y)<0 or min(width,height)<1 or x+width>dimensions[0] or y+height>dimensions[1]:
        raise ValueError('comparison rectangle lies outside capture')
    rows,channels=decoded;saturation=[];luminance=[];green=[];blue=[];pale=[]
    for row in range(y,y+height):
        for column in range(x,x+width):
            rgb=[value/255 for value in rows[row][column*channels:column*channels+3]]
            hue,sat,value=colorsys.rgb_to_hsv(*rgb)
            luma=sum(a*b for a,b in zip(rgb,[.2126,.7152,.0722]))
            saturation.append(sat);luminance.append(luma)
            if .18<=hue<=.45 and sat>.16:green.append(sat)
            if .52<=hue<=.72 and sat>.16:blue.append(sat)
            pale.append(luma>.63 and sat<.16)
    count=len(saturation);mean=sum(luminance)/count
    percentile=lambda data,p:sorted(data)[min(len(data)-1,int(len(data)*p))] if data else None
    return {'file':str(path),'dimensions':dimensions,'pixels':count,
      'meanHsvSaturation':sum(saturation)/count,'medianHsvSaturation':percentile(saturation,.5),
      'meanSrgbLuminance':mean,'luminanceStdDev':math.sqrt(sum((value-mean)**2 for value in luminance)/count),
      'luminanceP10':percentile(luminance,.1),'luminanceP90':percentile(luminance,.9),
      'paleLowSaturationFraction':sum(pale)/count,
      'greenPixelCount':len(green),'greenMeanSaturation':sum(green)/len(green) if green else None,
      'bluePixelCount':len(blue),'blueMeanSaturation':sum(blue)/len(blue) if blue else None}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('before',type=Path);parser.add_argument('after',type=Path)
    parser.add_argument('--rect',type=int,nargs=4,required=True,metavar=('X','Y','WIDTH','HEIGHT'))
    parser.add_argument('--description',required=True,help='what the inspected crop contains')
    parser.add_argument('--output',type=Path)
    args=parser.parse_args();a=describe(args.before,args.rect);b=describe(args.after,args.rect)
    if a['dimensions']!=b['dimensions']:raise ValueError('capture dimensions differ')
    report={'method':'Descriptive fixed-crop screenshot statistics; no quality pass threshold. Geometry/palette changes affect pixel membership.',
      'rectangle':args.rect,'description':args.description,'before':a,'after':b}
    encoded=json.dumps(report,indent=2)
    if args.output:args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(encoded+'\n',encoding='utf-8')
    print(encoded)
    return 0


if __name__=='__main__':raise SystemExit(main())

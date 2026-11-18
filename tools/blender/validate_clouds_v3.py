"""Read actual v3 PNG bytes, shape support, light fringes and source hashes."""
import argparse
from collections import deque
import hashlib
import json
from pathlib import Path

from validate_assets import image_dimensions, png_statistics, require

ROOT=Path(__file__).resolve().parents[2]
MANIFEST=ROOT/'public/assets/textures/environment/cloud-volume-v3-manifest.json'


def connected_fraction(mask,width,height):
    remaining={i for i,value in enumerate(mask) if value}
    total=len(remaining)
    largest=0
    while remaining:
        first=remaining.pop()
        queue=deque([first])
        count=1
        while queue:
            i=queue.popleft()
            x,y=i%width,i//width
            for dy in (-1,0,1):
                for dx in (-1,0,1):
                    nx,ny=x+dx,y+dy
                    if 0<=nx<width and 0<=ny<height:
                        j=ny*width+nx
                        if j in remaining:
                            remaining.remove(j)
                            queue.append(j)
                            count+=1
        largest=max(largest,count)
    return largest/max(1,total)


def inspect(path,receipt):
    raw=path.read_bytes()
    digest=hashlib.sha256(raw).hexdigest()
    require(digest==receipt['sha256'],'atlas bytes differ from authoring receipt')
    require(len(raw)==receipt['bytes'] and len(raw)<600000,'atlas byte budget or receipt mismatch')
    width,height=image_dimensions(raw)
    size=receipt['cellSize']
    require((width,height)==(size*4,size*2),'atlas cells must be square in a 4 by 2 grid')
    require(size=={'low':128,'balanced':192,'high':256}[receipt['tier']],'unexpected quality resolution')
    _,decoded=png_statistics(raw)
    rows,channels=decoded
    require(channels==4,'cloud atlas must contain RGBA')
    variants=[]
    for cell in range(8):
        alphas=bytearray()
        mask=[]
        occupied=[]
        brightness=[]
        fringe=[]
        gutter_max=0
        crop_outside_max=0
        crop_boundary_max=0
        for y in range(size):
            row=rows[(cell//4)*size+y]
            for x in range(size):
                offset=((cell%4)*size+x)*4
                r,g,b,a=row[offset:offset+4]
                alphas.append(a)
                mask.append(a>=64)
                if a>=64:
                    occupied.append((x,y))
                if a>=180:
                    brightness.append((r+g+b)/(3*255))
                if 0<a<32:
                    fringe.append(min(r,g,b))
                if x<3 or x>=size-3 or y<3 or y>=size-3:
                    gutter_max=max(gutter_max,a)
                u,v=x/size,y/size
                if u<.05 or u>.95 or v<.12 or v>.88:
                    crop_outside_max=max(crop_outside_max,a)
                if min(abs(u-.05),abs(u-.95),abs(v-.12),abs(v-.88))<=1/size:
                    crop_boundary_max=max(crop_boundary_max,a)
        require(gutter_max==0,'transparent atlas gutter is not clean')
        require(crop_outside_max==0 and crop_boundary_max==0,'runtime card crop would clip the cloud soft fringe')
        count=size*size
        empty=sum(a==0 for a in alphas)
        soft=sum(0<a<180 for a in alphas)
        body=sum(a>=180 for a in alphas)
        require(empty>count*.40 and soft>count*.02 and body>count*.04,'cloud lacks body and soft edge density hierarchy')
        require(fringe and min(fringe)>80,'soft cloud fringe cannot contain dark/black RGB')
        low_x,high_x=min(x for x,y in occupied),max(x for x,y in occupied)
        low_y,high_y=min(y for x,y in occupied),max(y for x,y in occupied)
        aspect=(high_x-low_x+1)/(high_y-low_y+1)
        require(1.05<aspect<2.4,'cloud shape is stretched into a streak or blade')
        connected=connected_fraction(mask,size,size)
        require(connected>.98,'cloud body is torn into disconnected fragments')
        require(max(brightness)-min(brightness)>.06,'cloud interior lacks usable volume shading')
        variants.append({'cell':cell,'alphaSha256':hashlib.sha256(alphas).hexdigest(),
            'emptyPixels':empty,'softPixels':soft,'bodyPixels':body,'gutterAlphaMax':gutter_max,
            'bodyAspect':round(aspect,4),'connectedBodyFraction':connected,
            'cardCrop':[.05,.12,.95,.88],'cropOutsideAlphaMax':crop_outside_max,
            'cropBoundaryAlphaMax':crop_boundary_max,
            'bodyBrightnessRange':round(max(brightness)-min(brightness),4),'minimumFringeRgb':min(fringe)})
    require(len({v['alphaSha256'] for v in variants})==8,'cloud silhouettes repeat')
    return {'file':path.name,'bytes':len(raw),'sha256':digest,'width':width,'height':height,
        'rgbaMipEstimateBytes':round(width*height*4*4/3),'variants':variants,'valid':True}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    manifest=json.loads(MANIFEST.read_text(encoding='utf-8'))
    require(manifest['variants']==8 and len(manifest['assets'])==3,'incomplete cloud atlas family')
    assets=[]
    failures=[]
    for name,expected in manifest['sourceHashes'].items():
        source=(ROOT/'tools/blender'/name).read_bytes().replace(b'\r\n',b'\n')
        require(hashlib.sha256(source).hexdigest()==expected,f'authoring dependency hash changed: {name}')
    for receipt in manifest['assets']:
        try:
            assets.append(inspect(MANIFEST.parent/receipt['file'],receipt))
        except (ValueError,KeyError,OSError) as error:
            failures.append({'file':receipt['file'],'error':str(error)})
    report={'valid':not failures,'assets':assets,'failures':failures}
    encoded=json.dumps(report,indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(encoded+'\n',encoding='utf-8')
    print(encoded)
    return 0 if report['valid'] else 1


if __name__=='__main__':
    raise SystemExit(main())
